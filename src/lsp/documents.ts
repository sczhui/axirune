import type {
  DidChangeTextDocumentParams,
  Position,
  Range,
  TextDocumentItem,
} from "./types.js";

export interface TextDocument {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export class TextDocumentStore {
  readonly #documents = new Map<string, TextDocument>();

  open(item: TextDocumentItem): TextDocument {
    const document = { ...item };
    this.#documents.set(item.uri, document);
    return document;
  }

  change(params: DidChangeTextDocumentParams): TextDocument | undefined {
    const current = this.#documents.get(params.textDocument.uri);
    if (!current) return undefined;
    let text = current.text;
    for (const change of params.contentChanges) {
      text = applyContentChange(text, change);
    }
    const document = {
      ...current,
      version: params.textDocument.version,
      text,
    };
    this.#documents.set(document.uri, document);
    return document;
  }

  close(uri: string): boolean {
    return this.#documents.delete(uri);
  }

  get(uri: string): TextDocument | undefined {
    return this.#documents.get(uri);
  }
}

export function applyContentChange(
  source: string,
  change: { range?: Range; text: string },
): string {
  if (!change.range) return change.text;
  const start = positionToOffset(source, change.range.start);
  const end = positionToOffset(source, change.range.end);
  return `${source.slice(0, start)}${change.text}${source.slice(Math.max(start, end))}`;
}

export function positionToOffset(source: string, position: Position): number {
  if (position.line <= 0) return Math.min(source.length, Math.max(0, position.character));
  let offset = 0;
  let line = 0;
  while (line < position.line && offset < source.length) {
    const newline = source.indexOf("\n", offset);
    if (newline < 0) return source.length;
    offset = newline + 1;
    line += 1;
  }
  const lineEnd = source.indexOf("\n", offset);
  const maximum = lineEnd < 0 ? source.length : lineEnd;
  return Math.min(maximum, offset + Math.max(0, position.character));
}

export function offsetToPosition(source: string, offset: number): Position {
  const bounded = Math.min(source.length, Math.max(0, offset));
  let line = 0;
  let lineStart = 0;
  for (let index = 0; index < bounded; index += 1) {
    if (source.charCodeAt(index) === 10) {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, character: bounded - lineStart };
}

export function fullDocumentRange(source: string): Range {
  return {
    start: { line: 0, character: 0 },
    end: offsetToPosition(source, source.length),
  };
}
