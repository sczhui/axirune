import {
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  Clipboard,
  Code2,
  Container,
  FileArchive,
  PackageOpen,
  PlugZap,
  TerminalSquare,
} from 'lucide-react'
import { useState } from 'react'
import type { Locale } from '../content/site'
import { Link } from './Router'

const installCommand =
  'npm install -g https://nexilume.velhu.com/downloads/nexilume-language-0.1.0.tgz'
const vscodeCommand = 'code --install-extension nexilume-0.1.0.vsix'
const dockerCommand = `mkdir nexilume-0.1.0
tar -xzf nexilume-source-0.1.0.tar.gz -C nexilume-0.1.0
cd nexilume-0.1.0
docker compose up -d --build`

function CopyCommand({ value, locale }: { value: string; locale: Locale }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }
  return (
    <button type="button" onClick={copy}>
      {copied ? <Check size={14} /> : <Clipboard size={14} />}
      {copied ? (locale === 'zh' ? '已复制' : 'Copied') : locale === 'zh' ? '复制' : 'Copy'}
    </button>
  )
}

export function DownloadPage({ locale }: { locale: Locale }) {
  return (
    <>
      <section className="download-hero">
        <div className="download-hero__copy">
          <span className="eyebrow">
            <PackageOpen size={14} /> NEXILUME 0.1.0 / ALPHA
          </span>
          <h1>{locale === 'zh' ? '把边界带进你的工作区。' : 'Bring the boundary into your workspace.'}</h1>
          <p>
            {locale === 'zh'
              ? '获取编译器、CLI、Language Server、VS Code 扩展和可复现的 Docker 源码包。'
              : 'Get the compiler, CLI, Language Server, VS Code extension, and reproducible Docker source archive.'}
          </p>
          <div className="download-hero__actions">
            <a className="button button--signal" href="/downloads/nexilume-language-0.1.0.tgz" download>
              <ArrowDownToLine size={16} />
              {locale === 'zh' ? '下载工具链' : 'Download toolchain'}
            </a>
            <Link to="/playground" className="text-link">
              {locale === 'zh' ? '先在浏览器试用' : 'Try it in the browser'} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="download-hero__seal">
          <div>
            <span>VERSION</span>
            <strong>0.1.0</strong>
          </div>
          <div>
            <span>CHANNEL</span>
            <strong>ALPHA</strong>
          </div>
          <div>
            <span>RUNTIME</span>
            <strong>NODE 22+</strong>
          </div>
          <div>
            <span>SOURCE</span>
            <strong>TYPE-SAFE</strong>
          </div>
        </div>
      </section>

      <section className="release-grid">
        <article className="release-card release-card--primary">
          <div className="release-card__number">01</div>
          <TerminalSquare size={24} />
          <span>COMPILER / CLI / LSP</span>
          <h2>{locale === 'zh' ? '语言工具链' : 'Language toolchain'}</h2>
          <p>
            {locale === 'zh'
              ? '包含 nexilume 与 nexilume-lsp 两个可执行入口。支持检查、运行、格式化、AST、IR、权限清单与基准。'
              : 'Includes nexilume and nexilume-lsp executables for checking, running, formatting, AST, IR, authority manifests, and benchmarks.'}
          </p>
          <div className="release-card__command">
            <code>{installCommand}</code>
            <CopyCommand value={installCommand} locale={locale} />
          </div>
          <a href="/downloads/nexilume-language-0.1.0.tgz" download>
            <FileArchive size={15} />
            nexilume-language-0.1.0.tgz
            <ArrowDownToLine size={15} />
          </a>
        </article>

        <article className="release-card">
          <div className="release-card__number">02</div>
          <Code2 size={24} />
          <span>EDITOR INTEGRATION</span>
          <h2>VS Code</h2>
          <p>
            {locale === 'zh'
              ? '语法高亮、诊断、格式化、hover、定义跳转与 capability 感知补全。'
              : 'Syntax highlighting, diagnostics, formatting, hover, definitions, and capability-aware completion.'}
          </p>
          <div className="release-card__command">
            <code>{vscodeCommand}</code>
            <CopyCommand value={vscodeCommand} locale={locale} />
          </div>
          <a href="/downloads/nexilume-0.1.0.vsix" download>
            <PlugZap size={15} />
            nexilume-0.1.0.vsix
            <ArrowDownToLine size={15} />
          </a>
        </article>

        <article className="release-card">
          <div className="release-card__number">03</div>
          <Box size={24} />
          <span>SOURCE / DOCKER</span>
          <h2>{locale === 'zh' ? '完整源码包' : 'Complete source archive'}</h2>
          <p>
            {locale === 'zh'
              ? '包含网站、编译器、LSP、扩展、示例、测试、benchmark 与 Docker 配置。'
              : 'Includes site, compiler, LSP, extension, examples, tests, benchmarks, and Docker configuration.'}
          </p>
          <div className="release-card__command release-card__command--multiline">
            <code>{dockerCommand}</code>
            <CopyCommand value={dockerCommand} locale={locale} />
          </div>
          <a href="/downloads/nexilume-source-0.1.0.tar.gz" download>
            <Container size={15} />
            nexilume-source-0.1.0.tar.gz
            <ArrowDownToLine size={15} />
          </a>
        </article>
      </section>

      <section className="toolchain-map section-shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ONE LANGUAGE / EVERY SURFACE</span>
            <h2>{locale === 'zh' ? '同一个语义核心。' : 'One semantic core.'}</h2>
          </div>
          <p>
            {locale === 'zh'
              ? '浏览器、CLI、编辑器和容器共享解析器、类型检查与 IR；没有“演示版语法”。'
              : 'Browser, CLI, editor, and container share parser, type checks, and IR. There is no demo-only dialect.'}
          </p>
        </div>
        <div className="toolchain-flow">
          <div>
            <FileArchive size={20} />
            <span>.nxl source</span>
            <small>INTENT</small>
          </div>
          <i>→</i>
          <div>
            <Code2 size={20} />
            <span>compiler core</span>
            <small>SEMANTICS</small>
          </div>
          <i>→</i>
          <div>
            <Box size={20} />
            <span>Nexilume IR</span>
            <small>PLAN</small>
          </div>
          <i>→</i>
          <div>
            <Container size={20} />
            <span>runtime trace</span>
            <small>EVIDENCE</small>
          </div>
        </div>
      </section>

      <section className="lsp-section">
        <div className="section-shell">
          <div className="lsp-section__copy">
            <span className="eyebrow">LANGUAGE SERVER PROTOCOL</span>
            <h2>{locale === 'zh' ? '编辑器不限于 VS Code。' : 'Your editor is not limited to VS Code.'}</h2>
            <p>
              {locale === 'zh'
                ? '工具链内置标准输入输出模式的 Language Server，可接入任何支持 LSP 的编辑器。'
                : 'The toolchain ships a stdio Language Server for any editor that supports LSP.'}
          </p>
          </div>
          <div className="lsp-section__terminal">
            <div>
              <span>TERMINAL</span>
              <CopyCommand value="nexilume-lsp --stdio" locale={locale} />
            </div>
            <code>
              <span>$</span> nexilume-lsp --stdio
            </code>
            <p>
              <i /> listening · Content-Length framing
            </p>
          </div>
        </div>
      </section>

      <section className="download-footnote section-shell">
        <span>RELEASE NOTE</span>
        <p>
          {locale === 'zh'
            ? '0.1.0 是用于验证语言模型、编译器接口与 Agent 执行语义的 alpha 版本。生产采用前请锁定版本、保留 trace，并审查导出的权限清单。'
            : '0.1.0 is an alpha for validating the language model, compiler interface, and agent execution semantics. Pin versions, retain traces, and review authority manifests before production use.'}
        </p>
      </section>
    </>
  )
}
