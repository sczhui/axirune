import { ArrowRight, Check, Copy, Download, FileCode2, Play } from 'lucide-react'
import { useState } from 'react'
import { runtimeLabels, samples, type Locale } from '../content/site'
import { CodeEditor } from './CodeEditor'
import { Link } from './Router'

export function ExamplesPage({ locale }: { locale: Locale }) {
  const [activeSlug, setActiveSlug] = useState(samples[0]?.slug ?? '')
  const [copied, setCopied] = useState(false)
  const active = samples.find((sample) => sample.slug === activeSlug) ?? samples[0]

  if (!active) return null

  const copySource = async () => {
    await navigator.clipboard.writeText(active.code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const downloadSource = () => {
    const blob = new Blob([active.code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${active.slug}.nxl`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <section className="page-hero page-hero--examples">
        <div className="page-hero__index">
          <span>04</span>
          <span>/ EXAMPLES</span>
        </div>
        <div className="page-hero__copy">
          <span className="eyebrow">
            <FileCode2 size={13} /> WORKING PROGRAMS
          </span>
          <h1>{locale === 'zh' ? '先学会计算，再按需连接外部世界。' : 'Learn computation first. Connect the outside world only when needed.'}</h1>
          <p>
            {locale === 'zh'
              ? 'Hello、递归、发票、Outcome 都完全不依赖 LLM；文件 I/O、MCP 与 AI 示例单独标识自己的 effect。'
              : 'Hello, recursion, invoices, and Outcome need no LLM. File I/O, MCP, and AI examples label their effects separately.'}
          </p>
        </div>
      </section>

      <section className="examples-layout">
        <aside className="example-list">
          <span className="example-list__label">PROGRAM INDEX / {samples.length}</span>
          {samples.map((sample, index) => (
            <button
              type="button"
              key={sample.slug}
              className={active.slug === sample.slug ? 'is-active' : ''}
              onClick={() => setActiveSlug(sample.slug)}
            >
              <span className="example-list__number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{sample.title[locale]}</strong>
                <small>{sample.eyebrow}</small>
                <em className={`runtime-label runtime-label--${sample.runtime}`}>
                  {runtimeLabels[sample.runtime][locale]}
                </em>
              </div>
              <ArrowRight size={15} />
            </button>
          ))}
        </aside>

        <article className="example-viewer">
          <header>
            <div>
              <span>{active.eyebrow}</span>
              <em className={`runtime-label runtime-label--${active.runtime}`}>
                {runtimeLabels[active.runtime][locale]}
              </em>
              <h2>{active.title[locale]}</h2>
              <p>{active.description[locale]}</p>
            </div>
            <div className="example-viewer__actions">
              <button type="button" onClick={copySource}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? (locale === 'zh' ? '已复制' : 'Copied') : locale === 'zh' ? '复制' : 'Copy'}
              </button>
              <button type="button" onClick={downloadSource}>
                <Download size={14} />
                .nxl
              </button>
              <Link to="/playground">
                <Play size={14} fill="currentColor" />
                {locale === 'zh' ? '运行' : 'Run'}
              </Link>
            </div>
          </header>
          <div className="example-viewer__code">
            <div className="example-viewer__code-head">
              <span>{active.slug}.nxl</span>
              <span>NEXILUME · UTF-8</span>
            </div>
            <CodeEditor value={active.code} readOnly minHeight={620} />
          </div>
          <footer>
            <span>{locale === 'zh' ? '覆盖概念' : 'CONCEPT COVERAGE'}</span>
            <div>
              {active.tags.map((tag) => (
                <code key={tag}>{tag}</code>
              ))}
            </div>
          </footer>
        </article>
      </section>

      <section className="example-principle section-shell">
        <span className="eyebrow">DESIGN RULE / COMPLETE PATHS</span>
        <blockquote>
          {locale === 'zh'
            ? '“纯计算无需权限；一旦程序触及文件、网络或模型，effect 必须在源码里出现。”'
            : '“Pure computation needs no authority. The moment code touches files, network, or a model, the effect must appear in source.”'}
        </blockquote>
        <Link to="/docs">
          {locale === 'zh' ? '阅读语言规则' : 'Read the language rules'} <ArrowRight size={16} />
        </Link>
      </section>
    </>
  )
}
