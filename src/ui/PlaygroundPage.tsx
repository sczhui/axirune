import { ArrowDown, ArrowRight, CircleDot, FlaskConical, Layers3, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { samples, type Locale } from '../content/site'
import { LanguageWorkbench } from './LanguageWorkbench'
import { Link } from './Router'

export function PlaygroundPage({ locale }: { locale: Locale }) {
  const [selectedSlug, setSelectedSlug] = useState(samples[0]?.slug ?? '')
  const selected = samples.find((sample) => sample.slug === selectedSlug) ?? samples[0]

  if (!selected) return null

  return (
    <>
      <section className="page-hero page-hero--playground">
        <div className="page-hero__index">
          <span>01</span>
          <span>/ PLAYGROUND</span>
        </div>
        <div className="page-hero__copy">
          <span className="eyebrow">
            <CircleDot size={12} /> BROWSER RUNTIME · NO SETUP
          </span>
          <h1>{locale === 'zh' ? '直接改写意图，然后看它如何执行。' : 'Change the intent. Watch execution change with it.'}</h1>
          <p>
            {locale === 'zh'
              ? '解析、格式化、编译并运行真实 Nexilume 源码。每一步都能展开为语法树、执行计划、权限清单和 trace。'
              : 'Parse, format, compile, and run real Nexilume source. Every step opens into syntax, execution IR, authority, and trace.'}
          </p>
        </div>
        <div className="page-hero__aside">
          <strong>{locale === 'zh' ? '浏览器内运行' : 'RUNS IN BROWSER'}</strong>
          <span>{locale === 'zh' ? '内置模拟工具 · 不发送源码' : 'MOCK TOOLS · SOURCE STAYS LOCAL'}</span>
          <ArrowDown size={18} />
        </div>
      </section>

      <section className="playground-shell">
        <div className="sample-picker">
          <div className="sample-picker__intro">
            <span className="eyebrow">LOAD A PROGRAM</span>
            <p>{selected.description[locale]}</p>
          </div>
          <div className="sample-picker__items" role="tablist" aria-label="Example programs">
            {samples.map((sample, index) => (
              <button
                key={sample.slug}
                type="button"
                className={sample.slug === selected.slug ? 'is-active' : ''}
                onClick={() => setSelectedSlug(sample.slug)}
                role="tab"
                aria-selected={sample.slug === selected.slug}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{sample.title[locale]}</strong>
                  <small>{sample.eyebrow}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
        <LanguageWorkbench
          key={selected.slug}
          initialSource={selected.code}
          locale={locale}
        />
      </section>

      <section className="playground-notes section-shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">READ WHAT THE COMPILER READS</span>
            <h2>{locale === 'zh' ? '不只看结果，也看边界。' : 'Inspect the boundary, not only the answer.'}</h2>
          </div>
          <p>
            {locale === 'zh'
              ? 'Agent 的“正确”不仅是输出看起来合理，还要证明每个 effect 都来自合法的权力。'
              : 'An agent is not correct merely because its output looks plausible. Every effect must prove its authority.'}
          </p>
        </div>
        <div className="playground-note-grid">
          <article>
            <FlaskConical size={20} />
            <span>01 / SOURCE</span>
            <h3>{locale === 'zh' ? '改一个真实约束' : 'Change a real constraint'}</h3>
            <p>{locale === 'zh' ? '删掉 capability、压缩预算，或更换失败出口；语言会告诉你哪条路径失去合法性。' : 'Remove a capability, shrink a budget, or change a failure route; the language shows which path stops being legal.'}</p>
          </article>
          <article>
            <Layers3 size={20} />
            <span>02 / IR</span>
            <h3>{locale === 'zh' ? '展开确定性计划' : 'Open the deterministic plan'}</h3>
            <p>{locale === 'zh' ? '编译视图展示 frame、effect、依赖、预算与合并规则，不需要猜测运行时魔法。' : 'The compile view exposes frames, effects, dependencies, budgets, and merges—no runtime magic to guess.'}</p>
          </article>
          <article>
            <ShieldCheck size={20} />
            <span>03 / TRACE</span>
            <h3>{locale === 'zh' ? '验证实际发生的事' : 'Verify what actually happened'}</h3>
            <p>{locale === 'zh' ? '权限决策、工具输入、模型输出与记忆写入构成同一条可回放证据链。' : 'Authority decisions, tool input, model output, and memory writes become one replayable evidence chain.'}</p>
          </article>
        </div>
        <div className="inline-cta">
          <span>{locale === 'zh' ? '需要完整工作区？' : 'Need a complete workspace?'}</span>
          <Link to="/ide">
            {locale === 'zh' ? '打开在线 IDE' : 'Open the online IDE'} <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </>
  )
}

