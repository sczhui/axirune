import type { SourceSpan } from "./ast.js";

export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticPhase = "lex" | "parse" | "compile" | "runtime";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  phase: DiagnosticPhase;
  message: string;
  span: SourceSpan;
  hint?: string;
}

export function diagnostic(
  code: string,
  severity: DiagnosticSeverity,
  phase: DiagnosticPhase,
  message: string,
  span: SourceSpan,
  hint?: string,
): Diagnostic {
  return hint
    ? { code, severity, phase, message, span, hint }
    : { code, severity, phase, message, span };
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((item) => item.severity === "error");
}

