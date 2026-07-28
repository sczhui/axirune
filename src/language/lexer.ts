import type { SourcePosition, SourceSpan } from "./ast.js";
import { diagnostic, type Diagnostic } from "./diagnostics.js";
import { isKeyword, type Token, type TokenKind } from "./tokens.js";

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const identifierStart = /[\p{L}_]/u;
const identifierContinue = /[\p{L}\p{N}_-]/u;

export function lexSource(source: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let offset = 0;
  let line = 1;
  let column = 1;

  const position = (): SourcePosition => ({ offset, line, column });

  const advance = (): string => {
    const character = source[offset] ?? "";
    offset += 1;
    if (character === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return character;
  };

  const add = (
    kind: TokenKind,
    start: SourcePosition,
    lexeme: string,
    value?: string,
  ): void => {
    const span: SourceSpan = { start, end: position() };
    tokens.push(value === undefined ? { kind, span, lexeme } : { kind, span, lexeme, value });
  };

  while (offset < source.length) {
    const character = source[offset] ?? "";

    if (character === " " || character === "\t" || character === "\r") {
      advance();
      continue;
    }

    if (character === "\n") {
      const start = position();
      add("newline", start, advance());
      continue;
    }

    // Nexilume comments are spoken pauses rather than C-style punctuation.
    if (character === "-" && source[offset + 1] === "-") {
      while (offset < source.length && source[offset] !== "\n") {
        advance();
      }
      continue;
    }

    const punctuation: Partial<Record<string, TokenKind>> = {
      "/": "slash",
      ":": "colon",
      "=": "equal",
      ",": "comma",
      ".": "dot",
      "[": "left-bracket",
      "]": "right-bracket",
      "(": "left-paren",
      ")": "right-paren",
      "<": "less",
      ">": "greater",
      "|": "pipe",
      "?": "question",
    };
    const punctuationKind = punctuation[character];
    if (punctuationKind) {
      const start = position();
      add(punctuationKind, start, advance());
      continue;
    }

    if (character === "«" || character === '"' || character === "'") {
      const start = position();
      const opening = advance();
      const closing = opening === "«" ? "»" : opening;
      let value = "";
      let terminated = false;

      while (offset < source.length) {
        const next = advance();
        if (next === closing) {
          terminated = true;
          break;
        }
        if (next === "\\" && offset < source.length) {
          const escaped = advance();
          const escapes: Record<string, string> = {
            n: "\n",
            r: "\r",
            t: "\t",
            "\\": "\\",
            '"': '"',
            "'": "'",
            "«": "«",
            "»": "»",
          };
          value += escapes[escaped] ?? escaped;
        } else {
          value += next;
        }
      }

      const lexeme = source.slice(start.offset, offset);
      add("string", start, lexeme, value);
      if (!terminated) {
        diagnostics.push(
          diagnostic(
            "N1001",
            "error",
            "lex",
            `Unclosed ${opening === "«" ? "angle text" : "quoted text"}.`,
            { start, end: position() },
            `Close it with ${closing}.`,
          ),
        );
      }
      continue;
    }

    const signedNumber =
      (character === "-" || character === "+") && /\d/.test(source[offset + 1] ?? "");
    if (/\d/.test(character) || signedNumber) {
      const start = position();
      if (signedNumber) advance();
      while (/[\d_]/.test(source[offset] ?? "")) advance();
      if (source[offset] === "." && /\d/.test(source[offset + 1] ?? "")) {
        advance();
        while (/[\d_]/.test(source[offset] ?? "")) advance();
      }
      while (/[\p{L}%]/u.test(source[offset] ?? "")) advance();
      const lexeme = source.slice(start.offset, offset);
      add("number", start, lexeme, lexeme);
      continue;
    }

    if (identifierStart.test(character)) {
      const start = position();
      advance();
      while (identifierContinue.test(source[offset] ?? "")) advance();
      const lexeme = source.slice(start.offset, offset);
      add(isKeyword(lexeme) ? "keyword" : "identifier", start, lexeme, lexeme);
      continue;
    }

    const start = position();
    const lexeme = advance();
    add("unknown", start, lexeme);
    diagnostics.push(
      diagnostic(
        "N1002",
        "error",
        "lex",
        `Nexilume does not recognize ${JSON.stringify(lexeme)} here.`,
        { start, end: position() },
      ),
    );
  }

  const eof = position();
  tokens.push({ kind: "eof", lexeme: "", span: { start: eof, end: eof } });
  return { tokens, diagnostics };
}

