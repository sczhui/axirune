import {
  ArrowRight,
  Braces,
  Check,
  CircleDot,
  Cpu,
  GitBranch,
  KeyRound,
  Network,
  Play,
  ShieldCheck,
} from 'lucide-react'
import { concepts, heroSource, type Locale } from '../content/site'
import { LanguageWorkbench } from './LanguageWorkbench'
import { Link } from './Router'

export function HomePage({ locale }: { locale: Locale }) {
  return (
    <>
      <section className="hero">
        <div className="hero__grid-mark" aria-hidden="true">
          <span>001</span>
          <span>101</span>
          <span>NX</span>
        </div>
        <div className="hero__copy">
          <div className="hero__meta">
            <span className="live-mark">
              <i /> OPEN LANGUAGE · 0.1.0
            </span>
            <span>FOR AGENTIC SOFTWARE</span>
          </div>
          <h1>
            <span>Illuminate</span>
            <strong>intent.</strong>
            <span>Bound every</span>
            <strong>effect.</strong>
          </h1>
          <p className="hero__lead">
            {locale === 'zh'
              ? '一门为 AI Agent 原生设计的新语言。让意图、权限、工具、记忆与恢复路径都成为编译器能看见的程序。'
              : 'A new language native to AI agents—where intent, authority, tools, memory, and recovery routes are all visible to the compiler.'}
          </p>
          <div className="hero__actions">
            <Link to="/playground" className="button button--signal">
              <Play size={16} fill="currentColor" />
              {locale === 'zh' ? '立即运行' : 'Run Nexilume'}
            </Link>
            <Link to="/docs" className="text-link">
              {locale === 'zh' ? '阅读语言设计' : 'Read the language design'}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero__facts" aria-label="Project facts">
            <div>
              <strong>8</strong>
              <span>{locale === 'zh' ? '原生语义帧' : 'NATIVE FRAMES'}</span>
            </div>
            <div>
              <strong>0</strong>
              <span>{locale === 'zh' ? '隐式权限' : 'IMPLICIT AUTHORITY'}</span>
            </div>
            <div>
              <strong>.nxl</strong>
              <span>{locale === 'zh' ? '源文件' : 'SOURCE FILE'}</span>
            </div>
          </div>
        </div>

        <div className="hero__demo">
          <div className="hero__demo-label">
            <span>
              <CircleDot size={12} />
              LIVE / EDITABLE
            </span>
            <span>WEB RUNTIME</span>
          </div>
          <LanguageWorkbench initialSource={heroSource} locale={locale} compact preview />
        </div>
      </section>

      <div className="signal-strip" aria-hidden="true">
        <div>
          <span>INTENT</span>
          <i>→</i>
          <span>TYPE</span>
          <i>→</i>
          <span>AUTHORITY</span>
          <i>→</i>
          <span>PLAN</span>
          <i>→</i>
          <span>TRACE</span>
          <i>→</i>
          <span>RECOVERY</span>
        </div>
      </div>

      <section className="manifesto section-shell">
        <div className="section-index">
          <span>01</span>
          <p>LANGUAGE PHILOSOPHY</p>
        </div>
        <div className="manifesto__body">
          <span className="eyebrow">{locale === 'zh' ? '换一个起点' : 'A DIFFERENT STARTING POINT'}</span>
          <h2>
            {locale === 'zh' ? (
              <>
                Agent 不是函数。
                <br />
                Prompt 不是字符串。
                <br />
                权限不是配置。
              </>
            ) : (
              <>
                An agent is not a function.
                <br />
                A prompt is not a string.
                <br />
                Authority is not config.
              </>
            )}
          </h2>
          <div className="manifesto__columns">
            <p>
              {locale === 'zh'
                ? '传统语言把 Agent 的真实行为藏在 SDK、回调、环境变量与自然语言里。人类难以审查，模型更难安全重构。'
                : 'Traditional languages hide agent behavior in SDKs, callbacks, environment variables, and prose—hard for people to audit and harder for models to refactor safely.'}
            </p>
            <p>
              {locale === 'zh'
                ? 'Nexilume 直接描述目标、可用权力、认知预算与失败出口。代码更接近意图，同时保留机器可验证的硬边界。'
                : 'Nexilume directly describes goals, available authority, cognition budgets, and failure routes. Code stays close to intent without giving up machine-verifiable boundaries.'}
            </p>
          </div>
        </div>
      </section>

      <section className="concept-section section-shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">02 / SEMANTIC CORE</span>
            <h2>{locale === 'zh' ? '为 Agent 重新发明基本单元' : 'Reinventing the unit of software'}</h2>
          </div>
          <p>
            {locale === 'zh'
              ? '每个概念都有自己的静态规则、运行时行为与 trace 形状。'
              : 'Every concept has its own static rules, runtime behavior, and trace shape.'}
          </p>
        </div>
        <div className="concept-grid">
          {concepts.map((concept) => (
            <article className="concept-card" key={concept.name}>
              <div className="concept-card__top">
                <span>{concept.index}</span>
                <span>{concept.group}</span>
              </div>
              <div className="concept-card__glyph" aria-hidden="true">
                {concept.name === 'Intent' ? <Braces /> : null}
                {concept.name === 'Authority' ? <KeyRound /> : null}
                {concept.name === 'Memory' ? <Cpu /> : null}
                {concept.name === 'Failure' ? <ShieldCheck /> : null}
                {concept.name === 'Trace' ? <Network /> : null}
                {concept.name === 'Flow' ? <GitBranch /> : null}
              </div>
              <span className="concept-card__name">{concept.name}</span>
              <h3>{concept.title[locale]}</h3>
              <p>{concept.description[locale]}</p>
              <code>{concept.syntax}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="pipeline-section">
        <div className="section-shell">
          <div className="section-heading section-heading--light">
            <div>
              <span className="eyebrow">03 / COMPILATION MODEL</span>
              <h2>{locale === 'zh' ? '从意图到证据，不跳步' : 'Intent to evidence, with no hidden step'}</h2>
            </div>
            <p>
              {locale === 'zh'
                ? '编译结果不只是一段机器码，而是可执行计划、最小权限清单与审计协议。'
                : 'Compilation produces more than code: an execution plan, minimum-authority manifest, and audit protocol.'}
            </p>
          </div>
          <div className="pipeline">
            <article>
              <span className="pipeline__number">01</span>
              <Braces size={22} />
              <h3>Semantic frames</h3>
              <p>{locale === 'zh' ? '识别 Agent、工具、记忆、上下文与工作流的边界。' : 'Resolve agents, tools, memory, context, and workflow boundaries.'}</p>
              <small>PARSE · RESOLVE · REFINE</small>
            </article>
            <span className="pipeline__arrow" aria-hidden="true">
              →
            </span>
            <article>
              <span className="pipeline__number">02</span>
              <KeyRound size={22} />
              <h3>Authority graph</h3>
              <p>{locale === 'zh' ? '证明每个 effect 都有来源明确、范围足够的 capability。' : 'Prove every effect has a sourced, sufficiently narrow capability.'}</p>
              <small>PROVE · NARROW · MANIFEST</small>
            </article>
            <span className="pipeline__arrow" aria-hidden="true">
              →
            </span>
            <article>
              <span className="pipeline__number">03</span>
              <GitBranch size={22} />
              <h3>Deterministic IR</h3>
              <p>{locale === 'zh' ? '固定并发、预算、checkpoint、失败与补偿路径。' : 'Fix concurrency, budgets, checkpoints, failure, and compensation routes.'}</p>
              <small>PLAN · BUDGET · BIND</small>
            </article>
            <span className="pipeline__arrow" aria-hidden="true">
              →
            </span>
            <article>
              <span className="pipeline__number">04</span>
              <Network size={22} />
              <h3>Replayable trace</h3>
              <p>{locale === 'zh' ? '把判断、权限、工具结果与状态变化连接成证据链。' : 'Join decisions, authority, tool results, and state changes into evidence.'}</p>
              <small>RUN · OBSERVE · REPLAY</small>
            </article>
          </div>
        </div>
      </section>

      <section className="ai-readability section-shell">
        <div className="section-index">
          <span>04</span>
          <p>LLM-NATIVE MAINTENANCE</p>
        </div>
        <div className="ai-readability__content">
          <div>
            <span className="eyebrow">{locale === 'zh' ? '为模型可读，不为模型放权' : 'MODEL-LEGIBLE, NOT MODEL-PRIVILEGED'}</span>
            <h2>{locale === 'zh' ? '局部结构足够清楚，自动重构才值得信任。' : 'Local structure clear enough to trust automated refactoring.'}</h2>
          </div>
          <div className="readability-list">
            {[
              {
                code: '01',
                zh: '显式结束帧让结构不依赖空格猜测。',
                en: 'Explicit frame endings remove whitespace guesswork.',
              },
              {
                code: '02',
                zh: '所有调用只允许命名参数，重排不会改变语义。',
                en: 'Named-only calls make reordering semantics-safe.',
              },
              {
                code: '03',
                zh: '语义帧各司其职，修改 prompt 不会误触权限。',
                en: 'Purpose-built frames keep prompt edits away from authority.',
              },
              {
                code: '04',
                zh: '编译器导出机器可读的意图、effect 与权限差异。',
                en: 'The compiler exports machine-readable intent, effect, and authority diffs.',
              },
            ].map((item) => (
              <div key={item.code}>
                <span>{item.code}</span>
                <Check size={15} />
                <p>{item[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-cta">
        <div className="home-cta__grid" aria-hidden="true" />
        <div>
          <span className="eyebrow">WRITE THE BOUNDARY. RUN THE INTENT.</span>
          <h2>{locale === 'zh' ? '让第一个 Agent 程序拥有可证明的边界。' : 'Give your first agent a boundary it can prove.'}</h2>
          <div className="home-cta__actions">
            <Link to="/playground" className="button button--ink">
              {locale === 'zh' ? '打开 Playground' : 'Open Playground'} <ArrowRight size={16} />
            </Link>
            <Link to="/download" className="button button--ghost">
              {locale === 'zh' ? '安装工具链' : 'Install toolchain'}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
