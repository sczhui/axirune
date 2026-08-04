import {
  Binary,
  Check,
  CircleAlert,
  Clipboard,
  Download,
  Fingerprint,
  Gauge,
  LoaderCircle,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import capsuleSource from '../../examples/hello.axi?raw'
import type { Locale } from '../content/site'
import {
  createCapsule,
  inspectCapsule,
  runProgram,
  verifyCapsule,
  type CapsuleInspection,
  type CapsuleIssue,
  type RunResult,
} from '../language'
import { CodeEditor } from './CodeEditor'

type LabPhase = 'idle' | 'building' | 'verified' | 'running' | 'error'

type VerifiedArtifact = {
  bytes: Uint8Array
  inspection: CapsuleInspection
}

const initialSource = capsuleSource.trim()

export function mutateCapsuleByte(bytes: Uint8Array): Uint8Array {
  const mutated = bytes.slice()
  if (mutated.length > 0) {
    const index = mutated.length - 1
    mutated[index] = (mutated[index] ?? 0) ^ 0x01
  }
  return mutated
}

export function encodeCapsuleBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return globalThis.btoa(binary)
}

function shortDigest(value: string): string {
  if (value.length <= 30) return value
  return `${value.slice(0, 17)}…${value.slice(-10)}`
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function capsuleFilename(inspection: CapsuleInspection): string {
  const stem = inspection.metadata.program.space
    .replace(/[^a-z0-9_-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
  return `${stem || 'program'}.axc`
}

export function CapsuleLabPage({ locale }: { locale: Locale }) {
  const [source, setSource] = useState(initialSource)
  const [phase, setPhase] = useState<LabPhase>('idle')
  const [artifact, setArtifact] = useState<VerifiedArtifact | null>(null)
  const [issues, setIssues] = useState<CapsuleIssue[]>([])
  const [tamperIssues, setTamperIssues] = useState<CapsuleIssue[]>([])
  const [run, setRun] = useState<RunResult | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const updateSource = (next: string) => {
    setSource(next)
    setPhase('idle')
    setArtifact(null)
    setIssues([])
    setTamperIssues([])
    setRun(null)
    setCopyState('idle')
  }

  const buildAndVerify = async () => {
    setPhase('building')
    setIssues([])
    setTamperIssues([])
    setRun(null)
    setCopyState('idle')
    try {
      const built = await createCapsule({ source, sourceName: 'capsule-lab.axi' })
      const verified = await verifyCapsule(built.bytes)
      if (!verified.ok) {
        setArtifact(null)
        setIssues(verified.issues)
        setPhase('error')
        return
      }
      const inspection = await inspectCapsule(built.bytes)
      setArtifact({ bytes: built.bytes, inspection })
      setPhase('verified')
    } catch (error) {
      const candidate = error as { code?: unknown; message?: unknown }
      setArtifact(null)
      setIssues([
        {
          code: typeof candidate.code === 'string' ? candidate.code : 'E_CAPSULE_LAB',
          message: typeof candidate.message === 'string' ? candidate.message : String(error),
        },
      ])
      setPhase('error')
    }
  }

  const runVerified = async () => {
    if (!artifact) return
    setPhase('running')
    setIssues([])
    const verified = await verifyCapsule(artifact.bytes)
    if (!verified.ok) {
      setIssues(verified.issues)
      setRun(null)
      setPhase('error')
      return
    }
    const result = await runProgram(verified.ir, {
      capabilities: [],
      tools: {},
      mockTools: false,
      sandbox: {
        maxSteps: 20_000,
        maxToolCalls: 0,
        maxTraceEvents: 4_000,
      },
    })
    setRun(result)
    setPhase('verified')
  }

  const proveTamperRejection = async () => {
    if (!artifact) return
    const result = await verifyCapsule(mutateCapsuleByte(artifact.bytes))
    setTamperIssues(
      result.ok
        ? [{ code: 'E_CAPSULE_LAB', message: 'Mutated bytes were unexpectedly accepted.' }]
        : result.issues,
    )
  }

  const copyCapsule = async () => {
    if (!artifact) return
    try {
      await navigator.clipboard.writeText(encodeCapsuleBase64(artifact.bytes))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const downloadCapsule = () => {
    if (!artifact) return
    const blob = new Blob([artifact.bytes.slice().buffer], {
      type: 'application/vnd.axirune.capsule',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = capsuleFilename(artifact.inspection)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => updateSource(initialSource)
  const inspection = artifact?.inspection ?? null
  const authorityCount = inspection
    ? inspection.manifest.capabilities.length + inspection.manifest.permissions.length
    : 0

  return (
    <>
      <section className="page-hero page-hero--capsule">
        <div className="page-hero__index">
          <span>02</span>
          <span>/ CAPSULE LAB</span>
        </div>
        <div className="page-hero__copy">
          <span className="eyebrow">
            <Sparkles size={12} /> ARTIFACT-FIRST · BROWSER-VERIFIED · NO MODEL
          </span>
          <h1>
            {locale === 'zh'
              ? 'AI 可以生成工件。运行时只相信证据。'
              : 'AI may generate artifacts. The runtime trusts only evidence.'}
          </h1>
          <p>
            {locale === 'zh'
              ? '把可编辑的 .axi 源码编译成可复现的 .axc 执行胶囊，在浏览器内检查内容身份、语义摘要、ABI、section 与请求权限，再运行已验证的 IR。整个过程不调用大模型。'
              : 'Compile editable .axi source into a reproducible .axc execution capsule. Inspect its content identity, semantic digest, ABI, sections, and requested authority before running verified IR—all without a model.'}
          </p>
        </div>
        <div className="page-hero__aside capsule-hero-seal">
          <ShieldCheck size={24} />
          <strong>AXIRUNE CAPSULE / V1</strong>
          <span>CANONICAL · CONTENT-ADDRESSED · INSPECTABLE</span>
        </div>
      </section>

      <section className="capsule-lab" aria-label="Axirune Capsule Lab">
        <div className="capsule-lab__flow" aria-label="Capsule lifecycle">
          {[
            ['01', locale === 'zh' ? '源码投影' : 'SOURCE'],
            ['02', locale === 'zh' ? '生成胶囊' : 'CAPSULE'],
            ['03', locale === 'zh' ? '验证证据' : 'VERIFY'],
            ['04', locale === 'zh' ? '执行 IR' : 'RUN IR'],
          ].map(([number, label], index) => (
            <div
              key={number}
              className={
                index === 0 ||
                (index <= 2 && inspection) ||
                (index === 3 && run?.status === 'completed')
                  ? 'is-complete'
                  : ''
              }
            >
              <span>{number}</span>
              <strong>{label}</strong>
              {index < 3 ? <i aria-hidden="true">→</i> : null}
            </div>
          ))}
        </div>

        <div className="capsule-lab__workspace">
          <section className="capsule-source-panel" aria-label="Capsule source projection">
            <div className="capsule-panel-head">
              <div>
                <span className="capsule-panel-head__dot" />
                <strong>capsule-lab.axi</strong>
                <small>SOURCE PROJECTION</small>
              </div>
              <button type="button" onClick={reset} disabled={phase === 'building' || phase === 'running'}>
                <RotateCcw size={13} /> {locale === 'zh' ? '重置' : 'RESET'}
              </button>
            </div>
            <CodeEditor
              value={source}
              onChange={updateSource}
              label={locale === 'zh' ? 'Capsule Lab 源码编辑器' : 'Capsule Lab source editor'}
              minHeight={590}
            />
            <div className="capsule-source-panel__action">
              <div aria-live="polite">
                {phase === 'verified' && inspection ? (
                  <span className="capsule-status capsule-status--good">
                    <Check size={13} /> VERIFIED / {inspection.metadata.schema}
                  </span>
                ) : phase === 'error' ? (
                  <span className="capsule-status capsule-status--bad">
                    <CircleAlert size={13} /> {locale === 'zh' ? '构建被拒绝' : 'BUILD REJECTED'}
                  </span>
                ) : (
                  <span className="capsule-status">
                    <Binary size={13} /> {locale === 'zh' ? '等待生成工件' : 'AWAITING ARTIFACT'}
                  </span>
                )}
              </div>
              <button
                className="capsule-primary-action"
                type="button"
                onClick={buildAndVerify}
                disabled={phase === 'building' || phase === 'running'}
              >
                {phase === 'building' ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}
                {phase === 'building'
                  ? locale === 'zh'
                    ? '生成并验证中'
                    : 'BUILDING'
                  : locale === 'zh'
                    ? '生成并验证'
                    : 'BUILD & VERIFY'}
              </button>
            </div>
          </section>

          <section className="capsule-proof-panel" aria-label="Capsule verification evidence">
            <div className="capsule-proof-panel__head">
              <div>
                <span className="eyebrow">VERIFIER OUTPUT</span>
                <h2>{locale === 'zh' ? '机器可检查的证据' : 'Machine-checkable evidence'}</h2>
              </div>
              <span className={`capsule-verdict ${inspection ? 'is-verified' : ''}`}>
                {inspection ? <Check size={14} /> : <Gauge size={14} />}
                {inspection ? 'VERIFIED' : 'NOT BUILT'}
              </span>
            </div>

            {!inspection ? (
              <div className="capsule-empty-state">
                <Fingerprint size={38} />
                <strong>{locale === 'zh' ? '还没有可验证工件' : 'No verifiable artifact yet'}</strong>
                <p>
                  {locale === 'zh'
                    ? '点击“生成并验证”。编译器会产生规范 IR、权限清单与源码投影，verifier 会独立检查所有摘要和 ABI。'
                    : 'Build and verify to produce canonical IR, an authority manifest, and a source projection. The verifier independently checks every digest and ABI.'}
                </p>
              </div>
            ) : (
              <div className="capsule-evidence">
                <div className="capsule-identity-grid">
                  <article>
                    <span>CONTENT ID</span>
                    <strong title={inspection.contentId}>{shortDigest(inspection.contentId)}</strong>
                    <small>{locale === 'zh' ? '字节级身份' : 'BYTE-LEVEL IDENTITY'}</small>
                  </article>
                  <article>
                    <span>SEMANTIC DIGEST</span>
                    <strong title={inspection.semanticDigest}>{shortDigest(inspection.semanticDigest)}</strong>
                    <small>{locale === 'zh' ? '忽略源码排版' : 'FORMAT-INDEPENDENT'}</small>
                  </article>
                  <article>
                    <span>CAPSULE SIZE</span>
                    <strong>{(artifact?.bytes.length ?? 0).toLocaleString()} B</strong>
                    <small>{inspection.metadata.program.space}</small>
                  </article>
                </div>

                <div className="capsule-facts">
                  <div className="capsule-facts__block">
                    <header>
                      <LockKeyhole size={14} />
                      <span>ABI CONTRACT</span>
                    </header>
                    <dl>
                      <div>
                        <dt>Runtime</dt>
                        <dd>{inspection.metadata.target.runtimeAbi}</dd>
                      </div>
                      <div>
                        <dt>Kernel</dt>
                        <dd>{inspection.metadata.target.kernelAbi}</dd>
                      </div>
                      <div>
                        <dt>IR</dt>
                        <dd>{inspection.metadata.target.ir}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="capsule-facts__block">
                    <header>
                      <ShieldCheck size={14} />
                      <span>REQUESTED AUTHORITY</span>
                    </header>
                    {authorityCount === 0 ? (
                      <div className="capsule-empty-authority">
                        <strong>∅</strong>
                        <span>{locale === 'zh' ? '纯程序 · 无外部权限' : 'PURE PROGRAM · NO EXTERNAL AUTHORITY'}</span>
                      </div>
                    ) : (
                      <div className="capsule-authority-list">
                        {inspection.manifest.capabilities.map((capability) => (
                          <code key={capability.name}>{capability.name}</code>
                        ))}
                        {inspection.manifest.permissions.map((permission) => (
                          <code key={permission}>{permission}</code>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="capsule-section-list">
                  <header>
                    <span>SECTIONS / {inspection.metadata.sections.length}</span>
                    <span>{locale === 'zh' ? '每个 section 独立摘要' : 'EACH SECTION DIGESTED'}</span>
                  </header>
                  {inspection.metadata.sections.map((section) => (
                    <div key={section.name}>
                      <strong>{section.name}</strong>
                      <code>{section.encoding}</code>
                      <span>{section.length.toLocaleString()} B</span>
                      <small title={section.sha256}>{shortDigest(section.sha256)}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {issues.length > 0 ? (
              <div className="capsule-issues" role="alert">
                {issues.map((issue, index) => (
                  <div key={`${issue.code}-${index}`}>
                    <CircleAlert size={14} />
                    <span>
                      <strong>{issue.code}</strong>
                      {issue.message}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <div className="capsule-lab__actions">
          <div>
            <span className="eyebrow">VERIFIED ARTIFACT ACTIONS</span>
            <p>
              {locale === 'zh'
                ? '复制 Base64 便于传输，或下载真正的二进制 .axc 文件。执行前会再次验证工件。'
                : 'Copy Base64 for transport or download the real binary .axc file. Execution verifies the artifact again.'}
            </p>
          </div>
          <div className="capsule-action-buttons">
            <button type="button" onClick={copyCapsule} disabled={!artifact}>
              <Clipboard size={14} />
              {copyState === 'copied'
                ? locale === 'zh'
                  ? '已复制 Base64'
                  : 'BASE64 COPIED'
                : copyState === 'failed'
                  ? locale === 'zh'
                    ? '复制失败'
                    : 'COPY FAILED'
                  : locale === 'zh'
                    ? '复制 .axc'
                    : 'COPY .AXC'}
            </button>
            <button type="button" onClick={downloadCapsule} disabled={!artifact}>
              <Download size={14} /> {locale === 'zh' ? '下载 .axc' : 'DOWNLOAD .AXC'}
            </button>
            <button
              className="is-primary"
              type="button"
              onClick={runVerified}
              disabled={!artifact || phase === 'running'}
            >
              {phase === 'running' ? <LoaderCircle className="spin" size={14} /> : <Play size={14} fill="currentColor" />}
              {phase === 'running'
                ? locale === 'zh'
                  ? '执行中'
                  : 'RUNNING'
                : locale === 'zh'
                  ? '运行已验证 IR'
                  : 'RUN VERIFIED IR'}
            </button>
          </div>
        </div>

        <div className="capsule-lab__results">
          <section className="capsule-run-result">
            <header>
              <div>
                <Play size={14} />
                <span>RUNTIME RESULT</span>
              </div>
              <span className={run?.status === 'completed' ? 'is-good' : ''}>
                {run?.status.toUpperCase() ?? 'AWAITING RUN'}
              </span>
            </header>
            {run ? (
              <div className="capsule-run-result__body">
                <div>
                  <span>VALUE</span>
                  <pre>{formatValue(run.value)}</pre>
                </div>
                <div>
                  <span>EMISSIONS / {run.emissions.length}</span>
                  <pre>{run.emissions.length ? run.emissions.map(formatValue).join('\n') : '∅'}</pre>
                </div>
                <small>
                  {run.trace.length} TRACE EVENTS · {run.diagnostics.length} DIAGNOSTICS
                </small>
              </div>
            ) : (
              <p>{locale === 'zh' ? '验证成功后，可直接运行胶囊中的 checked IR。' : 'After verification, run the checked IR directly from the capsule.'}</p>
            )}
          </section>

          <section className="capsule-tamper-proof">
            <header>
              <div>
                <TriangleAlert size={14} />
                <span>TAMPER PROOF</span>
              </div>
              <span>{tamperIssues.length ? 'REJECTED' : 'NOT TESTED'}</span>
            </header>
            <h3>{locale === 'zh' ? '改动一个字节，会发生什么？' : 'What happens if one byte changes?'}</h3>
            <p>
              {locale === 'zh'
                ? '复制当前胶囊、翻转最后一个 payload 字节，再交给同一个 verifier。原工件不会被修改。'
                : 'Clone the current capsule, flip its final payload byte, and submit it to the same verifier. The original stays untouched.'}
            </p>
            <button type="button" onClick={proveTamperRejection} disabled={!artifact}>
              <TriangleAlert size={14} /> {locale === 'zh' ? '篡改一字节' : 'TAMPER ONE BYTE'}
            </button>
            {tamperIssues.length > 0 ? (
              <div className="capsule-tamper-verdict" role="status">
                <CircleAlert size={17} />
                <span>
                  <strong>{tamperIssues[0]?.code}</strong>
                  {tamperIssues[0]?.message}
                </span>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </>
  )
}
