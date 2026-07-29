import {
  compileSource as coreCompileSource,
  formatSource as coreFormatSource,
  parseSource as coreParseSource,
  runSource as coreRunSource,
} from '../language'

export type DiagnosticView = {
  severity: 'error' | 'warning' | 'info'
  message: string
  line?: number
  column?: number
  code?: string
}

export type TraceView = {
  id: string
  kind: string
  label: string
  detail?: string
  status: 'done' | 'active' | 'blocked' | 'info'
  elapsed?: string
}

export type ParseView = {
  ast: unknown
  tokens: unknown[]
  diagnostics: DiagnosticView[]
  raw: unknown
}

export type FormatView = {
  code: string
  diagnostics: DiagnosticView[]
}

export type CompileView = {
  ok: boolean
  ir: unknown
  diagnostics: DiagnosticView[]
  raw: unknown
}

export type RunView = {
  status: string
  output: string[]
  trace: TraceView[]
  diagnostics: DiagnosticView[]
  value: unknown
  raw: unknown
}

type UnknownRecord = Record<string, unknown>
type CoreCall = (...args: unknown[]) => unknown

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function safeStringify(value: unknown, indent = 2): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, indent)
  } catch {
    return String(value)
  }
}

function normalizeDiagnostics(value: unknown): DiagnosticView[] {
  if (!Array.isArray(value)) return []

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      return { severity: 'error', message: String(entry), code: `A${index + 1}` }
    }

    const location = isRecord(entry.location)
      ? entry.location
      : isRecord(entry.range)
        ? entry.range
        : isRecord(entry.span)
          ? entry.span
          : undefined
    const start = location && isRecord(location.start) ? location.start : location
    const rawSeverity = String(entry.severity ?? entry.level ?? 'error').toLowerCase()
    const severity: DiagnosticView['severity'] =
      rawSeverity.includes('warn') ? 'warning' : rawSeverity.includes('info') ? 'info' : 'error'

    return {
      severity,
      message: String(entry.message ?? entry.reason ?? entry.description ?? 'Unknown diagnostic'),
      line: typeof start?.line === 'number' ? start.line : undefined,
      column: typeof start?.column === 'number' ? start.column : undefined,
      code: entry.code === undefined ? undefined : String(entry.code),
    }
  })
}

function normalizeOutput(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (isRecord(entry) && 'value' in entry) return safeStringify(entry.value, 0)
      return safeStringify(entry, 0)
    })
  }
  return [safeStringify(value, 0)]
}

function normalizeTrace(value: unknown): TraceView[] {
  if (!Array.isArray(value)) return []

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      return {
        id: `trace-${index}`,
        kind: 'event',
        label: String(entry),
        status: 'done',
      }
    }

    const rawKind = String(entry.kind ?? entry.type ?? entry.event ?? 'event')
    const rawStatus = String(entry.status ?? entry.outcome ?? 'done').toLowerCase()
    const status: TraceView['status'] = rawStatus.includes('block')
      ? 'blocked'
      : rawStatus.includes('active') || rawStatus.includes('start')
        ? 'active'
        : rawStatus.includes('info') || rawStatus.includes('request')
          ? 'info'
          : 'done'

    const labelValue =
      entry.label ??
      entry.name ??
      entry.message ??
      entry.tool ??
      entry.frame ??
      `${rawKind} ${index + 1}`
    const detailValue =
      entry.detail ??
      entry.summary ??
      entry.data ??
      entry.input ??
      entry.output ??
      entry.capability
    const duration = entry.elapsed ?? entry.duration ?? entry.durationMs

    return {
      id: String(entry.id ?? `trace-${index}`),
      kind: rawKind,
      label: String(labelValue),
      detail: detailValue === undefined ? undefined : safeStringify(detailValue, 0),
      status,
      elapsed:
        duration === undefined
          ? undefined
          : typeof duration === 'number'
            ? `${duration.toFixed(duration < 10 ? 2 : 0)} ms`
            : String(duration),
    }
  })
}

function exceptionDiagnostic(error: unknown): DiagnosticView {
  return {
    severity: 'error',
    message: error instanceof Error ? error.message : String(error),
    code: 'BRIDGE_RUNTIME',
  }
}

export async function parseProgram(source: string): Promise<ParseView> {
  try {
    const raw = await Promise.resolve((coreParseSource as unknown as CoreCall)(source))
    const record = isRecord(raw) ? raw : {}
    return {
      ast: record.program ?? record.ast ?? raw,
      tokens: Array.isArray(record.tokens) ? record.tokens : [],
      diagnostics: normalizeDiagnostics(record.diagnostics ?? record.errors),
      raw,
    }
  } catch (error) {
    return {
      ast: null,
      tokens: [],
      diagnostics: [exceptionDiagnostic(error)],
      raw: null,
    }
  }
}

export async function formatProgram(source: string): Promise<FormatView> {
  try {
    const raw = await Promise.resolve((coreFormatSource as unknown as CoreCall)(source))
    const record = isRecord(raw) ? raw : {}
    return {
      code: typeof raw === 'string' ? raw : String(record.code ?? record.formatted ?? source),
      diagnostics: normalizeDiagnostics(record.diagnostics ?? record.errors),
    }
  } catch (error) {
    return { code: source, diagnostics: [exceptionDiagnostic(error)] }
  }
}

export async function compileProgram(source: string): Promise<CompileView> {
  try {
    const raw = await Promise.resolve((coreCompileSource as unknown as CoreCall)(source))
    const record = isRecord(raw) ? raw : {}
    const diagnostics = normalizeDiagnostics(record.diagnostics ?? record.errors)
    return {
      ok:
        typeof record.ok === 'boolean'
          ? record.ok
          : !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
      ir: record.ir ?? record.program ?? raw,
      diagnostics,
      raw,
    }
  } catch (error) {
    return {
      ok: false,
      ir: null,
      diagnostics: [exceptionDiagnostic(error)],
      raw: null,
    }
  }
}

const demoTools = {
  'File.readText': async () => 'Nexilume makes intent explicit nexilume makes effects explicit',
}

export async function runProgram(source: string): Promise<RunView> {
  try {
    const options = {
      capabilities: ['host.fs.read'],
      tools: demoTools,
      sandbox: { maxSteps: 100 },
      mockTools: true,
    }
    const raw = await Promise.resolve((coreRunSource as unknown as CoreCall)(source, options))
    const record = isRecord(raw) ? raw : {}
    const output = normalizeOutput(record.output ?? record.emissions)
    return {
      status: String(record.status ?? (record.ok === false ? 'failed' : 'completed')),
      output: output.length > 0 ? output : normalizeOutput(record.value),
      trace: normalizeTrace(record.trace ?? record.events),
      diagnostics: normalizeDiagnostics(record.diagnostics ?? record.errors),
      value: record.value,
      raw,
    }
  } catch (error) {
    return {
      status: 'failed',
      output: [],
      trace: [],
      diagnostics: [exceptionDiagnostic(error)],
      value: null,
      raw: null,
    }
  }
}

export function serializeInspector(value: unknown): string {
  return safeStringify(value)
}
