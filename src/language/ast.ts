/**
 * Axirune's loss-light, JSON-serializable syntax tree.
 *
 * Every meaningful node owns a source span.  The compiler never relies on
 * indentation or trivia: frames are closed explicitly and statements are
 * identified by their leading speech act.
 */

export const FRAME_KINDS = [
  "task",
  "tool",
  "prompt",
  "memory",
  "agent",
  "workflow",
  "capability",
  "sandbox",
  "shape",
  "mcp",
  "context",
  "permission",
  "invoke",
  "launch",
  "weave",
  "branch",
  "choice",
  "fault",
  "form",
  "package",
] as const;

export type FrameKind = (typeof FRAME_KINDS)[number];

export const STATEMENT_VERBS = [
  "take",
  "give",
  "use",
  "need",
  "grant",
  "within",
  "budget",
  "let",
  "emit",
  "yield",
  "invoke",
  "call",
  "launch",
  "weave",
  "fail",
  "instruction",
  "attach",
  "field",
  "effect",
  "transport",
  "endpoint",
  "pin",
  "overflow",
  "filesystem",
  "network",
  "process",
  "limit",
  "settle",
  "stage",
  "recover",
  "compensate",
  "resource",
  "needs",
  "model",
  "remember",
  "handle",
  "slot",
  "expect",
  "lifetime",
  "merge",
  "retention",
  "compact",
  "trust",
  "import",
  "command",
  "protocol",
  "clock",
  "shape",
  "permission",
  "context",
  "fault",
  "version",
  "edition",
  "source",
  "entry",
  "runtime",
  "expose",
  "require",
  "authority",
  "diagnostics",
] as const;

export type StatementVerb = (typeof STATEMENT_VERBS)[number];

export interface SourcePosition {
  /** Zero-based UTF-16 offset. */
  offset: number;
  /** One-based line. */
  line: number;
  /** One-based UTF-16 column. */
  column: number;
}

export interface SourceSpan {
  start: SourcePosition;
  end: SourcePosition;
}

export interface Program {
  kind: "Program";
  space: SpaceDeclaration | null;
  edition: EditionDeclaration | null;
  items: TopLevelNode[];
  span: SourceSpan;
}

export interface EditionDeclaration {
  kind: "EditionDeclaration";
  value: number;
  span: SourceSpan;
}

export interface SpaceDeclaration {
  kind: "SpaceDeclaration";
  name: string;
  span: SourceSpan;
}

export type TopLevelNode = Frame | Statement;

export interface Frame {
  kind: "Frame";
  frameKind: FrameKind;
  name: string;
  body: FrameBodyNode[];
  /** Header words following the frame's stable name. */
  parameters: string[];
  span: SourceSpan;
  headerSpan: SourceSpan;
  closeSpan: SourceSpan | null;
}

export type FrameBodyNode = Frame | Statement;

interface StatementBase {
  kind: "Statement";
  verb: StatementVerb;
  span: SourceSpan;
}

export interface TakeStatement extends StatementBase {
  verb: "take";
  binding: string;
  valueType: TypeNode | null;
  source: Expression | null;
  trust: string | null;
}

export interface GiveStatement extends StatementBase {
  verb: "give";
  /** A contract declaration such as `give Report`. */
  valueType: TypeNode | null;
  /** A runtime value such as `give report`. */
  value: Expression | null;
  source: Expression | null;
}

export interface UseStatement extends StatementBase {
  verb: "use";
  target: ReferenceExpression;
  alias: string | null;
}

export interface NeedStatement extends StatementBase {
  verb: "need";
  requirement: "capability" | "context" | "permission" | "tool";
  targets: ReferenceExpression[];
}

export interface GrantStatement extends StatementBase {
  verb: "grant";
  capabilities: ReferenceExpression[];
  target: ReferenceExpression | null;
}

export interface WithinStatement extends StatementBase {
  verb: "within";
  limit: Expression;
}

export interface BudgetStatement extends StatementBase {
  verb: "budget";
  resource: string;
  limit: Expression;
}

export interface LetStatement extends StatementBase {
  verb: "let";
  binding: string;
  valueType: TypeNode | null;
  value: Expression;
}

export interface EmitStatement extends StatementBase {
  verb: "emit";
  value: Expression;
}

export interface YieldStatement extends StatementBase {
  verb: "yield";
  value: Expression;
}

export interface InvokeStatement extends StatementBase {
  verb: "invoke" | "call";
  target: ReferenceExpression;
  arguments: Expression[];
  binding: string | null;
  /** Retained so the formatter can preserve `[call]` when desired. */
  bracketed: boolean;
}

export interface LaunchStatement extends StatementBase {
  verb: "launch";
  target: ReferenceExpression;
  arguments: Expression[];
  binding: string | null;
}

export interface WeaveBranch {
  target: ReferenceExpression;
  arguments: Expression[];
  span: SourceSpan;
}

export interface WeaveStatement extends StatementBase {
  verb: "weave";
  branches: WeaveBranch[];
  binding: string | null;
}

export interface FailStatement extends StatementBase {
  verb: "fail";
  faultType: TypeNode;
}

export interface InstructionStatement extends StatementBase {
  verb: "instruction";
  value: Expression;
}

export interface AttachStatement extends StatementBase {
  verb: "attach";
  value: Expression;
  role: string;
}

export type DirectiveVerb =
  | "field"
  | "effect"
  | "transport"
  | "endpoint"
  | "pin"
  | "overflow"
  | "filesystem"
  | "network"
  | "process"
  | "limit"
  | "settle"
  | "stage"
  | "recover"
  | "compensate"
  | "resource"
  | "needs"
  | "model"
  | "remember"
  | "handle"
  | "slot"
  | "expect"
  | "lifetime"
  | "merge"
  | "retention"
  | "compact"
  | "trust"
  | "import"
  | "command"
  | "protocol"
  | "clock"
  | "shape"
  | "permission"
  | "context"
  | "fault"
  | "version"
  | "edition"
  | "source"
  | "entry"
  | "runtime"
  | "expose"
  | "require"
  | "authority"
  | "diagnostics";

export interface DirectiveStatement extends StatementBase {
  verb: DirectiveVerb;
  arguments: Expression[];
}

export type Statement =
  | TakeStatement
  | GiveStatement
  | UseStatement
  | NeedStatement
  | GrantStatement
  | WithinStatement
  | BudgetStatement
  | LetStatement
  | EmitStatement
  | YieldStatement
  | InvokeStatement
  | LaunchStatement
  | WeaveStatement
  | FailStatement
  | InstructionStatement
  | AttachStatement
  | DirectiveStatement;

interface ExpressionBase {
  span: SourceSpan;
}

export interface StringLiteral extends ExpressionBase {
  kind: "StringLiteral";
  value: string;
  quote: "angle" | "double" | "single";
}

export interface NumberLiteral extends ExpressionBase {
  kind: "NumberLiteral";
  value: number;
  /** A compact resource or duration suffix, for example `ms`, `s`, or `tokens`. */
  unit: string | null;
}

export interface BooleanLiteral extends ExpressionBase {
  kind: "BooleanLiteral";
  value: boolean;
}

export interface NothingLiteral extends ExpressionBase {
  kind: "NothingLiteral";
  value: null;
}

export interface ReferenceExpression extends ExpressionBase {
  kind: "ReferenceExpression";
  path: string[];
}

export interface ListExpression extends ExpressionBase {
  kind: "ListExpression";
  items: Expression[];
}

export interface RecordEntry {
  key: string;
  value: Expression;
  span: SourceSpan;
}

export interface RecordExpression extends ExpressionBase {
  kind: "RecordExpression";
  entries: RecordEntry[];
}

export interface GroupExpression extends ExpressionBase {
  kind: "GroupExpression";
  value: Expression;
}

export interface NamedArgument {
  name: string;
  value: Expression;
  span: SourceSpan;
}

export interface CallExpression extends ExpressionBase {
  kind: "CallExpression";
  verb: string;
  target: ReferenceExpression;
  arguments: NamedArgument[];
}

export interface MissingExpression extends ExpressionBase {
  kind: "MissingExpression";
}

export type Expression =
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | NothingLiteral
  | ReferenceExpression
  | ListExpression
  | RecordExpression
  | GroupExpression
  | CallExpression
  | MissingExpression;

interface TypeBase {
  span: SourceSpan;
}

export interface TypeReference extends TypeBase {
  kind: "TypeReference";
  path: string[];
}

export interface TypeApplication extends TypeBase {
  kind: "TypeApplication";
  base: TypeReference;
  arguments: TypeNode[];
}

export interface UnionType extends TypeBase {
  kind: "UnionType";
  options: TypeNode[];
}

export interface OptionalType extends TypeBase {
  kind: "OptionalType";
  value: TypeNode;
}

export interface MissingType extends TypeBase {
  kind: "MissingType";
}

export type TypeNode =
  | TypeReference
  | TypeApplication
  | UnionType
  | OptionalType
  | MissingType;

export function emptySpan(): SourceSpan {
  const origin: SourcePosition = { offset: 0, line: 1, column: 1 };
  return { start: origin, end: origin };
}

export function referenceName(reference: ReferenceExpression): string {
  return reference.path.join(".");
}
