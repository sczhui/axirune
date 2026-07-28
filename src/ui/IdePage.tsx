import {
  Box,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileCode2,
  FileJson2,
  Folder,
  FolderOpen,
  PackageCheck,
  Save,
  Settings2,
  Shield,
  TerminalSquare,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { samples, type Locale } from '../content/site'
import { LanguageWorkbench } from './LanguageWorkbench'

type ProjectFile = {
  path: string
  kind: 'source' | 'manifest' | 'prompt' | 'policy'
  code: string
}

const projectFiles: ProjectFile[] = [
  {
    path: 'src/main.nxl',
    kind: 'source',
    code: samples[1]?.code ?? samples[0]?.code ?? '',
  },
  {
    path: 'src/prompts/review.nxl',
    kind: 'prompt',
    code: `space refunds
edition 1

shape RefundRequest
  field id Text
  field reason Text trust untrusted
/shape

shape RefundDecision
  field outcome Text
  field rationale Text
/shape

prompt review_refund
  slot request RefundRequest trust untrusted
  instruction «Check policy and evidence. Never invent a payment state.»
  attach request as data
  expect RefundDecision
/prompt

task main
  give Text
  emit «Typed refund prompt compiled with untrusted input.»
  yield «review-ready»
/task

launch main`,
  },
  {
    path: 'src/policies/finance.nxl',
    kind: 'policy',
    code: `space refunds
edition 1

grant ledger_read to main

capability ledger_read
  effect network.read
  resource «https://ledger.internal»
  limit calls 4
/capability

sandbox finance_readonly
  network allow «ledger.internal»
  filesystem deny all
  process deny all
/sandbox

task main
  give Text
  need ledger_read
  within finance_readonly
  emit «Ledger access is capability and sandbox bounded.»
  yield «policy-ready»
/task

launch main`,
  },
  {
    path: 'nexilume.pack',
    kind: 'manifest',
    code: `package refund-review
  version «0.1.0»
  edition «first-intent»
  source «src/**/*.nxl»
  entry «src/main.nxl»
  runtime «web»
  require «mcp:ledger@1.4.2»
  authority «manifest»
  diagnostics «canonical_json»
/package`,
  },
]

function fileIcon(kind: ProjectFile['kind']) {
  if (kind === 'manifest') return <FileJson2 size={14} />
  if (kind === 'policy') return <Shield size={14} />
  return <FileCode2 size={14} />
}

export function IdePage({ locale }: { locale: Locale }) {
  const [activePath, setActivePath] = useState(projectFiles[0]?.path ?? '')
  const [explorerOpen, setExplorerOpen] = useState(true)
  const activeFile = useMemo(
    () => projectFiles.find((file) => file.path === activePath) ?? projectFiles[0],
    [activePath],
  )

  if (!activeFile) return null

  const saveFile = () => {
    const blob = new Blob([activeFile.code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = activeFile.path.split('/').at(-1) ?? 'main.nxl'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <section className="ide-intro">
        <div>
          <span className="eyebrow">
            <CircleDot size={12} /> NEXILUME WORKSPACE / WEB
          </span>
          <h1>{locale === 'zh' ? '意图、权限与执行，在同一个工作区。' : 'Intent, authority, and execution in one workspace.'}</h1>
        </div>
        <p>
          {locale === 'zh'
            ? '这是完整的浏览器 IDE：切换项目文件，运行编译器，检查最小权限清单，并把源码保存到本地。'
            : 'A complete browser IDE: switch project files, run the compiler, inspect minimum authority, and save source locally.'}
        </p>
      </section>

      <section className="ide-window" aria-label="Nexilume online IDE">
        <div className="ide-titlebar">
          <div className="ide-titlebar__brand">
            <span className="ide-mark">
              <i />
              <i />
            </span>
            <strong>NEXILUME / STUDIO</strong>
          </div>
          <div className="ide-titlebar__project">
            <PackageCheck size={14} />
            <span>refund-review</span>
            <small>LOCAL</small>
          </div>
          <div className="ide-titlebar__actions">
            <button type="button" onClick={saveFile}>
              <Save size={14} />
              <span>{locale === 'zh' ? '保存文件' : 'Save file'}</span>
            </button>
            <button type="button" aria-label="Workspace settings">
              <Settings2 size={15} />
            </button>
          </div>
        </div>

        <div className="ide-menubar">
          <span>File</span>
          <span>Edit</span>
          <span>Navigate</span>
          <span>Run</span>
          <span>Authority</span>
          <span>Trace</span>
          <div>
            <CircleDot size={11} />
            COMPILER READY
          </div>
        </div>

        <div className="ide-layout">
          <aside className="file-explorer">
            <button
              className="file-explorer__title"
              type="button"
              onClick={() => setExplorerOpen((value) => !value)}
              aria-expanded={explorerOpen}
            >
              {explorerOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>EXPLORER</span>
            </button>
            {explorerOpen ? (
              <div className="file-tree">
                <div className="file-tree__folder">
                  <FolderOpen size={14} />
                  <strong>refund-review</strong>
                </div>
                <div className="file-tree__folder file-tree__folder--nested">
                  <FolderOpen size={14} />
                  <span>src</span>
                </div>
                {projectFiles
                  .filter((file) => file.path.startsWith('src/'))
                  .map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      className={activeFile.path === file.path ? 'is-active' : ''}
                      onClick={() => setActivePath(file.path)}
                      title={file.path}
                    >
                      {fileIcon(file.kind)}
                      <span>{file.path.split('/').at(-1)}</span>
                    </button>
                  ))}
                <button
                  type="button"
                  className={activeFile.path === 'nexilume.pack' ? 'is-active file-tree__root-file' : 'file-tree__root-file'}
                  onClick={() => setActivePath('nexilume.pack')}
                >
                  <Box size={14} />
                  <span>nexilume.pack</span>
                </button>
                <div className="file-tree__collapsed">
                  <Folder size={14} />
                  <span>.nexilume</span>
                  <small>generated</small>
                </div>
              </div>
            ) : null}
            <div className="explorer-outline">
              <span>OUTLINE</span>
              <p>{activeFile.kind}</p>
              <small>{activeFile.code.split('\n').length} lines</small>
            </div>
          </aside>

          <div className="ide-main">
            <div className="ide-tabs">
              <div className="ide-tabs__active">
                {fileIcon(activeFile.kind)}
                <span>{activeFile.path.split('/').at(-1)}</span>
                <i />
              </div>
            </div>
            <LanguageWorkbench
              key={activeFile.path}
              initialSource={activeFile.code}
              locale={locale}
            />
          </div>
        </div>

        <div className="ide-statusbar">
          <div>
            <span>
              <TerminalSquare size={13} /> WEB RUNTIME
            </span>
            <span>nexilume 0.1.0</span>
          </div>
          <div>
            <span>UTF-8</span>
            <span>LF</span>
            <span>Nexilume</span>
            <span className="ide-statusbar__safe">
              <Shield size={13} /> SANDBOXED
            </span>
          </div>
        </div>
      </section>

      <section className="ide-features section-shell">
        <div className="section-index">
          <span>IDE</span>
          <p>THE LANGUAGE, VISIBLE</p>
        </div>
        <div className="ide-feature-grid">
          <article>
            <span>01</span>
            <h2>{locale === 'zh' ? '语义补全' : 'Semantic completion'}</h2>
            <p>{locale === 'zh' ? '补全建议基于当前 frame、类型与可用 capability，而不只是相似文本。' : 'Suggestions follow the current frame, types, and available capabilities—not merely similar text.'}</p>
          </article>
          <article>
            <span>02</span>
            <h2>{locale === 'zh' ? '权限差异' : 'Authority diffs'}</h2>
            <p>{locale === 'zh' ? '重构前后新增、收窄或移除的 effect 会像类型变化一样进入审查。' : 'Effects added, narrowed, or removed by a refactor enter review like type changes.'}</p>
          </article>
          <article>
            <span>03</span>
            <h2>{locale === 'zh' ? 'Trace 定位' : 'Trace navigation'}</h2>
            <p>{locale === 'zh' ? '从某次工具调用或拒绝决策直接跳回产生它的语义帧。' : 'Jump from a tool call or denied decision directly to the semantic frame that produced it.'}</p>
          </article>
        </div>
      </section>
    </>
  )
}
