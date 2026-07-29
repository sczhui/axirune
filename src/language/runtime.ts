import { emptySpan, type Program, type SourceSpan } from "./ast.js";
import {
  BuiltinFault,
  invokeBuiltin,
  isBuiltinName,
  type BuiltinArgument,
  type BuiltinValue,
} from "./builtins.js";
import { compileProgram, compileSource } from "./compiler.js";
import { diagnostic, type Diagnostic } from "./diagnostics.js";
import type {
  IRFrame,
  IRInstruction,
  IRProgram,
  IRValue,
} from "./ir.js";

export type RuntimeScalar = null | boolean | number | string;
export type RuntimeValue = BuiltinValue;

export type RunStatus =
  | "completed"
  | "compile-error"
  | "failed"
  | "denied"
  | "cancelled"
  | "budget-exhausted";

export type TraceKind =
  | "runtime.start"
  | "runtime.complete"
  | "frame.enter"
  | "frame.leave"
  | "permission.check"
  | "instruction"
  | "binding"
  | "call"
  | "builtin.call"
  | "function.call"
  | "tool.call"
  | "tool.result"
  | "tool.mock"
  | "emit"
  | "yield"
  | "launch"
  | "weave"
  | "error";

export interface TraceEvent {
  sequence: number;
  kind: TraceKind;
  message: string;
  frame?: string;
  instructionId?: string;
  data?: RuntimeValue;
}

export interface ToolCallRequest {
  name: string;
  arguments: RuntimeValue[];
  namedArguments: Readonly<Record<string, RuntimeValue>>;
  capabilities: readonly string[];
  frame: string | null;
  signal?: AbortSignal;
}

export type ToolHandler = (
  request: ToolCallRequest,
) => RuntimeValue | Promise<RuntimeValue>;

export interface ToolDefinition {
  run: ToolHandler;
  capabilities?: readonly string[];
}

export interface PermissionRequest {
  capability: string;
  target: string | null;
  frame: string | null;
}

export interface SandboxLimits {
  maxSteps: number;
  maxToolCalls: number;
  maxLaunches: number;
  maxFrameDepth: number;
  maxOutputBytes: number;
  maxTraceEvents: number;
  maxValueDepth: number;
  maxCollectionItems: number;
  timeoutMs: number;
}

export interface InterpreterOptions {
  entry?: string;
  input?: Readonly<Record<string, RuntimeValue>>;
  tools?: Readonly<Record<string, ToolHandler | ToolDefinition>>;
  capabilities?: Iterable<string>;
  permission?: (
    request: PermissionRequest,
  ) => boolean | Promise<boolean>;
  sandbox?: Partial<SandboxLimits>;
  signal?: AbortSignal;
  /** Missing external tools produce deterministic trace values when true. */
  mockTools?: boolean;
  executeWithErrors?: boolean;
  onTrace?: (event: TraceEvent) => void;
}

export interface RunResult {
  status: RunStatus;
  output: RuntimeValue[];
  emissions: RuntimeValue[];
  value: RuntimeValue;
  trace: TraceEvent[];
  diagnostics: Diagnostic[];
}

const defaultLimits: SandboxLimits = {
  maxSteps: 10_000,
  maxToolCalls: 64,
  maxLaunches: 256,
  maxFrameDepth: 32,
  maxOutputBytes: 1_048_576,
  maxTraceEvents: 4_000,
  maxValueDepth: 32,
  maxCollectionItems: 10_000,
  timeoutMs: 10_000,
};

export async function runSource(
  source: string,
  options: InterpreterOptions = {},
): Promise<RunResult> {
  const compiled = compileSource(source);
  if (!compiled.ok && !options.executeWithErrors) {
    return emptyRun("compile-error", compiled.diagnostics);
  }
  return executeIR(compiled.ir, options, compiled.diagnostics);
}

export async function runProgram(
  program: Program | IRProgram,
  options: InterpreterOptions = {},
): Promise<RunResult> {
  if (isIRProgram(program)) return executeIR(program, options, []);
  const compiled = compileProgram(program);
  if (!compiled.ok && !options.executeWithErrors) {
    return emptyRun("compile-error", compiled.diagnostics);
  }
  return executeIR(compiled.ir, options, compiled.diagnostics);
}

function isIRProgram(program: Program | IRProgram): program is IRProgram {
  return "version" in program && typeof program.version === "string";
}

function emptyRun(status: RunStatus, diagnostics: Diagnostic[]): RunResult {
  return {
    status,
    output: [],
    emissions: [],
    value: null,
    trace: [],
    diagnostics,
  };
}

interface ExecutionState {
  ir: IRProgram;
  options: InterpreterOptions;
  limits: SandboxLimits;
  diagnostics: Diagnostic[];
  trace: TraceEvent[];
  output: RuntimeValue[];
  emissions: RuntimeValue[];
  frames: Map<string, IRFrame>;
  allowed: Set<string>;
  steps: number;
  toolCalls: number;
  launches: number;
  outputBytes: number;
  startedAt: number;
  sequence: number;
}

interface FrameScope {
  values: Record<string, RuntimeValue>;
  input: Readonly<Record<string, RuntimeValue>>;
  budgets: Record<string, number>;
  frame: IRFrame | null;
  depth: number;
}

interface ExecutionOutcome {
  yielded: boolean;
  value: RuntimeValue;
}

async function executeIR(
  ir: IRProgram,
  options: InterpreterOptions,
  compileDiagnostics: readonly Diagnostic[],
): Promise<RunResult> {
  const state: ExecutionState = {
    ir,
    options,
    limits: { ...defaultLimits, ...options.sandbox },
    diagnostics: [...compileDiagnostics],
    trace: [],
    output: [],
    emissions: [],
    frames: indexFrames(ir.frames),
    allowed: new Set([...ir.permissions, ...(options.capabilities ?? [])]),
    steps: 0,
    toolCalls: 0,
    launches: 0,
    outputBytes: 0,
    startedAt: now(),
    sequence: 0,
  };
  trace(state, "runtime.start", `Run ${ir.space}.`, undefined, undefined, {
    edition: ir.edition,
  });

  try {
    let outcome: ExecutionOutcome;
    if (options.entry) {
      const frame = resolveFrame(state, options.entry);
      if (!frame) {
        throw new RuntimeFault(
          "E_ENTRY_NOT_FOUND",
          "failed",
          `Entry frame ${options.entry} does not exist.`,
          ir.sourceSpan,
        );
      }
      outcome = await executeFrame(state, frame, options.input ?? {}, 0);
    } else if (ir.entry.length > 0) {
      outcome = await executeInstructions(
        state,
        ir.entry,
        createScope(null, options.input ?? {}, 0),
      );
    } else {
      const frame =
        resolveFrame(state, "main") ??
        ir.frames.find((candidate) =>
          candidate.parentId === null &&
          ["workflow", "task", "agent"].includes(candidate.kind),
        );
      if (!frame) {
        throw new RuntimeFault(
          "E_NO_ENTRY",
          "failed",
          "No launch sentence or runnable main frame was found.",
          ir.sourceSpan,
        );
      }
      outcome = await executeFrame(state, frame, options.input ?? {}, 0);
    }
    trace(state, "runtime.complete", "Run completed.", undefined, undefined, outcome.value);
    return {
      status: "completed",
      output: state.output,
      emissions: state.emissions,
      value: outcome.value,
      trace: state.trace,
      diagnostics: state.diagnostics,
    };
  } catch (error) {
    const fault =
      error instanceof RuntimeFault
        ? error
        : new RuntimeFault(
            "E_RUNTIME",
            "failed",
            error instanceof Error ? error.message : String(error),
            ir.sourceSpan,
          );
    const runtimeDiagnostic = diagnostic(
      fault.code,
      "error",
      "runtime",
      fault.message,
      fault.span,
    );
    state.diagnostics.push(runtimeDiagnostic);
    trace(state, "error", fault.message, undefined, undefined, {
      code: fault.code,
    });
    return {
      status: fault.status,
      output: state.output,
      emissions: state.emissions,
      value: null,
      trace: state.trace,
      diagnostics: state.diagnostics,
    };
  }
}

function indexFrames(frames: readonly IRFrame[]): Map<string, IRFrame> {
  const index = new Map<string, IRFrame>();
  const simpleCounts = new Map<string, number>();
  for (const frame of frames) {
    index.set(frame.id, frame);
    index.set(frame.qualifiedName, frame);
    simpleCounts.set(frame.name, (simpleCounts.get(frame.name) ?? 0) + 1);
  }
  for (const frame of frames) {
    if (simpleCounts.get(frame.name) === 1) index.set(frame.name, frame);
  }
  return index;
}

function resolveFrame(state: ExecutionState, target: string): IRFrame | undefined {
  const exact = state.frames.get(target);
  if (exact || target.includes(".")) return exact;
  return state.frames.get(target.split(".").at(-1) ?? target);
}

function createScope(
  frame: IRFrame | null,
  input: Readonly<Record<string, RuntimeValue>>,
  depth: number,
): FrameScope {
  return {
    values: Object.create(null) as Record<string, RuntimeValue>,
    input,
    budgets: Object.create(null) as Record<string, number>,
    frame,
    depth,
  };
}

async function executeFrame(
  state: ExecutionState,
  frame: IRFrame,
  input: Readonly<Record<string, RuntimeValue>>,
  depth: number,
): Promise<ExecutionOutcome> {
  guardState(state, frame.sourceSpan);
  if (depth >= state.limits.maxFrameDepth) {
    throw new RuntimeFault(
      "E_FRAME_DEPTH",
      "budget-exhausted",
      `Frame depth exceeds ${state.limits.maxFrameDepth}.`,
      frame.sourceSpan,
    );
  }
  await enforceFrameRequirements(state, frame);
  trace(state, "frame.enter", `Enter ${frame.kind} ${frame.qualifiedName}.`, frame);
  const outcome = await executeInstructions(
    state,
    frame.instructions,
    createScope(frame, input, depth + 1),
  );
  trace(
    state,
    "frame.leave",
    `Leave ${frame.kind} ${frame.qualifiedName}.`,
    frame,
    undefined,
    outcome.value,
  );
  return outcome;
}

async function enforceFrameRequirements(
  state: ExecutionState,
  frame: IRFrame,
): Promise<void> {
  for (const requirement of frame.requirements) {
    if (requirement.kind !== "capability" && requirement.kind !== "permission") {
      continue;
    }
    const leaves = expandCapability(state, requirement.target, new Set());
    for (const capability of leaves) {
      await requireCapability(state, capability, frame.name, frame, requirement.span);
    }
  }
}

function expandCapability(
  state: ExecutionState,
  capability: string,
  seen: Set<string>,
): string[] {
  if (seen.has(capability)) return [];
  seen.add(capability);
  const alias = state.ir.frames.find(
    (frame) => frame.kind === "capability" && frame.name === capability,
  );
  if (!alias) return [capability];
  const nested = alias.requirements
    .filter((requirement) => requirement.kind === "capability")
    .flatMap((requirement) => expandCapability(state, requirement.target, seen));
  return nested.length > 0 ? nested : [capability];
}

async function requireCapability(
  state: ExecutionState,
  capability: string,
  target: string | null,
  frame: IRFrame | null,
  span: SourceSpan,
): Promise<void> {
  let allowed = state.allowed.has(capability);
  if (!allowed && state.options.permission) {
    allowed = await state.options.permission({
      capability,
      target,
      frame: frame?.qualifiedName ?? null,
    });
    if (allowed) state.allowed.add(capability);
  }
  trace(
    state,
    "permission.check",
    `${capability}: ${allowed ? "allowed" : "denied"}.`,
    frame ?? undefined,
    undefined,
    { capability, allowed },
  );
  if (!allowed) {
    throw new RuntimeFault(
      "E_PERMISSION_DENIED",
      "denied",
      `Capability ${capability} was not granted by the deployment.`,
      span,
    );
  }
}

async function executeInstructions(
  state: ExecutionState,
  instructions: readonly IRInstruction[],
  scope: FrameScope,
): Promise<ExecutionOutcome> {
  let value: RuntimeValue = null;
  for (const instruction of instructions) {
    consumeStep(state, scope, instruction.span);
    trace(
      state,
      "instruction",
      instruction.op,
      scope.frame ?? undefined,
      instruction.id,
    );
    switch (instruction.op) {
      case "take": {
        const taken = instruction.source
          ? await evaluate(state, instruction.source, scope)
          : Object.hasOwn(scope.input, instruction.name)
            ? scope.input[instruction.name]!
            : null;
        bind(state, scope, instruction.name, taken, instruction);
        break;
      }
      case "give":
        value = await evaluate(state, instruction.value, scope);
        if (scope.depth <= 1) pushOutput(state, value, instruction.span);
        break;
      case "grant":
        for (const capability of instruction.capabilities) {
          if (!state.allowed.has(capability)) {
            await requireCapability(
              state,
              capability,
              instruction.target,
              scope.frame,
              instruction.span,
            );
          }
        }
        break;
      case "within": {
        const duration = durationMilliseconds(instruction.limit);
        if (duration !== null && duration < state.limits.timeoutMs) {
          state.limits.timeoutMs = Math.max(1, duration);
        }
        break;
      }
      case "budget": {
        const evaluated = await evaluate(state, instruction.limit, scope);
        const limit = typeof evaluated === "number" ? evaluated : Number(evaluated);
        if (Number.isFinite(limit) && limit >= 0) {
          scope.budgets[instruction.resource] = limit;
        }
        break;
      }
      case "let": {
        const evaluated = await evaluate(state, instruction.value, scope);
        bind(state, scope, instruction.name, evaluated, instruction);
        break;
      }
      case "emit": {
        const emitted = await evaluate(state, instruction.value, scope);
        state.emissions.push(emitted);
        accountOutput(state, emitted, instruction.span);
        trace(
          state,
          "emit",
          "Value emitted.",
          scope.frame ?? undefined,
          instruction.id,
          emitted,
        );
        break;
      }
      case "yield": {
        value = await evaluate(state, instruction.value, scope);
        if (scope.depth <= 1) pushOutput(state, value, instruction.span);
        trace(
          state,
          "yield",
          "Frame yielded its terminal value.",
          scope.frame ?? undefined,
          instruction.id,
          value,
        );
        return { yielded: true, value };
      }
      case "invoke": {
        const arguments_ = await Promise.all(
          instruction.arguments.map((argument) => evaluate(state, argument, scope)),
        );
        value = await invokeTarget(state, instruction.target, arguments_, scope);
        if (instruction.binding) bind(state, scope, instruction.binding, value, instruction);
        break;
      }
      case "launch": {
        const arguments_ = await Promise.all(
          instruction.arguments.map((argument) => evaluate(state, argument, scope)),
        );
        value = await launchTarget(state, instruction.target, arguments_, scope);
        if (instruction.binding) bind(state, scope, instruction.binding, value, instruction);
        break;
      }
      case "weave": {
        value = await executeWeave(state, instruction, scope);
        if (instruction.binding) bind(state, scope, instruction.binding, value, instruction);
        break;
      }
      case "need":
      case "use":
      case "attach":
      case "directive":
      case "instruction":
        break;
    }
  }
  return { yielded: false, value };
}

async function evaluate(
  state: ExecutionState,
  value: IRValue,
  scope: FrameScope,
): Promise<RuntimeValue> {
  guardState(state, scope.frame?.sourceSpan ?? state.ir.sourceSpan);
  switch (value.kind) {
    case "literal":
      return value.value;
    case "reference":
      return resolveValue(scope.values, value.path);
    case "list":
      return Promise.all(value.items.map((item) => evaluate(state, item, scope)));
    case "record": {
      const result: Record<string, RuntimeValue> = Object.create(null) as Record<
        string,
        RuntimeValue
      >;
      for (const [key, entry] of Object.entries(value.entries)) {
        result[key] = await evaluate(state, entry, scope);
      }
      return result;
    }
    case "call": {
      trace(
        state,
        "call",
        `Call ${value.target}.`,
        scope.frame ?? undefined,
        undefined,
        { target: value.target },
      );
      if (isBuiltinName(value.target)) {
        trace(
          state,
          "builtin.call",
          `Builtin ${value.target}.`,
          scope.frame ?? undefined,
          undefined,
          { target: value.target },
        );
        const lazyArguments: Record<string, BuiltinArgument> = Object.create(
          null,
        ) as Record<string, BuiltinArgument>;
        for (const [name, argumentValue] of Object.entries(value.arguments)) {
          let pending: Promise<RuntimeValue> | undefined;
          lazyArguments[name] = () => {
            pending ??= evaluate(state, argumentValue, scope);
            return pending;
          };
        }
        try {
          return await invokeBuiltin(value.target, {
            arguments: lazyArguments,
            maxCollectionItems: state.limits.maxCollectionItems,
            callTask: (taskName, namedArguments) =>
              invokeUserTask(
                state,
                taskName,
                namedArguments,
                scope,
                value.span,
              ),
          });
        } catch (error) {
          if (error instanceof BuiltinFault) {
            throw new RuntimeFault(error.code, "failed", error.message, value.span);
          }
          throw error;
        }
      }

      const named = await evaluateNamedArguments(state, value.arguments, scope);
      const frame = resolveFrame(state, value.target);
      if (frame?.kind === "task") {
        return invokeUserTask(state, value.target, named, scope, value.span);
      }
      if (frame && frame.kind !== "tool") {
        throw new RuntimeFault(
          "E_CALL_TARGET",
          "failed",
          `${frame.kind} ${value.target} is not a deterministic task or tool.`,
          value.span,
        );
      }
      return callTool(
        state,
        value.target,
        Object.values(named),
        named,
        scope,
      );
    }
    case "missing":
      return null;
  }
}

async function evaluateNamedArguments(
  state: ExecutionState,
  arguments_: Readonly<Record<string, IRValue>>,
  scope: FrameScope,
): Promise<Record<string, RuntimeValue>> {
  const named: Record<string, RuntimeValue> = Object.create(null) as Record<
    string,
    RuntimeValue
  >;
  for (const [name, value] of Object.entries(arguments_)) {
    named[name] = await evaluate(state, value, scope);
  }
  return named;
}

async function invokeUserTask(
  state: ExecutionState,
  taskName: string,
  namedArguments: Readonly<Record<string, RuntimeValue>>,
  scope: FrameScope,
  span: SourceSpan,
): Promise<RuntimeValue> {
  const frame = resolveFrame(state, taskName);
  if (!frame || frame.kind !== "task") {
    throw new RuntimeFault(
      "E_TASK_NOT_FOUND",
      "failed",
      `Task ${taskName} is not declared.`,
      span,
    );
  }
  const parameters = new Map(
    frame.contract.inputs.map((input) => [input.name, input]),
  );
  for (const name of Object.keys(namedArguments)) {
    if (!parameters.has(name)) {
      throw new RuntimeFault(
        "E_TASK_UNKNOWN_ARGUMENT",
        "failed",
        `Task ${taskName} does not accept named argument :${name}.`,
        span,
      );
    }
  }
  for (const input of frame.contract.inputs) {
    if (input.source === null && !Object.hasOwn(namedArguments, input.name)) {
      throw new RuntimeFault(
        "E_TASK_MISSING_ARGUMENT",
        "failed",
        `Task ${taskName} requires named argument :${input.name}.`,
        span,
      );
    }
  }
  trace(
    state,
    "function.call",
    `Task ${taskName}.`,
    scope.frame ?? undefined,
    undefined,
    { target: taskName, arguments: { ...namedArguments } },
  );
  return (await executeFrame(state, frame, namedArguments, scope.depth)).value;
}

async function invokeTarget(
  state: ExecutionState,
  target: string,
  arguments_: RuntimeValue[],
  scope: FrameScope,
): Promise<RuntimeValue> {
  const frame = resolveFrame(state, target);
  if (frame && frame.kind !== "tool") {
    const input = argumentsToInput(frame, arguments_);
    return (await executeFrame(state, frame, input, scope.depth)).value;
  }
  return callTool(state, target, arguments_, namedFromArguments(arguments_), scope);
}

async function launchTarget(
  state: ExecutionState,
  target: string,
  arguments_: RuntimeValue[],
  scope: FrameScope,
): Promise<RuntimeValue> {
  state.launches += 1;
  if (state.launches > state.limits.maxLaunches) {
    throw new RuntimeFault(
      "E_LAUNCH_BUDGET",
      "budget-exhausted",
      `Launch budget ${state.limits.maxLaunches} exhausted.`,
      scope.frame?.sourceSpan ?? state.ir.sourceSpan,
    );
  }
  const frame = resolveFrame(state, target);
  if (!frame) {
    throw new RuntimeFault(
      "E_LAUNCH_TARGET",
      "failed",
      `Launch target ${target} does not exist.`,
      scope.frame?.sourceSpan ?? state.ir.sourceSpan,
    );
  }
  trace(state, "launch", `Launch ${target}.`, scope.frame ?? undefined, undefined, {
    target,
  });
  const input =
    arguments_.length === 0 && scope.frame === null
      ? { ...scope.input }
      : argumentsToInput(frame, arguments_);
  return (await executeFrame(state, frame, input, scope.depth)).value;
}

async function executeWeave(
  state: ExecutionState,
  instruction: Extract<IRInstruction, { op: "weave" }>,
  scope: FrameScope,
): Promise<RuntimeValue> {
  trace(
    state,
    "weave",
    `Start ${instruction.branches.length} structured branches.`,
    scope.frame ?? undefined,
    instruction.id,
  );
  const promises = instruction.branches.map(async (branch) => {
    const arguments_ = await Promise.all(
      branch.arguments.map((argument) => evaluate(state, argument, scope)),
    );
    return {
      name: branch.name,
      value: await launchTarget(state, branch.target, arguments_, scope),
    };
  });

  if (instruction.settle === "first_ok") {
    const first = await Promise.any(promises);
    return { [first.name]: first.value };
  }
  const settled = await Promise.allSettled(promises);
  const result: Record<string, RuntimeValue> = Object.create(null) as Record<
    string,
    RuntimeValue
  >;
  for (let index = 0; index < settled.length; index += 1) {
    const branch = instruction.branches[index]!;
    const outcome = settled[index]!;
    if (outcome.status === "fulfilled") {
      result[branch.name] = outcome.value.value;
    } else if (instruction.settle === "all_ok") {
      throw outcome.reason;
    } else {
      result[branch.name] = {
        fault: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      };
    }
  }
  return result;
}

async function callTool(
  state: ExecutionState,
  name: string,
  arguments_: RuntimeValue[],
  namedArguments: Readonly<Record<string, RuntimeValue>>,
  scope: FrameScope,
): Promise<RuntimeValue> {
  state.toolCalls += 1;
  if (state.toolCalls > state.limits.maxToolCalls) {
    throw new RuntimeFault(
      "E_TOOL_BUDGET",
      "budget-exhausted",
      `Tool-call budget ${state.limits.maxToolCalls} exhausted.`,
      scope.frame?.sourceSpan ?? state.ir.sourceSpan,
    );
  }
  const frame = resolveFrame(state, name);
  if (frame?.kind === "tool") await enforceFrameRequirements(state, frame);
  const configured = state.options.tools?.[name] ?? state.options.tools?.[name.split(".").at(-1) ?? name];
  const definition: ToolDefinition | null =
    typeof configured === "function"
      ? { run: configured }
      : configured
        ? configured
        : null;
  for (const capability of definition?.capabilities ?? []) {
    await requireCapability(
      state,
      capability,
      name,
      scope.frame,
      scope.frame?.sourceSpan ?? state.ir.sourceSpan,
    );
  }

  trace(
    state,
    "tool.call",
    `Tool ${name}.`,
    scope.frame ?? undefined,
    undefined,
    { name, namedArguments: { ...namedArguments } },
  );
  if (!definition) {
    if (state.options.mockTools ?? false) {
      const mocked = normalizeRuntimeValue(
        { mock: true, tool: name, arguments: [...arguments_], namedArguments: { ...namedArguments } },
        state.limits,
      );
      trace(
        state,
        "tool.mock",
        `Tool ${name} returned a deterministic mock.`,
        scope.frame ?? undefined,
        undefined,
        mocked,
      );
      return mocked;
    }
    throw new RuntimeFault(
      "E_TOOL_NOT_BOUND",
      "failed",
      `Tool ${name} has no host binding.`,
      scope.frame?.sourceSpan ?? state.ir.sourceSpan,
    );
  }

  const request: ToolCallRequest = {
    name,
    arguments: arguments_,
    namedArguments,
    capabilities: [...state.allowed].sort(),
    frame: scope.frame?.qualifiedName ?? null,
    ...(state.options.signal ? { signal: state.options.signal } : {}),
  };
  const raw = await withTimeout(
    Promise.resolve(definition.run(request)),
    remainingTime(state),
    () =>
      new RuntimeFault(
        "E_TIMEOUT",
        "budget-exhausted",
        `Tool ${name} exceeded the sandbox time limit.`,
        scope.frame?.sourceSpan ?? state.ir.sourceSpan,
      ),
  );
  const result = normalizeRuntimeValue(raw, state.limits);
  trace(
    state,
    "tool.result",
    `Tool ${name} completed.`,
    scope.frame ?? undefined,
    undefined,
    result,
  );
  return result;
}

function argumentsToInput(
  frame: IRFrame,
  arguments_: readonly RuntimeValue[],
): Record<string, RuntimeValue> {
  if (
    arguments_.length === 1 &&
    arguments_[0] !== null &&
    typeof arguments_[0] === "object" &&
    !Array.isArray(arguments_[0])
  ) {
    return { ...(arguments_[0] as Record<string, RuntimeValue>) };
  }
  const input: Record<string, RuntimeValue> = Object.create(null) as Record<
    string,
    RuntimeValue
  >;
  frame.contract.inputs.forEach((contract, index) => {
    input[contract.name] = arguments_[index] ?? null;
  });
  return input;
}

function namedFromArguments(
  arguments_: readonly RuntimeValue[],
): Readonly<Record<string, RuntimeValue>> {
  if (
    arguments_.length === 1 &&
    arguments_[0] !== null &&
    typeof arguments_[0] === "object" &&
    !Array.isArray(arguments_[0])
  ) {
    return arguments_[0] as Readonly<Record<string, RuntimeValue>>;
  }
  const named: Record<string, RuntimeValue> = Object.create(null) as Record<
    string,
    RuntimeValue
  >;
  arguments_.forEach((value, index) => {
    named[`arg${index + 1}`] = value;
  });
  return named;
}

function bind(
  state: ExecutionState,
  scope: FrameScope,
  name: string,
  value: RuntimeValue,
  instruction: IRInstruction,
): void {
  if (Object.hasOwn(scope.values, name)) {
    throw new RuntimeFault(
      "E_REBIND",
      "failed",
      `Runtime refused to replace immutable binding ${name}.`,
      instruction.span,
    );
  }
  scope.values[name] = value;
  trace(
    state,
    "binding",
    `Bound ${name}.`,
    scope.frame ?? undefined,
    instruction.id,
    value,
  );
}

function resolveValue(
  bindings: Readonly<Record<string, RuntimeValue>>,
  path: readonly string[],
): RuntimeValue {
  const root = path[0] ?? "";
  let current: RuntimeValue = Object.hasOwn(bindings, root) ? bindings[root]! : null;
  for (const segment of path.slice(1)) {
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current) ||
      !Object.hasOwn(current, segment)
    ) {
      return null;
    }
    current = current[segment]!;
  }
  return current;
}

function consumeStep(
  state: ExecutionState,
  scope: FrameScope,
  span: SourceSpan,
): void {
  guardState(state, span);
  state.steps += 1;
  if (state.steps > state.limits.maxSteps) {
    throw new RuntimeFault(
      "E_STEP_BUDGET",
      "budget-exhausted",
      `Step budget ${state.limits.maxSteps} exhausted.`,
      span,
    );
  }
  if (scope.budgets.steps !== undefined) {
    scope.budgets.steps -= 1;
    if (scope.budgets.steps < 0) {
      throw new RuntimeFault(
        "E_STEP_BUDGET",
        "budget-exhausted",
        "Frame step budget exhausted.",
        span,
      );
    }
  }
}

function guardState(state: ExecutionState, span: SourceSpan): void {
  if (state.options.signal?.aborted) {
    throw new RuntimeFault("E_CANCELLED", "cancelled", "Run was cancelled.", span);
  }
  if (remainingTime(state) <= 0) {
    throw new RuntimeFault(
      "E_TIMEOUT",
      "budget-exhausted",
      `Sandbox time limit ${state.limits.timeoutMs}ms exhausted.`,
      span,
    );
  }
}

function remainingTime(state: ExecutionState): number {
  return state.limits.timeoutMs - (now() - state.startedAt);
}

function pushOutput(
  state: ExecutionState,
  value: RuntimeValue,
  span: SourceSpan,
): void {
  state.output.push(value);
  accountOutput(state, value, span);
}

function accountOutput(
  state: ExecutionState,
  value: RuntimeValue,
  span: SourceSpan,
): void {
  state.outputBytes += JSON.stringify(value)?.length ?? 0;
  if (state.outputBytes > state.limits.maxOutputBytes) {
    throw new RuntimeFault(
      "E_OUTPUT_BUDGET",
      "budget-exhausted",
      `Output budget ${state.limits.maxOutputBytes} bytes exhausted.`,
      span,
    );
  }
}

function trace(
  state: ExecutionState,
  kind: TraceKind,
  message: string,
  frame?: IRFrame,
  instructionId?: string,
  data?: RuntimeValue,
): void {
  if (state.trace.length >= state.limits.maxTraceEvents) return;
  const event: TraceEvent = {
    sequence: state.sequence++,
    kind,
    message,
    ...(frame ? { frame: frame.qualifiedName } : {}),
    ...(instructionId ? { instructionId } : {}),
    ...(data === undefined ? {} : { data }),
  };
  state.trace.push(event);
  state.options.onTrace?.(event);
}

function normalizeRuntimeValue(
  value: unknown,
  limits: SandboxLimits,
  depth = 0,
  counter = { value: 0 },
): RuntimeValue {
  if (depth > limits.maxValueDepth) {
    throw new RuntimeFault(
      "E_VALUE_DEPTH",
      "failed",
      "Tool result exceeds the sandbox value-depth limit.",
      emptySpan(),
    );
  }
  counter.value += 1;
  if (counter.value > limits.maxCollectionItems) {
    throw new RuntimeFault(
      "E_VALUE_SIZE",
      "failed",
      "Tool result exceeds the sandbox collection limit.",
      emptySpan(),
    );
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeRuntimeValue(item, limits, depth + 1, counter));
  }
  if (typeof value === "object") {
    const result: Record<string, RuntimeValue> = Object.create(null) as Record<
      string,
      RuntimeValue
    >;
    for (const [key, entry] of Object.entries(value)) {
      if (key === "__proto__" || key === "prototype" || key === "constructor") continue;
      result[key] = normalizeRuntimeValue(entry, limits, depth + 1, counter);
    }
    return result;
  }
  return String(value);
}

function durationMilliseconds(value: IRValue): number | null {
  if (value.kind !== "literal" || typeof value.value !== "number") return null;
  const factors: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
  };
  return value.value * (value.unit ? factors[value.unit] ?? 1 : 1);
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  failure: () => Error,
): Promise<T> {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw failure();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(failure()), milliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

class RuntimeFault extends Error {
  constructor(
    readonly code: string,
    readonly status: Exclude<RunStatus, "completed" | "compile-error">,
    message: string,
    readonly span: SourceSpan,
  ) {
    super(message);
    this.name = "RuntimeFault";
  }
}
