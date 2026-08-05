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
    path: 'src/main.axi',
    kind: 'source',
    code: samples.find((sample) => sample.slug === 'invoice-total')?.code ?? '',
  },
  {
    path: 'src/hello.axi',
    kind: 'source',
    code: samples.find((sample) => sample.slug === 'hello')?.code ?? '',
  },
  {
    path: 'src/factorial.axi',
    kind: 'source',
    code: samples.find((sample) => sample.slug === 'factorial')?.code ?? '',
  },
  {
    path: 'src/outcome.axi',
    kind: 'source',
    code: samples.find((sample) => sample.slug === 'outcome-division')?.code ?? '',
  },
  {
    path: 'src/word-frequency.axi',
    kind: 'policy',
    code: samples.find((sample) => sample.slug === 'word-frequency')?.code ?? '',
  },
  {
    path: 'src/optional-ai.axi',
    kind: 'prompt',
    code: samples.find((sample) => sample.slug === 'optional-ai')?.code ?? '',
  },
  {
    path: 'axirune.pack',
    kind: 'manifest',
    code: `package general-programs
  version «0.6.0-alpha.1»
  edition «2»
  source «src/**/*.axi»
  entry «src/main.axi»
  runtime «web»
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
    anchor.download = activeFile.path.split('/').at(-1) ?? 'main.axi'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <section className="ide-intro">
        <div>
          <span className="eyebrow">
            <CircleDot size={12} /> AXIRUNE WORKSPACE / WEB
          </span>
          <h1>{locale === 'zh' ? '确定性应用，也值得一间 AI 原生工作室。' : 'Deterministic applications deserve an AI-native studio.'}</h1>
        </div>
        <p>
          {locale === 'zh'
            ? '在浏览器中编译并运行普通程序：Hello、递归、集合、Outcome 与文件 I/O。前五个文件不需要模型；AI 示例被单独标记为可选扩展。'
            : 'Compile and run ordinary programs in the browser: Hello, recursion, collections, Outcome, and file I/O. The first five files need no model; AI is a separately labelled optional extension.'}
        </p>
      </section>

      <section className="ide-window" aria-label="Axirune online IDE">
        <div className="ide-titlebar">
          <div className="ide-titlebar__brand">
            <span className="ide-mark">
              <i />
              <i />
            </span>
            <strong>AXIRUNE / STUDIO</strong>
          </div>
          <div className="ide-titlebar__project">
            <PackageCheck size={14} />
            <span>general-programs</span>
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
                  <strong>general-programs</strong>
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
                  className={activeFile.path === 'axirune.pack' ? 'is-active file-tree__root-file' : 'file-tree__root-file'}
                  onClick={() => setActivePath('axirune.pack')}
                >
                  <Box size={14} />
                  <span>axirune.pack</span>
                </button>
                <div className="file-tree__collapsed">
                  <Folder size={14} />
                  <span>.axirune</span>
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
            <span>axirune 0.6.0-alpha.1</span>
          </div>
          <div>
            <span>UTF-8</span>
            <span>LF</span>
            <span>Axirune</span>
            <span className="ide-statusbar__safe">
              <Shield size={13} />{' '}
              {activeFile.kind === 'prompt'
                ? 'OPTIONAL AI'
                : activeFile.kind === 'policy'
                  ? 'CAPABILITY I/O'
                  : 'PURE CORE'}
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
            <h2>{locale === 'zh' ? 'Task 调用图' : 'Task call graph'}</h2>
            <p>{locale === 'zh' ? '命名参数、递归边与 List 回调都进入同一份可检查调用图。' : 'Named arguments, recursive edges, and List callbacks all enter one inspectable call graph.'}</p>
          </article>
          <article>
            <span>02</span>
            <h2>{locale === 'zh' ? '数据流可见' : 'Visible dataflow'}</h2>
            <p>{locale === 'zh' ? '纯 builtin、惰性分支与 Outcome 在 IR 和 trace 中保留语义边界。' : 'Pure builtins, lazy branches, and Outcome retain their semantic boundaries in IR and traces.'}</p>
          </article>
          <article>
            <span>03</span>
            <h2>{locale === 'zh' ? 'Effect 差异' : 'Effect diffs'}</h2>
            <p>{locale === 'zh' ? '只有 I/O、MCP 或模型跨出纯核心；重构产生的 authority 变化可以单独审查。' : 'Only I/O, MCP, or models cross the pure core; authority changes introduced by a refactor can be reviewed separately.'}</p>
          </article>
        </div>
      </section>
    </>
  )
}
