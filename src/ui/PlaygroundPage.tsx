import { ArrowDown, ArrowRight, CircleDot, FlaskConical, Layers3, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { runtimeLabels, samples, type Locale } from '../content/site'
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
            <CircleDot size={12} /> DETERMINISTIC BROWSER RUNTIME · NO MODEL
          </span>
          <h1>{locale === 'zh' ? '写一个普通程序。立即编译并运行。' : 'Write an ordinary program. Compile and run it now.'}</h1>
          <p>
            {locale === 'zh'
              ? '默认示例使用 shape、用户 task、算术、List.fold 与 Json.encode 完成发票汇总。整个运行不调用模型、工具或网络。'
              : 'The default invoice uses shapes, user tasks, arithmetic, List.fold, and Json.encode. The entire run uses no model, tool, or network.'}
          </p>
        </div>
        <div className="page-hero__aside">
          <strong>{locale === 'zh' ? '确定性解释运行' : 'DETERMINISTIC INTERPRETER'}</strong>
          <span>{locale === 'zh' ? '无模型 · 无网络 · 源码留在本地' : 'NO MODEL · NO NETWORK · SOURCE STAYS LOCAL'}</span>
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
                  <em className={`runtime-label runtime-label--${sample.runtime}`}>
                    {runtimeLabels[sample.runtime][locale]}
                  </em>
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
            <h2>{locale === 'zh' ? '从值到结果，每一步都可检查。' : 'Every step from value to result is inspectable.'}</h2>
          </div>
          <p>
              {locale === 'zh'
              ? '纯计算不需要 capability；只有选择 I/O 或 AI 时，权限清单才会出现对应 effect。'
              : 'Pure computation needs no capability. Effects appear in the authority manifest only when the program chooses I/O or AI.'}
          </p>
        </div>
        <div className="playground-note-grid">
          <article>
            <FlaskConical size={20} />
            <span>01 / SOURCE</span>
            <h3>{locale === 'zh' ? '改一个真实输入' : 'Change a real input'}</h3>
            <p>{locale === 'zh' ? '修改商品数量、价格或折扣；确定性结果与 JSON 输出会同步变化。' : 'Change item quantity, price, or discount; the deterministic result and JSON output update together.'}</p>
          </article>
          <article>
            <Layers3 size={20} />
            <span>02 / IR</span>
            <h3>{locale === 'zh' ? '展开确定性计划' : 'Open the deterministic plan'}</h3>
            <p>{locale === 'zh' ? '编译视图展示 shape、task 调用、递归边、builtin 与 Outcome，不需要猜测运行时魔法。' : 'The compile view exposes shapes, task calls, recursion edges, builtins, and Outcome—no runtime magic to guess.'}</p>
          </article>
          <article>
            <ShieldCheck size={20} />
            <span>03 / TRACE</span>
            <h3>{locale === 'zh' ? '验证实际计算过程' : 'Verify the actual computation'}</h3>
            <p>{locale === 'zh' ? 'task 调用、fold 步骤、条件分支、emit 与最终值构成可回放的语义 trace。' : 'Task calls, fold steps, condition branches, emissions, and the final value form a replayable semantic trace.'}</p>
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
