import {
  Braces,
  Check,
  CircleAlert,
  Code2,
  FileJson2,
  KeyRound,
  LoaderCircle,
  Play,
  RotateCcw,
  WandSparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Locale } from '../content/site'
import { CodeEditor } from './CodeEditor'
import {
  compileProgram,
  formatProgram,
  parseProgram,
  runProgram,
  serializeInspector,
  type CompileView,
  type DiagnosticView,
  type ParseView,
  type RunView,
  type TraceView,
} from './languageBridge'
import { TraceRail } from './TraceRail'

type InspectorTab = 'trace' | 'output' | 'ir' | 'authority' | 'ast'
type Operation = 'idle' | 'parsing' | 'formatting' | 'compiling' | 'running'

const previewTrace: TraceView[] = [
  {
    id: 'preview-1',
    kind: 'launch',
    label: 'main entered',
    detail: 'deterministic root task',
    status: 'done',
    elapsed: '0.18 ms',
  },
  {
    id: 'preview-2',
    kind: 'call',
    label: 'List.fold',
    detail: '3 invoice lines · using add_line',
    status: 'done',
    elapsed: '0.04 ms',
  },
  {
    id: 'preview-3',
    kind: 'call',
    label: 'Json.encode',
    detail: 'pure builtin · no capability',
    status: 'done',
    elapsed: '0.12 ms',
  },
  {
    id: 'preview-4',
    kind: 'emit',
    label: 'invoice summary emitted',
    detail: 'deterministic JSON value',
    status: 'done',
    elapsed: '0.09 ms',
  },
]

function extractAuthority(source: string): string[] {
  const matches = source.matchAll(
    /^\s*(?:need\s+(?:capability\s+)?|grant\s+)([A-Za-z0-9_.-]+)/gm,
  )
  return [...new Set([...matches].map((match) => match[1]).filter(Boolean) as string[])]
}

function diagnosticsFrom(
  run: RunView | null,
  compile: CompileView | null,
  parse: ParseView | null,
): DiagnosticView[] {
  if (run?.diagnostics.length) return run.diagnostics
  if (compile?.diagnostics.length) return compile.diagnostics
  return parse?.diagnostics ?? []
}

type LanguageWorkbenchProps = {
  initialSource: string
  locale: Locale
  compact?: boolean
  preview?: boolean
  onSourceChange?: (source: string) => void
}

export function LanguageWorkbench({
  initialSource,
  locale,
  compact = false,
  preview = false,
  onSourceChange,
}: LanguageWorkbenchProps) {
  const [source, setSource] = useState(initialSource)
  const [operation, setOperation] = useState<Operation>('idle')
  const [activeTab, setActiveTab] = useState<InspectorTab>('trace')
  const [parsed, setParsed] = useState<ParseView | null>(null)
  const [compiled, setCompiled] = useState<CompileView | null>(null)
  const [run, setRun] = useState<RunView | null>(null)

  useEffect(() => {
    setSource(initialSource)
    setParsed(null)
    setCompiled(null)
    setRun(null)
  }, [initialSource])

  const diagnostics = diagnosticsFrom(run, compiled, parsed)
  const errorCount = diagnostics.filter((item) => item.severity === 'error').length
  const authority = useMemo(() => extractAuthority(source), [source])
  const traceEntries = run?.trace.length ? run.trace : preview ? previewTrace : []

  const updateSource = (next: string) => {
    setSource(next)
    setRun(null)
    setCompiled(null)
    onSourceChange?.(next)
  }

  const handleParse = async () => {
    setOperation('parsing')
    const result = await parseProgram(source)
    setParsed(result)
    setActiveTab('ast')
    setOperation('idle')
  }

  const handleFormat = async () => {
    setOperation('formatting')
    const result = await formatProgram(source)
    updateSource(result.code)
    setParsed({ ast: null, tokens: [], diagnostics: result.diagnostics, raw: result })
    setOperation('idle')
  }

  const handleCompile = async () => {
    setOperation('compiling')
    const result = await compileProgram(source)
    setCompiled(result)
    setActiveTab('ir')
    setOperation('idle')
  }

  const handleRun = async () => {
    setOperation('running')
    const [parseResult, runResult] = await Promise.all([parseProgram(source), runProgram(source)])
    setParsed(parseResult)
    setRun(runResult)
    setActiveTab(runResult.diagnostics.some((item) => item.severity === 'error') ? 'output' : 'trace')
    setOperation('idle')
  }

  const reset = () => {
    setSource(initialSource)
    setParsed(null)
    setCompiled(null)
    setRun(null)
    setActiveTab('trace')
  }

  const copy: Record<InspectorTab, Record<Locale, string>> = {
    trace: { zh: '运行轨迹', en: 'Trace' },
    output: { zh: '输出', en: 'Output' },
    ir: { zh: '执行计划', en: 'IR' },
    authority: { zh: '权限', en: 'Authority' },
    ast: { zh: '语法树', en: 'AST' },
  }

  return (
    <div className={`workbench ${compact ? 'workbench--compact' : ''}`}>
      <div className="workbench__topbar">
        <div className="workbench__file">
          <span className="workbench__file-dot" />
          <span>{compact ? 'invoice.axi' : 'main.axi'}</span>
          <small>AXIRUNE</small>
        </div>
        <div className="workbench__top-actions">
          {!compact ? (
            <>
              <button type="button" onClick={handleParse} disabled={operation !== 'idle'}>
                <Braces size={14} />
                {locale === 'zh' ? '解析' : 'Parse'}
              </button>
              <button type="button" onClick={handleFormat} disabled={operation !== 'idle'}>
                <WandSparkles size={14} />
                {locale === 'zh' ? '格式化' : 'Format'}
              </button>
              <button type="button" onClick={handleCompile} disabled={operation !== 'idle'}>
                <Code2 size={14} />
                {locale === 'zh' ? '编译' : 'Compile'}
              </button>
            </>
          ) : null}
          <button
            className="workbench__run"
            type="button"
            onClick={handleRun}
            disabled={operation !== 'idle'}
          >
            {operation === 'running' ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
            {operation === 'running'
              ? locale === 'zh'
                ? '运行中'
                : 'Running'
              : locale === 'zh'
                ? '运行'
                : 'Run'}
          </button>
          {!compact ? (
            <button type="button" onClick={reset} aria-label="Reset source">
              <RotateCcw size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="workbench__body">
        <section className="workbench__editor-panel" aria-label="Source">
          <div className="panel-label">
            <span>SOURCE</span>
            <span className={errorCount > 0 ? 'status-bad' : 'status-good'}>
              {operation === 'idle' ? (
                errorCount > 0 ? (
                  <>
                    <CircleAlert size={12} /> {errorCount}
                  </>
                ) : (
                  <>
                    <Check size={12} /> {locale === 'zh' ? '就绪' : 'READY'}
                  </>
                )
              ) : (
                <>
                  <LoaderCircle className="spin" size={12} /> {operation.toUpperCase()}
                </>
              )}
            </span>
          </div>
          <CodeEditor
            value={source}
            onChange={updateSource}
            compact={compact}
            minHeight={compact ? 402 : 610}
          />
        </section>

        <section className="workbench__inspector" aria-label="Inspector">
          <div className="inspector-tabs" role="tablist" aria-label="Inspector panels">
            {(['trace', 'output', 'ir', 'authority', 'ast'] as InspectorTab[])
              .filter((tab) => !compact || ['trace', 'authority'].includes(tab))
              .map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? 'is-active' : ''}
                  onClick={() => setActiveTab(tab)}
                  role="tab"
                  aria-selected={activeTab === tab}
                >
                  {tab === 'authority' ? <KeyRound size={13} /> : null}
                  {copy[tab][locale]}
                </button>
              ))}
          </div>

          <div className="inspector-content" role="tabpanel">
            {activeTab === 'trace' ? (
              <>
                <div className="inspector-summary">
                  <span>
                    <i className="signal-dot" />
                    {run ? run.status.toUpperCase() : preview ? 'EXAMPLE TRACE' : 'AWAITING RUN'}
                  </span>
                  <span>{traceEntries.length} EVENTS</span>
                </div>
                <TraceRail
                  entries={traceEntries}
                  compact={compact}
                  emptyLabel={locale === 'zh' ? '运行程序后，这里会出现可回放轨迹。' : 'Run to inspect a replayable trace.'}
                />
              </>
            ) : null}

            {activeTab === 'output' ? (
              <div className="console-output">
                <div className="console-output__head">
                  <span>STDOUT / EMISSIONS</span>
                  <span>{run?.output.length ?? 0} ITEMS</span>
                </div>
                {diagnostics.length > 0 ? (
                  <ul className="diagnostic-list">
                    {diagnostics.map((diagnostic, index) => (
                      <li key={`${diagnostic.code ?? 'diagnostic'}-${index}`}>
                        <span className={`diagnostic-list__level diagnostic-list__level--${diagnostic.severity}`}>
                          {diagnostic.severity}
                        </span>
                        <div>
                          <strong>{diagnostic.code ?? 'AXIRUNE'}</strong>
                          <p>{diagnostic.message}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : run?.output.length ? (
                  <pre>{run.output.join('\n')}</pre>
                ) : (
                  <p className="inspector-placeholder">
                    {locale === 'zh' ? '暂无输出。运行程序以查看 emit 与返回值。' : 'No output yet. Run to inspect emissions and values.'}
                  </p>
                )}
              </div>
            ) : null}

            {activeTab === 'ir' ? (
              <div className="json-inspector">
                <div className="json-inspector__head">
                  <FileJson2 size={14} />
                  <span>DETERMINISTIC EXECUTION PLAN</span>
                  <small>{compiled ? (compiled.ok ? 'VALID' : 'INVALID') : 'NOT COMPILED'}</small>
                </div>
                <pre>{compiled ? serializeInspector(compiled.ir) : '// Compile to inspect Axirune IR.'}</pre>
              </div>
            ) : null}

            {activeTab === 'ast' ? (
              <div className="json-inspector">
                <div className="json-inspector__head">
                  <Braces size={14} />
                  <span>SEMANTIC FRAMES</span>
                  <small>{parsed?.tokens.length ?? 0} TOKENS</small>
                </div>
                <pre>{parsed ? serializeInspector(parsed.ast) : '// Parse to inspect semantic frames.'}</pre>
              </div>
            ) : null}

            {activeTab === 'authority' ? (
              <div className="authority-panel">
                <div className="authority-panel__stamp">
                  <KeyRound size={18} />
                  <div>
                    <span>MINIMUM AUTHORITY</span>
                    <strong>{authority.length} CAPABILITIES</strong>
                  </div>
                </div>
                {authority.length > 0 ? (
                  <ul>
                    {authority.map((item) => (
                      <li key={item}>
                        <span className="authority-panel__check">
                          <Check size={12} />
                        </span>
                        <div>
                          <strong>{item}</strong>
                          <small>{locale === 'zh' ? '显式声明 · 可审计' : 'EXPLICIT · AUDITABLE'}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="inspector-placeholder">
                    {locale === 'zh' ? '这个程序没有声明外部权限。' : 'This program declares no external authority.'}
                  </p>
                )}
                <div className="authority-panel__rule">
                  <span />
                  <p>
                    {locale === 'zh'
                      ? '未声明的权力不会在运行时凭空出现。'
                      : 'Authority absent from source cannot appear at runtime.'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
