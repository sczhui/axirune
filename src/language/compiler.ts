import {
  referenceName,
  type Expression,
  type Frame,
  type NamedArgument,
  type Program,
  type SourceSpan,
  type Statement,
  type TypeNode,
} from "./ast.js";
import {
  BUILTIN_NAMES,
  getBuiltinSignature,
  type BuiltinValueType,
} from "./builtins.js";
import { diagnostic, hasErrors, type Diagnostic } from "./diagnostics.js";
import {
  type IRContract,
  type IRFrame,
  type IRInstruction,
  type IRProgram,
  type IRRequirement,
  type IRType,
  type IRValue,
} from "./ir.js";
import { IR_VERSION } from "./metadata.js";
import { parseSource } from "./parser.js";

export interface CompileOptions {
  strictReferences?: boolean;
  externalSymbols?: Iterable<string>;
}

export interface CompileResult {
  ir: IRProgram;
  program: Program;
  diagnostics: Diagnostic[];
  ok: boolean;
}

export function compileSource(
  source: string,
  options: CompileOptions = {},
): CompileResult {
  const parsed = parseSource(source);
  return compileProgram(parsed.program, options, parsed.diagnostics);
}

export function compileProgram(
  program: Program,
  options: CompileOptions = {},
  priorDiagnostics: readonly Diagnostic[] = [],
): CompileResult {
  const diagnostics = [...priorDiagnostics];
  const space = program.space?.name ?? "anonymous";
  const frames: IRFrame[] = [];
  const frameBySimpleName = new Map<string, Frame[]>();
  const externalSymbols = new Set(options.externalSymbols ?? []);

  const register = (frame: Frame): void => {
    const matching = frameBySimpleName.get(frame.name) ?? [];
    matching.push(frame);
    frameBySimpleName.set(frame.name, matching);
    for (const node of frame.body) {
      if (node.kind === "Frame") register(node);
    }
  };
  for (const item of program.items) {
    if (item.kind === "Frame") register(item);
  }
  for (const [name, matches] of frameBySimpleName) {
    if (matches.length > 1 && matches.some((frame) => frame.span.start.column === 1)) {
      diagnostics.push(
        diagnostic(
          "E_DUPLICATE_FRAME",
          "error",
          "compile",
          `Frame name ${name} is ambiguous.`,
          matches[1]!.headerSpan,
          "Give top-level frames globally unique names.",
        ),
      );
    }
  }

  analyzeTypesAndCalls(program, frameBySimpleName, diagnostics);

  const resolveReference = (target: string, span: SourceSpan): void => {
    if (
      !options.strictReferences ||
      target.includes(".") ||
      frameBySimpleName.has(target) ||
      externalSymbols.has(target) ||
      builtinTargets.has(target)
    ) {
      return;
    }
    diagnostics.push(
      diagnostic(
        "N3001",
        "warning",
        "compile",
        `Reference ${target} is not declared in this space.`,
        span,
        "Declare it as a frame or pass it as an external symbol.",
      ),
    );
  };

  const compileFrame = (
    frame: Frame,
    parentQualifiedName: string | null,
    parentId: string | null,
  ): IRFrame => {
    const qualifiedName = parentQualifiedName
      ? `${parentQualifiedName}.${frame.name}`
      : frame.name;
    const id = `${space}::${frame.frameKind}::${qualifiedName}`;
    const contract: IRContract = { inputs: [], output: null, failure: null };
    const requirements: IRRequirement[] = [];
    const uses: IRFrame["uses"] = [];
    const budgets: Record<string, IRValue> = Object.create(null) as Record<
      string,
      IRValue
    >;
    const instructions: IRInstruction[] = [];
    const bindings = new Set<string>();
    let sandbox: string | null = null;
    let instructionIndex = 0;

    const instructionId = (): string => `${id}#${instructionIndex++}`;

    const compileStatement = (statement: Statement): void => {
      switch (statement.verb) {
        case "take": {
          if (bindings.has(statement.binding)) {
            diagnostics.push(
              diagnostic(
                "E_REBIND",
                "error",
                "compile",
                `Binding ${statement.binding} is immutable and already exists.`,
                statement.span,
              ),
            );
          }
          bindings.add(statement.binding);
          const source = statement.source ? compileValue(statement.source, diagnostics) : null;
          contract.inputs.push({
            name: statement.binding,
            type: statement.valueType ? compileType(statement.valueType) : null,
            source,
            span: statement.span,
          });
          instructions.push({
            op: "take",
            id: instructionId(),
            name: statement.binding,
            source,
            span: statement.span,
          });
          break;
        }
        case "give":
          if (statement.valueType) {
            contract.output = compileType(statement.valueType);
          }
          if (statement.source) {
            instructions.push({
              op: "give",
              id: instructionId(),
              value: compileValue(statement.source, diagnostics),
              span: statement.span,
            });
          } else if (statement.value) {
            checkExpressionReferences(
              statement.value,
              bindings,
              diagnostics,
              options.strictReferences ?? false,
            );
            instructions.push({
              op: "give",
              id: instructionId(),
              value: compileValue(statement.value, diagnostics),
              span: statement.span,
            });
          }
          break;
        case "fail":
          contract.failure = compileType(statement.faultType);
          break;
        case "use": {
          const target = referenceName(statement.target);
          resolveReference(target, statement.target.span);
          uses.push({ target, alias: statement.alias, span: statement.span });
          instructions.push({
            op: "use",
            id: instructionId(),
            target,
            alias: statement.alias,
            span: statement.span,
          });
          break;
        }
        case "need": {
          const targets = statement.targets.map(referenceName);
          for (const target of targets) {
            requirements.push({
              kind: statement.requirement,
              target,
              span: statement.span,
            });
          }
          instructions.push({
            op: "need",
            id: instructionId(),
            requirement: statement.requirement,
            targets,
            span: statement.span,
          });
          break;
        }
        case "grant": {
          if (frame.frameKind !== "permission") {
            diagnostics.push(
              diagnostic(
                "E_SELF_GRANT",
                "error",
                "compile",
                `${frame.frameKind} ${frame.name} cannot grant authority to itself.`,
                statement.span,
                "Move grant to the top-level deployment composition or a permission success path.",
              ),
            );
          }
          instructions.push({
            op: "grant",
            id: instructionId(),
            capabilities: statement.capabilities.map(referenceName),
            target: statement.target ? referenceName(statement.target) : null,
            span: statement.span,
          });
          break;
        }
        case "within": {
          const limit = compileValue(statement.limit, diagnostics);
          sandbox =
            statement.limit.kind === "ReferenceExpression"
              ? referenceName(statement.limit)
              : sandbox;
          instructions.push({
            op: "within",
            id: instructionId(),
            sandbox,
            limit,
            span: statement.span,
          });
          break;
        }
        case "budget": {
          const limit = compileValue(statement.limit, diagnostics);
          budgets[statement.resource] = limit;
          instructions.push({
            op: "budget",
            id: instructionId(),
            resource: statement.resource,
            limit,
            span: statement.span,
          });
          break;
        }
        case "let":
          if (bindings.has(statement.binding)) {
            diagnostics.push(
              diagnostic(
                "E_REBIND",
                "error",
                "compile",
                `Binding ${statement.binding} is immutable and cannot be replaced.`,
                statement.span,
              ),
            );
          }
          checkExpressionReferences(
            statement.value,
            bindings,
            diagnostics,
            options.strictReferences ?? false,
          );
          bindings.add(statement.binding);
          instructions.push({
            op: "let",
            id: instructionId(),
            name: statement.binding,
            value: compileValue(statement.value, diagnostics),
            span: statement.span,
          });
          break;
        case "emit":
          checkExpressionReferences(
            statement.value,
            bindings,
            diagnostics,
            options.strictReferences ?? false,
          );
          instructions.push({
            op: "emit",
            id: instructionId(),
            value: compileValue(statement.value, diagnostics),
            span: statement.span,
          });
          break;
        case "yield":
          checkExpressionReferences(
            statement.value,
            bindings,
            diagnostics,
            options.strictReferences ?? false,
          );
          instructions.push({
            op: "yield",
            id: instructionId(),
            value: compileValue(statement.value, diagnostics),
            span: statement.span,
          });
          break;
        case "invoke":
        case "call": {
          const target = referenceName(statement.target);
          resolveReference(target, statement.target.span);
          if (statement.binding) bindings.add(statement.binding);
          instructions.push({
            op: "invoke",
            id: instructionId(),
            mode: statement.verb,
            target,
            arguments: statement.arguments.map((value) => compileValue(value, diagnostics)),
            binding: statement.binding,
            span: statement.span,
          });
          break;
        }
        case "launch": {
          const target = referenceName(statement.target);
          resolveReference(target, statement.target.span);
          if (statement.binding) bindings.add(statement.binding);
          instructions.push({
            op: "launch",
            id: instructionId(),
            target,
            arguments: statement.arguments.map((value) => compileValue(value, diagnostics)),
            binding: statement.binding,
            span: statement.span,
          });
          break;
        }
        case "weave":
          if (statement.binding) bindings.add(statement.binding);
          instructions.push({
            op: "weave",
            id: instructionId(),
            branches: statement.branches.map((branch, index) => ({
              name: branch.target.path.at(-1) ?? `branch-${index + 1}`,
              target: referenceName(branch.target),
              arguments: branch.arguments.map((value) => compileValue(value, diagnostics)),
            })),
            binding: statement.binding,
            settle: "all",
            span: statement.span,
          });
          break;
        case "attach":
          instructions.push({
            op: "attach",
            id: instructionId(),
            value: compileValue(statement.value, diagnostics),
            role: statement.role,
            span: statement.span,
          });
          break;
        case "instruction":
          instructions.push({
            op: "instruction",
            id: instructionId(),
            value: compileValue(statement.value, diagnostics),
            span: statement.span,
          });
          break;
        case "field":
        case "effect":
        case "transport":
        case "endpoint":
        case "pin":
        case "overflow":
        case "filesystem":
        case "network":
        case "process":
        case "limit":
        case "settle":
        case "stage":
        case "recover":
        case "compensate":
        case "resource":
        case "needs":
        case "model":
        case "remember":
        case "handle":
        case "slot":
        case "expect":
        case "lifetime":
        case "merge":
        case "retention":
        case "compact":
        case "trust":
        case "import":
        case "command":
        case "protocol":
        case "clock":
        case "shape":
        case "permission":
        case "context":
        case "fault":
        case "version":
        case "edition":
        case "source":
        case "entry":
        case "runtime":
        case "expose":
        case "require":
        case "authority":
        case "diagnostics":
          instructions.push({
            op: "directive",
            id: instructionId(),
            verb: statement.verb,
            arguments: statement.arguments.map((value) => compileValue(value, diagnostics)),
            span: statement.span,
          });
          break;
      }
    };

    for (const node of frame.body) {
      if (node.kind === "Statement") {
        compileStatement(node);
        continue;
      }
      const nested = compileFrame(node, qualifiedName, id);
      if (node.frameKind === "weave") {
        bindings.add(node.name);
        instructions.push({
          op: "launch",
          id: instructionId(),
          target: nested.qualifiedName,
          arguments: [],
          binding: node.name,
          span: node.span,
        });
      }
    }

    if (frame.frameKind === "weave") {
      const branches = frame.body
        .filter((node): node is Frame => node.kind === "Frame" && node.frameKind === "branch")
        .map((branch) => ({
          name: branch.name,
          target: `${qualifiedName}.${branch.name}`,
          arguments: [],
        }));
      const settleNode = frame.body.find(
        (node): node is Statement =>
          node.kind === "Statement" && node.verb === "settle",
      );
      const settleValue =
        settleNode?.verb === "settle" &&
        settleNode.arguments[0]?.kind === "ReferenceExpression"
          ? referenceName(settleNode.arguments[0])
          : "all";
      instructions.unshift({
        op: "weave",
        id: `${id}#weave`,
        branches,
        binding: frame.name,
        settle:
          settleValue === "all_ok" || settleValue === "first_ok"
            ? settleValue
            : "all",
        span: frame.span,
      });
    }

    const irFrame: IRFrame = {
      id,
      kind: frame.frameKind,
      name: frame.name,
      qualifiedName,
      parentId,
      parameters: frame.parameters,
      contract,
      requirements,
      uses,
      sandbox,
      budgets,
      instructions,
      sourceSpan: frame.span,
    };
    frames.push(irFrame);
    return irFrame;
  };

  for (const item of program.items) {
    if (item.kind === "Frame") compileFrame(item, null, null);
  }

  const entry: IRInstruction[] = [];
  const permissions = new Set<string>();
  let entryIndex = 0;
  for (const item of program.items) {
    if (item.kind === "Frame") continue;
    const id = `${space}::entry#${entryIndex++}`;
    switch (item.verb) {
      case "grant":
        for (const capability of item.capabilities) {
          permissions.add(referenceName(capability));
        }
        entry.push({
          op: "grant",
          id,
          capabilities: item.capabilities.map(referenceName),
          target: item.target ? referenceName(item.target) : null,
          span: item.span,
        });
        break;
      case "launch":
        entry.push({
          op: "launch",
          id,
          target: referenceName(item.target),
          arguments: item.arguments.map((value) => compileValue(value, diagnostics)),
          binding: item.binding,
          span: item.span,
        });
        break;
      case "invoke":
      case "call":
        entry.push({
          op: "invoke",
          id,
          mode: item.verb,
          target: referenceName(item.target),
          arguments: item.arguments.map((value) => compileValue(value, diagnostics)),
          binding: item.binding,
          span: item.span,
        });
        break;
      case "emit":
        entry.push({
          op: "emit",
          id,
          value: compileValue(item.value, diagnostics),
          span: item.span,
        });
        break;
      case "yield":
        entry.push({
          op: "yield",
          id,
          value: compileValue(item.value, diagnostics),
          span: item.span,
        });
        break;
      default:
        diagnostics.push(
          diagnostic(
            "N3002",
            "warning",
            "compile",
            `${item.verb} has no effect at the deployment root.`,
            item.span,
          ),
        );
        break;
    }
  }

  const ir: IRProgram = {
    version: IR_VERSION,
    space,
    edition: program.edition?.value ?? 1,
    frames,
    entry,
    permissions: [...permissions].sort(),
    sourceSpan: program.span,
  };
  return { ir, program, diagnostics, ok: !hasErrors(diagnostics) };
}

const builtinTargets = new Set(BUILTIN_NAMES);

function compileType(type: TypeNode): IRType {
  switch (type.kind) {
    case "TypeReference":
      return { kind: "name", path: type.path };
    case "TypeApplication":
      return {
        kind: "apply",
        base: compileType(type.base),
        arguments: type.arguments.map(compileType),
      };
    case "UnionType":
      return { kind: "union", options: type.options.map(compileType) };
    case "OptionalType":
      return { kind: "optional", value: compileType(type.value) };
    case "MissingType":
      return { kind: "any" };
  }
}

function compileValue(expression: Expression, diagnostics: Diagnostic[]): IRValue {
  switch (expression.kind) {
    case "StringLiteral":
    case "BooleanLiteral":
    case "NothingLiteral":
      return { kind: "literal", value: expression.value };
    case "NumberLiteral":
      return expression.unit
        ? { kind: "literal", value: expression.value, unit: expression.unit }
        : { kind: "literal", value: expression.value };
    case "ReferenceExpression":
      return { kind: "reference", path: expression.path };
    case "ListExpression":
      return { kind: "list", items: expression.items.map((item) => compileValue(item, diagnostics)) };
    case "RecordExpression": {
      const entries: Record<string, IRValue> = Object.create(null) as Record<string, IRValue>;
      for (const entry of expression.entries) {
        if (Object.hasOwn(entries, entry.key)) {
          diagnostics.push(
            diagnostic(
              "E_DUPLICATE_FIELD",
              "error",
              "compile",
              `Record field ${entry.key} appears more than once.`,
              entry.span,
            ),
          );
        }
        entries[entry.key] = compileValue(entry.value, diagnostics);
      }
      return { kind: "record", entries };
    }
    case "GroupExpression":
      return compileValue(expression.value, diagnostics);
    case "CallExpression": {
      const arguments_: Record<string, IRValue> = Object.create(null) as Record<
        string,
        IRValue
      >;
      for (const argument of expression.arguments) {
        if (Object.hasOwn(arguments_, argument.name)) {
          diagnostics.push(
            diagnostic(
              "E_DUPLICATE_ARGUMENT",
              "error",
              "compile",
              `Call argument :${argument.name} appears more than once.`,
              argument.span,
            ),
          );
        }
        arguments_[argument.name] = compileValue(argument.value, diagnostics);
      }
      return {
        kind: "call",
        verb: expression.verb,
        target: referenceName(expression.target),
        arguments: arguments_,
        span: expression.span,
      };
    }
    case "MissingExpression":
      return { kind: "missing" };
  }
}

function checkExpressionReferences(
  expression: Expression,
  bindings: ReadonlySet<string>,
  diagnostics: Diagnostic[],
  strict: boolean,
): void {
  if (!strict) return;
  switch (expression.kind) {
    case "ReferenceExpression": {
      const root = expression.path[0] ?? "";
      if (!bindings.has(root)) {
        diagnostics.push(
          diagnostic(
            "E_UNKNOWN_BINDING",
            "error",
            "compile",
            `Binding ${root} is not available here.`,
            expression.span,
          ),
        );
      }
      break;
    }
    case "ListExpression":
      expression.items.forEach((item) =>
        checkExpressionReferences(item, bindings, diagnostics, strict),
      );
      break;
    case "RecordExpression":
      expression.entries.forEach((entry) =>
        checkExpressionReferences(entry.value, bindings, diagnostics, strict),
      );
      break;
    case "GroupExpression":
      checkExpressionReferences(expression.value, bindings, diagnostics, strict);
      break;
    case "CallExpression":
      expression.arguments.forEach((argument) =>
        checkExpressionReferences(argument.value, bindings, diagnostics, strict),
      );
      break;
    default:
      break;
  }
}

type StaticType = BuiltinValueType | "Unknown";

interface TaskParameterSignature {
  name: string;
  type: StaticType;
  required: boolean;
}

interface TaskSignature {
  name: string;
  parameters: TaskParameterSignature[];
  returns: StaticType;
}

function analyzeTypesAndCalls(
  program: Program,
  framesByName: ReadonlyMap<string, Frame[]>,
  diagnostics: Diagnostic[],
): void {
  const tasks = new Map<string, TaskSignature>();
  for (const [name, matches] of framesByName) {
    if (matches.length !== 1 || matches[0]?.frameKind !== "task") continue;
    const frame = matches[0];
    const statements = frame.body.filter(
      (node): node is Statement => node.kind === "Statement",
    );
    const parameters = statements
      .filter((statement) => statement.verb === "take")
      .map((statement) => ({
        name: statement.binding,
        type: statement.valueType ? staticTypeFromTypeNode(statement.valueType) : "Unknown",
        required: statement.source === null,
      }));
    const output = statements.find(
      (statement) => statement.verb === "give" && statement.valueType,
    );
    tasks.set(name, {
      name,
      parameters,
      returns:
        output?.verb === "give" && output.valueType
          ? staticTypeFromTypeNode(output.valueType)
          : "Unknown",
    });
  }

  const analyzeFrame = (frame: Frame): void => {
    const bindings = new Map<string, StaticType>();
    const statements = frame.body.filter(
      (node): node is Statement => node.kind === "Statement",
    );
    const outputStatement = statements.find(
      (statement) => statement.verb === "give" && statement.valueType,
    );
    const outputType =
      outputStatement?.verb === "give" && outputStatement.valueType
        ? staticTypeFromTypeNode(outputStatement.valueType)
        : "Unknown";

    for (const node of frame.body) {
      if (node.kind === "Frame") {
        analyzeFrame(node);
        continue;
      }
      analyzeStatement(node, bindings, outputType, tasks, diagnostics);
    }
  };

  const rootBindings = new Map<string, StaticType>();
  for (const item of program.items) {
    if (item.kind === "Frame") analyzeFrame(item);
    else analyzeStatement(item, rootBindings, "Unknown", tasks, diagnostics);
  }
}

function analyzeStatement(
  statement: Statement,
  bindings: Map<string, StaticType>,
  outputType: StaticType,
  tasks: ReadonlyMap<string, TaskSignature>,
  diagnostics: Diagnostic[],
): void {
  switch (statement.verb) {
    case "take": {
      const declared = statement.valueType
        ? staticTypeFromTypeNode(statement.valueType)
        : "Unknown";
      if (statement.source) {
        const sourceType = inferExpressionType(
          statement.source,
          bindings,
          tasks,
          diagnostics,
        );
        reportTypeMismatch(
          declared,
          sourceType,
          statement.source.span,
          `take ${statement.binding}`,
          diagnostics,
        );
      }
      bindings.set(statement.binding, declared);
      break;
    }
    case "give": {
      const value = statement.source ?? statement.value;
      if (value) {
        const actual = inferExpressionType(value, bindings, tasks, diagnostics);
        const expected = statement.valueType
          ? staticTypeFromTypeNode(statement.valueType)
          : outputType;
        reportTypeMismatch(expected, actual, value.span, "give", diagnostics);
      }
      break;
    }
    case "let": {
      const actual = inferExpressionType(
        statement.value,
        bindings,
        tasks,
        diagnostics,
      );
      const declared = statement.valueType
        ? staticTypeFromTypeNode(statement.valueType)
        : actual;
      reportTypeMismatch(
        declared,
        actual,
        statement.value.span,
        `let ${statement.binding}`,
        diagnostics,
      );
      bindings.set(statement.binding, declared);
      break;
    }
    case "yield": {
      const actual = inferExpressionType(
        statement.value,
        bindings,
        tasks,
        diagnostics,
      );
      reportTypeMismatch(outputType, actual, statement.value.span, "yield", diagnostics);
      break;
    }
    case "emit":
    case "instruction":
      inferExpressionType(statement.value, bindings, tasks, diagnostics);
      break;
    case "attach":
      inferExpressionType(statement.value, bindings, tasks, diagnostics);
      break;
    case "within":
      inferExpressionType(statement.limit, bindings, tasks, diagnostics);
      break;
    case "budget":
      inferExpressionType(statement.limit, bindings, tasks, diagnostics);
      break;
    case "invoke":
    case "call":
    case "launch":
      for (const argument of statement.arguments) {
        inferExpressionType(argument, bindings, tasks, diagnostics);
      }
      if (statement.binding) bindings.set(statement.binding, "Unknown");
      break;
    case "weave":
      for (const branch of statement.branches) {
        for (const argument of branch.arguments) {
          inferExpressionType(argument, bindings, tasks, diagnostics);
        }
      }
      if (statement.binding) bindings.set(statement.binding, "Record");
      break;
    case "field":
    case "effect":
    case "transport":
    case "endpoint":
    case "pin":
    case "overflow":
    case "filesystem":
    case "network":
    case "process":
    case "limit":
    case "settle":
    case "stage":
    case "recover":
    case "compensate":
    case "resource":
    case "needs":
    case "model":
    case "remember":
    case "handle":
    case "slot":
    case "expect":
    case "lifetime":
    case "merge":
    case "retention":
    case "compact":
    case "trust":
    case "import":
    case "command":
    case "protocol":
    case "clock":
    case "shape":
    case "permission":
    case "context":
    case "fault":
    case "version":
    case "edition":
    case "source":
    case "entry":
    case "runtime":
    case "expose":
    case "require":
    case "authority":
    case "diagnostics":
      for (const argument of statement.arguments) {
        inferExpressionType(argument, bindings, tasks, diagnostics);
      }
      break;
    case "use":
    case "need":
    case "grant":
    case "fail":
      break;
  }
}

function inferExpressionType(
  expression: Expression,
  bindings: ReadonlyMap<string, StaticType>,
  tasks: ReadonlyMap<string, TaskSignature>,
  diagnostics: Diagnostic[],
): StaticType {
  switch (expression.kind) {
    case "StringLiteral":
      return "Text";
    case "NumberLiteral":
      return "Number";
    case "BooleanLiteral":
      return "Bool";
    case "NothingLiteral":
      return "Nothing";
    case "ReferenceExpression":
      return bindings.get(expression.path[0] ?? "") ?? "Unknown";
    case "ListExpression":
      for (const item of expression.items) {
        inferExpressionType(item, bindings, tasks, diagnostics);
      }
      return "List";
    case "RecordExpression":
      for (const entry of expression.entries) {
        inferExpressionType(entry.value, bindings, tasks, diagnostics);
      }
      return "Record";
    case "GroupExpression":
      return inferExpressionType(expression.value, bindings, tasks, diagnostics);
    case "MissingExpression":
      return "Unknown";
    case "CallExpression":
      return inferCallType(expression, bindings, tasks, diagnostics);
  }
}

function inferCallType(
  expression: Extract<Expression, { kind: "CallExpression" }>,
  bindings: ReadonlyMap<string, StaticType>,
  tasks: ReadonlyMap<string, TaskSignature>,
  diagnostics: Diagnostic[],
): StaticType {
  const target = referenceName(expression.target);
  const argumentTypes = new Map<string, StaticType>();
  for (const argument of expression.arguments) {
    argumentTypes.set(
      argument.name,
      inferExpressionType(argument.value, bindings, tasks, diagnostics),
    );
  }

  const builtin = getBuiltinSignature(target);
  if (builtin) {
    validateNamedArguments(
      "builtin",
      target,
      expression.arguments,
      builtin.parameters,
      argumentTypes,
      expression.span,
      diagnostics,
    );
    if (target === "Core.if") {
      return mergeStaticTypes(argumentTypes.get("then"), argumentTypes.get("else"));
    }
    if (target === "Core.coalesce") {
      return mergeStaticTypes(argumentTypes.get("value"), argumentTypes.get("fallback"));
    }
    return builtin.returns;
  }

  const task = tasks.get(target);
  if (task) {
    validateNamedArguments(
      "task",
      target,
      expression.arguments,
      task.parameters,
      argumentTypes,
      expression.span,
      diagnostics,
    );
    return task.returns;
  }
  return "Unknown";
}

function validateNamedArguments(
  kind: "builtin" | "task",
  target: string,
  arguments_: readonly NamedArgument[],
  parameters: readonly {
    name: string;
    type: BuiltinValueType | StaticType;
    required: boolean;
    aliases?: readonly string[];
  }[],
  argumentTypes: ReadonlyMap<string, StaticType>,
  callSpan: SourceSpan,
  diagnostics: Diagnostic[],
): void {
  const parameterByName = new Map(
    parameters.flatMap((parameter) => [
      [parameter.name, parameter] as const,
      ...(parameter.aliases ?? []).map(
        (alias) => [alias, parameter] as const,
      ),
    ]),
  );
  const supplied = new Set(arguments_.map((argument) => argument.name));
  const codePrefix = kind === "builtin" ? "BUILTIN" : "TASK";
  for (const parameter of parameters) {
    const acceptedNames = [
      parameter.name,
      ...(parameter.aliases ?? []),
    ];
    if (
      parameter.required &&
      !acceptedNames.some((name) => supplied.has(name))
    ) {
      diagnostics.push(
        diagnostic(
          `E_${codePrefix}_MISSING_ARGUMENT`,
          "error",
          "compile",
          `${target} requires named argument :${parameter.name}.`,
          callSpan,
        ),
      );
    }
  }
  for (const argument of arguments_) {
    const parameter = parameterByName.get(argument.name);
    if (!parameter) {
      diagnostics.push(
        diagnostic(
          `E_${codePrefix}_UNKNOWN_ARGUMENT`,
          "error",
          "compile",
          `${target} does not accept named argument :${argument.name}.`,
          argument.span,
        ),
      );
      continue;
    }
    reportTypeMismatch(
      parameter.type,
      argumentTypes.get(argument.name) ?? "Unknown",
      argument.value.span,
      `${target} :${argument.name}`,
      diagnostics,
    );
  }
}

function staticTypeFromTypeNode(type: TypeNode): StaticType {
  switch (type.kind) {
    case "MissingType":
      return "Unknown";
    case "OptionalType":
      return staticTypeFromTypeNode(type.value);
    case "UnionType": {
      const types = type.options.map(staticTypeFromTypeNode);
      return types.every((candidate) => candidate === types[0])
        ? types[0] ?? "Unknown"
        : "Unknown";
    }
    case "TypeApplication":
      return staticTypeFromName(type.base.path.at(-1) ?? "");
    case "TypeReference":
      return staticTypeFromName(type.path.at(-1) ?? "");
  }
}

function staticTypeFromName(name: string): StaticType {
  if (name === "Bool" || name === "Boolean") return "Bool";
  if (["Number", "Int", "Decimal", "Duration"].includes(name)) return "Number";
  if (["Text", "String", "Url", "Bytes"].includes(name)) return "Text";
  if (["List", "Stream"].includes(name)) return "List";
  if (["Record", "Map", "Json"].includes(name)) return "Record";
  if (["Outcome", "Result"].includes(name)) return "Outcome";
  if (["Nothing", "None"].includes(name)) return "Nothing";
  if (name === "Any") return "Any";
  return "Unknown";
}

function reportTypeMismatch(
  expected: StaticType,
  actual: StaticType,
  span: SourceSpan,
  context: string,
  diagnostics: Diagnostic[],
): void {
  if (
    expected === "Any" ||
    expected === "Unknown" ||
    actual === "Any" ||
    actual === "Unknown" ||
    expected === actual
  ) {
    return;
  }
  diagnostics.push(
    diagnostic(
      "E_TYPE_MISMATCH",
      "error",
      "compile",
      `${context} requires ${expected}, received ${actual}.`,
      span,
    ),
  );
}

function mergeStaticTypes(
  left: StaticType | undefined,
  right: StaticType | undefined,
): StaticType {
  if (!left) return right ?? "Unknown";
  if (!right) return left;
  if (left === right) return left;
  if (left === "Nothing") return right;
  if (right === "Nothing") return left;
  return "Unknown";
}
