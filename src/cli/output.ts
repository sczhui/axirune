import type { Diagnostic } from "../language/index.js";

export interface SourceLineLookup {
  readonly source: string;
  readonly sourceName: string;
}

export function formatDiagnostic(
  item: Diagnostic,
  lookup?: SourceLineLookup,
  color = false,
): string {
  const location = `${lookup?.sourceName ?? "<source>"}:${item.span.start.line}:${item.span.start.column}`;
  const severity = color ? colorSeverity(item.severity) : item.severity;
  const headline = `${location} ${severity} ${item.code}: ${item.message}`;
  const sourceLine = lookup?.source.split(/\r?\n/u)[item.span.start.line - 1];
  const hint = item.hint ? `  hint: ${item.hint}` : "";

  if (sourceLine === undefined) {
    return hint ? `${headline}\n${hint}` : headline;
  }

  const start = Math.max(0, item.span.start.column - 1);
  const sameLine = item.span.start.line === item.span.end.line;
  const width = sameLine
    ? Math.max(1, item.span.end.column - item.span.start.column)
    : Math.max(1, sourceLine.length - start);
  const underline = `${" ".repeat(start)}${"^".repeat(width)}`;
  return [headline, `  ${sourceLine}`, `  ${underline}`, hint].filter(Boolean).join("\n");
}

export function formatDiagnostics(
  diagnostics: readonly Diagnostic[],
  lookup?: SourceLineLookup,
  color = false,
): string {
  return diagnostics.map((item) => formatDiagnostic(item, lookup, color)).join("\n");
}

function colorSeverity(severity: Diagnostic["severity"]): string {
  if (!process.stderr.isTTY || process.env.NO_COLOR !== undefined) return severity;
  const code = severity === "error" ? 31 : severity === "warning" ? 33 : 36;
  return `\u001b[${code}m${severity}\u001b[0m`;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, jsonReplacer, 2)}\n`;
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
