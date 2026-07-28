import {
  referenceName,
  type Expression,
  type Frame,
  type Program,
  type SourceSpan,
  type Statement,
  type TypeNode,
} from "./ast.js";
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

const builtinTargets = new Set(["Text.join"]);

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
