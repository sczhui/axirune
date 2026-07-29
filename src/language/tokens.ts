import type { SourceSpan } from "./ast.js";

export const KEYWORDS = [
  "space",
  "task",
  "tool",
  "prompt",
  "memory",
  "agent",
  "workflow",
  "capability",
  "sandbox",
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
  "from",
  "as",
  "to",
  "with",
  "true",
  "false",
  "nothing",
  "none",
  "context",
  "permission",
  "shape",
  "mcp",
  "branch",
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
  "list",
  "record",
  "data",
  "choice",
  "fault",
  "form",
  "edition",
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
  "package",
  "version",
  "source",
  "entry",
  "runtime",
  "expose",
  "require",
  "authority",
  "diagnostics",
] as const;

export type Keyword = (typeof KEYWORDS)[number];

export type TokenKind =
  | "eof"
  | "newline"
  | "identifier"
  | "keyword"
  | "number"
  | "string"
  | "slash"
  | "colon"
  | "equal"
  | "comma"
  | "dot"
  | "left-bracket"
  | "right-bracket"
  | "left-paren"
  | "right-paren"
  | "less"
  | "greater"
  | "pipe"
  | "question"
  | "unknown";

export interface Token {
  kind: TokenKind;
  lexeme: string;
  value?: string;
  span: SourceSpan;
}

export type WordToken = Token & { kind: "identifier" | "keyword" };

const keywordSet: ReadonlySet<string> = new Set(KEYWORDS);

export function isKeyword(value: string): value is Keyword {
  return keywordSet.has(value);
}

export function isWordToken(token: Token | undefined): token is WordToken {
  return token?.kind === "identifier" || token?.kind === "keyword";
}
