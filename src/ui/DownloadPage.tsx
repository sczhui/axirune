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
  'npm install -g https://axirune.velhu.com/downloads/axirune-language-0.6.0-alpha.1.tgz'
const vscodeCommand = 'code --install-extension axirune-0.6.0-alpha.1.vsix'
const dockerCommand = `mkdir axirune-0.6.0-alpha.1
tar -xzf axirune-source-0.6.0-alpha.1.tar.gz -C axirune-0.6.0-alpha.1
cd axirune-0.6.0-alpha.1
docker build -t axirune:0.6.0-alpha.1 .
docker run --rm -p 8080:8080 axirune:0.6.0-alpha.1`

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
            <PackageOpen size={14} /> AXIRUNE 0.6.0-ALPHA.1 / RIVER OATH
          </span>
          <h1>{locale === 'zh' ? '安装一门无需模型即可运行的语言。' : 'Install a language that runs without a model.'}</h1>
          <p>
            {locale === 'zh'
              ? '获取确定性解释器、编译器、CLI、Language Server、VS Code 扩展和可复现的 Docker 源码包。AI 集成按需启用。'
              : 'Get the deterministic interpreter, compiler, CLI, Language Server, VS Code extension, and reproducible Docker source archive. Enable AI only when needed.'}
          </p>
          <div className="download-hero__actions">
            <a className="button button--signal" href="/downloads/axirune-language-0.6.0-alpha.1.tgz" download>
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
            <strong>0.6α1</strong>
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
            <span>AI</span>
            <strong>OPTIONAL</strong>
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
              ? '包含 axirune 与 axirune-lsp。支持确定性运行、检查、格式化、AST、IR、权限清单与基准。'
              : 'Includes axirune and axirune-lsp for deterministic execution, checks, formatting, AST, IR, authority manifests, and benchmarks.'}
          </p>
          <div className="release-card__command">
            <code>{installCommand}</code>
            <CopyCommand value={installCommand} locale={locale} />
          </div>
          <a href="/downloads/axirune-language-0.6.0-alpha.1.tgz" download>
            <FileArchive size={15} />
            axirune-language-0.6.0-alpha.1.tgz
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
          <a href="/downloads/axirune-0.6.0-alpha.1.vsix" download>
            <PlugZap size={15} />
            axirune-0.6.0-alpha.1.vsix
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
          <a href="/downloads/axirune-source-0.6.0-alpha.1.tar.gz" download>
            <Container size={15} />
            axirune-source-0.6.0-alpha.1.tar.gz
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
              ? '浏览器、CLI、编辑器和容器共享解析器、纯 builtin、类型检查、IR 与解释器；没有“演示版语法”。'
              : 'Browser, CLI, editor, and container share the parser, pure builtins, type checks, IR, and interpreter. There is no demo-only dialect.'}
          </p>
        </div>
        <div className="toolchain-flow">
          <div>
            <FileArchive size={20} />
            <span>.axi source</span>
            <small>SHAPES · TASKS</small>
          </div>
          <i>→</i>
          <div>
            <Code2 size={20} />
            <span>checked IR</span>
            <small>TYPES · CALL GRAPH</small>
          </div>
          <i>→</i>
          <div>
            <Box size={20} />
            <span>interpreter</span>
            <small>DETERMINISTIC CORE</small>
          </div>
          <i>→</i>
          <div>
            <Container size={20} />
            <span>effect adapters</span>
            <small>I/O · MCP · AI / OPTIONAL</small>
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
              <CopyCommand value="axirune-lsp --stdio" locale={locale} />
            </div>
            <code>
              <span>$</span> axirune-lsp --stdio
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
            ? '0.6.0-alpha.1 新增 River Oath：三英雄、四幕十二波、八类普通敌人、四位独立 Boss、分支与道具，由零权限 Axirune 规则胶囊驱动。既有 20 款 Arcade 世界继续保留。胶囊格式仍处于 Alpha；采用前请锁定版本、运行测试并审查请求权限。'
            : 'Axirune 0.6.0-alpha.1 adds River Oath: three heroes, four acts and twelve waves, eight regular enemy classes, four distinct bosses, routes, and items driven by a zero-authority Axirune rules capsule. The existing 20 Arcade worlds remain included. The capsule format remains alpha; pin versions, run tests, and review requested authority before adoption.'}
        </p>
      </section>
    </>
  )
}
