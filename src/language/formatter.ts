import {
  type Expression,
  type Frame,
  type FrameBodyNode,
  type Program,
  type Statement,
  type TypeNode,
} from "./ast.js";
import type { Diagnostic } from "./diagnostics.js";
import { parseSource } from "./parser.js";

export interface FormatOptions {
  indent?: string;
  newline?: "\n" | "\r\n";
  finalNewline?: boolean;
}

export interface FormatResult {
  code: string;
  program: Program;
  diagnostics: Diagnostic[];
}

const defaultOptions: Required<FormatOptions> = {
  indent: "  ",
  newline: "\n",
  finalNewline: true,
};

export function formatSource(
  source: string,
  options: FormatOptions = {},
): FormatResult {
  const parsed = parseSource(source);
  return {
    code: formatProgram(parsed.program, options),
    program: parsed.program,
    diagnostics: parsed.diagnostics,
  };
}

export function formatProgram(
  program: Program,
  options: FormatOptions = {},
): string {
  const settings = { ...defaultOptions, ...options };
  const groups: string[] = [];
  if (program.space) groups.push(`space ${program.space.name}`);
  if (program.edition) groups.push(`edition ${program.edition.value}`);
  for (const item of program.items) {
    groups.push(
      item.kind === "Frame"
        ? formatFrame(item, 0, settings)
        : formatStatement(item, 0, settings),
    );
  }
  const code = groups.join(settings.newline + settings.newline);
  return settings.finalNewline && code.length > 0 ? code + settings.newline : code;
}

function formatFrame(
  frame: Frame,
  depth: number,
  options: Required<FormatOptions>,
): string {
  const indentation = options.indent.repeat(depth);
  const suffix = frame.parameters.length > 0 ? ` ${frame.parameters.join(" ")}` : "";
  const lines = [`${indentation}${frame.frameKind} ${frame.name}${suffix}`];
  for (const node of frame.body) {
    lines.push(formatBodyNode(node, depth + 1, options));
  }
  lines.push(`${indentation}/${frame.frameKind}`);
  return lines.join(options.newline);
}

function formatBodyNode(
  node: FrameBodyNode,
  depth: number,
  options: Required<FormatOptions>,
): string {
  return node.kind === "Frame"
    ? formatFrame(node, depth, options)
    : formatStatement(node, depth, options);
}

function formatStatement(
  statement: Statement,
  depth: number,
  options: Required<FormatOptions>,
): string {
  const indentation = options.indent.repeat(depth);
  let value: string;
  switch (statement.verb) {
    case "take":
      value = `take ${statement.binding}${
        statement.valueType ? ` ${formatType(statement.valueType)}` : ""
      }${statement.source ? ` from ${formatExpression(statement.source)}` : ""}${
        statement.trust ? ` trust ${statement.trust}` : ""
      }`;
      break;
    case "give":
      value = `give ${
        statement.valueType
          ? formatType(statement.valueType)
          : statement.value
            ? formatExpression(statement.value)
            : "Nothing"
      }${statement.source ? ` from ${formatExpression(statement.source)}` : ""}`;
      break;
    case "use":
      value = `use ${formatReference(statement.target)}${
        statement.alias ? ` as ${statement.alias}` : ""
      }`;
      break;
    case "need":
      value = `need ${
        statement.requirement === "capability" ? "" : `${statement.requirement} `
      }${statement.targets.map(formatReference).join(", ")}`;
      break;
    case "grant":
      value = `grant ${statement.capabilities.map(formatReference).join(", ")}${
        statement.target ? ` to ${formatReference(statement.target)}` : ""
      }`;
      break;
    case "within":
      value = `within ${
        statement.limit.kind === "ReferenceExpression" ? "sandbox " : ""
      }${formatExpression(statement.limit)}`;
      break;
    case "budget":
      value = `budget ${statement.resource} ${formatExpression(statement.limit)}`;
      break;
    case "let":
      value = `let ${statement.binding}${
        statement.valueType ? ` ${formatType(statement.valueType)}` : ""
      } = ${formatExpression(statement.value)}`;
      break;
    case "emit":
      value = `emit ${formatExpression(statement.value)}`;
      break;
    case "yield":
      value = `yield ${formatExpression(statement.value)}`;
      break;
    case "invoke":
    case "call":
      value = `${statement.bracketed ? "[call]" : statement.verb} ${formatReference(
        statement.target,
      )}${formatArguments(statement.arguments)}${
        statement.binding ? ` as ${statement.binding}` : ""
      }`;
      break;
    case "launch":
      value = `launch ${formatReference(statement.target)}${formatArguments(
        statement.arguments,
      )}${statement.binding ? ` as ${statement.binding}` : ""}`;
      break;
    case "weave":
      value = `weave ${statement.branches
        .map(
          (branch) =>
            `${formatReference(branch.target)}${formatArguments(branch.arguments)}`,
        )
        .join(" | ")}${statement.binding ? ` as ${statement.binding}` : ""}`;
      break;
    case "fail":
      value = `fail ${formatType(statement.faultType)}`;
      break;
    case "instruction":
      value = `instruction ${formatExpression(statement.value)}`;
      break;
    case "attach":
      value = `attach ${formatExpression(statement.value)} as ${statement.role}`;
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
      value = `${statement.verb}${
        statement.arguments.length > 0
          ? ` ${statement.arguments.map(formatExpression).join(" ")}`
          : ""
      }`;
      break;
  }
  return indentation + value;
}

function formatArguments(arguments_: Expression[]): string {
  return arguments_.length > 0
    ? ` with ${arguments_.map(formatExpression).join(", ")}`
    : "";
}

export function formatExpression(expression: Expression): string {
  switch (expression.kind) {
    case "StringLiteral":
      return formatString(expression.value, expression.quote);
    case "NumberLiteral":
      return `${Number.isFinite(expression.value) ? expression.value : 0}${
        expression.unit ?? ""
      }`;
    case "BooleanLiteral":
      return expression.value ? "true" : "false";
    case "NothingLiteral":
      return "nothing";
    case "ReferenceExpression":
      return formatReference(expression);
    case "ListExpression":
      return `[list${
        expression.items.length > 0
          ? ` ${expression.items.map(formatExpression).join(" ")}`
          : ""
      }]`;
    case "RecordExpression":
      return `[record${
        expression.entries.length > 0
          ? ` ${expression.entries
              .map(
                (entry) =>
                  `:${formatRecordKey(entry.key)} ${formatExpression(entry.value)}`,
              )
              .join(" ")}`
          : ""
      }]`;
    case "GroupExpression":
      return `(${formatExpression(expression.value)})`;
    case "CallExpression":
      return `[${expression.verb} ${formatReference(expression.target)}${
        expression.arguments.length > 0
          ? ` ${expression.arguments
              .map((argument) => `:${argument.name} ${formatExpression(argument.value)}`)
              .join(" ")}`
          : ""
      }]`;
    case "MissingExpression":
      return "nothing";
  }
}

export function formatType(type: TypeNode): string {
  switch (type.kind) {
    case "TypeReference":
      return type.path.join(".");
    case "TypeApplication":
      return `[${formatType(type.base)}${
        type.arguments.length > 0
          ? ` ${type.arguments.map(formatType).join(" ")}`
          : ""
      }]`;
    case "UnionType":
      return type.options.map(formatType).join(" | ");
    case "OptionalType":
      return `${formatType(type.value)}?`;
    case "MissingType":
      return "Any";
  }
}

function formatReference(reference: { path: string[] }): string {
  return reference.path.join(".");
}

function formatString(
  value: string,
  quote: "angle" | "double" | "single",
): string {
  if (quote === "angle") {
    return `«${value
      .replaceAll("\\", "\\\\")
      .replaceAll("«", "\\«")
      .replaceAll("»", "\\»")}»`;
  }
  if (quote === "single") {
    return `'${value
      .replaceAll("\\", "\\\\")
      .replaceAll("'", "\\'")
      .replaceAll("\n", "\\n")}'`;
  }
  return JSON.stringify(value);
}

function formatRecordKey(key: string): string {
  return /^[\p{L}_][\p{L}\p{N}_-]*$/u.test(key)
    ? key
    : `«${key.replaceAll("\\", "\\\\").replaceAll("»", "\\»")}»`;
}
