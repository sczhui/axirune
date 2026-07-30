import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clipboard,
  Command,
  FileCode2,
  Search,
  TerminalSquare,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { cliCommands, docSections, quickStart, type Locale } from '../content/site'
import { StaticCode } from './CodeEditor'
import { Link } from './Router'

export function DocsPage({ locale }: { locale: Locale }) {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return docSections
    return docSections.filter((section) => {
      const searchable = [
        section.kicker,
        section.title.zh,
        section.title.en,
        section.summary.zh,
        section.summary.en,
        ...section.body.zh,
        ...section.body.en,
      ]
        .join(' ')
        .toLowerCase()
      return searchable.includes(normalized)
    })
  }, [query])

  const copyInstall = async () => {
    await navigator.clipboard.writeText(quickStart)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <>
      <section className="docs-hero">
        <div className="docs-hero__icon">
          <BookOpen size={28} />
          <span>DOCS / 0.3</span>
        </div>
        <div>
          <span className="eyebrow">LANGUAGE REFERENCE</span>
          <h1>{locale === 'zh' ? '从纯值开始。需要外部世界时，再声明 effect。' : 'Start with pure values. Declare effects only when the outside world is needed.'}</h1>
          <p>
            {locale === 'zh'
              ? 'Axirune 0.3 通用语言核心、任务调用、递归、数据处理、错误、I/O 与可选 AI 的完整导览。'
              : 'A complete Axirune 0.3 tour: general-purpose core, task calls, recursion, data, errors, I/O, and optional AI.'}
        </p>
        </div>
      </section>

      <section className="docs-layout">
        <aside className="docs-sidebar">
          <label className="docs-search">
            <Search size={14} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={locale === 'zh' ? '搜索文档' : 'Search docs'}
            />
            <kbd>/</kbd>
          </label>
          <nav aria-label="Documentation sections">
            <span className="docs-sidebar__label">{locale === 'zh' ? '语言模型' : 'LANGUAGE MODEL'}</span>
            {docSections.map((section, index) => (
              <a href={`#${section.id}`} key={section.id}>
                <span>{String(index).padStart(2, '0')}</span>
                <span>{section.title[locale]}</span>
              </a>
            ))}
          </nav>
          <div className="docs-sidebar__links">
            <Link to="/examples">
              <FileCode2 size={14} />
              {locale === 'zh' ? '示例程序' : 'Example programs'}
              <ChevronRight size={13} />
            </Link>
            <Link to="/download">
              <TerminalSquare size={14} />
              {locale === 'zh' ? '工具链' : 'Toolchain'}
              <ChevronRight size={13} />
            </Link>
          </div>
        </aside>

        <div className="docs-content">
          <section className="quickstart" id="quickstart">
            <div className="quickstart__copy">
              <span className="eyebrow">QUICK START / 90 SECONDS</span>
              <h2>{locale === 'zh' ? '安装、检查、运行。' : 'Install. Check. Run.'}</h2>
              <p>
                {locale === 'zh'
                  ? '工具包包含确定性解释器、编译器、CLI 与 Language Server。Node.js 22+ 可直接安装，不需要模型密钥。'
                  : 'The package includes the deterministic interpreter, compiler, CLI, and Language Server. Install on Node.js 22+ with no model key.'}
              </p>
            </div>
            <div className="install-block">
              <div className="install-block__head">
                <span>
                  <Command size={14} /> TERMINAL
                </span>
                <button type="button" onClick={copyInstall}>
                  {copied ? <Check size={14} /> : <Clipboard size={14} />}
                  {copied ? (locale === 'zh' ? '已复制' : 'Copied') : locale === 'zh' ? '复制' : 'Copy'}
                </button>
              </div>
              <pre>{quickStart}</pre>
            </div>
          </section>

          {filtered.length > 0 ? (
            filtered.map((section) => (
              <article className="doc-article" id={section.id} key={section.id}>
                <header>
                  <span>{section.kicker}</span>
                  <h2>{section.title[locale]}</h2>
                  <p>{section.summary[locale]}</p>
                </header>
                <div className="doc-article__body">
                  <div>
                    {section.body[locale].map((paragraph, index) => (
                      <p key={`${section.id}-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                  {section.code ? <StaticCode code={section.code} /> : null}
                </div>
                <a className="doc-article__anchor" href={`#${section.id}`} aria-label={`Link to ${section.title.en}`}>
                  #
                </a>
              </article>
            ))
          ) : (
            <div className="docs-empty">
              <Search size={24} />
              <h2>{locale === 'zh' ? '没有匹配章节' : 'No matching section'}</h2>
              <p>{locale === 'zh' ? '试试 capability、memory、workflow 或 sandbox。' : 'Try capability, memory, workflow, or sandbox.'}</p>
              <button type="button" onClick={() => setQuery('')}>
                {locale === 'zh' ? '清除搜索' : 'Clear search'}
              </button>
            </div>
          )}

          <section className="cli-reference">
            <div>
              <span className="eyebrow">CLI REFERENCE</span>
              <h2>{locale === 'zh' ? '一个工具链，覆盖从源码到证据。' : 'One toolchain from source to evidence.'}</h2>
            </div>
            <div className="cli-command-list">
              {cliCommands.map(([command, description]) => (
                <div key={command}>
                  <code>{command}</code>
                  <span>{description}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="docs-next">
            <span>{locale === 'zh' ? '下一步' : 'NEXT'}</span>
            <div>
              <h2>{locale === 'zh' ? '从递归、集合与 Outcome 示例开始。' : 'Start with recursion, collections, and Outcome.'}</h2>
              <Link to="/examples">
                {locale === 'zh' ? '浏览示例' : 'Browse examples'} <ArrowRight size={16} />
              </Link>
            </div>
          </section>
        </div>
      </section>
    </>
  )
}
