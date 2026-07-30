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
          <span>AX</span>
        </div>
        <div className="hero__copy">
          <div className="hero__meta">
            <span className="live-mark">
              <i /> GENERAL-PURPOSE LANGUAGE · 0.3.1
            </span>
            <span>DETERMINISTIC BY DEFAULT</span>
          </div>
          <h1>
            <span>Make intent</span>
            <strong>axiomatic.</strong>
            <span>Bound every</span>
            <strong>effect.</strong>
          </h1>
          <p className="hero__lead">
            {locale === 'zh'
              ? 'Axirune 源自 axiom 与 rune：让意图成为可检查的公理。无需模型即可编译、解释运行完整程序；AI、MCP 与工具调用只是受权限约束的可选能力。'
              : 'Axirune joins axiom and rune: make intent explicit enough to inspect. Compile and run complete programs without a model; AI, MCP, and tools are optional, capability-gated effects.'}
          </p>
          <div className="hero__actions">
            <Link to="/playground" className="button button--signal">
              <Play size={16} fill="currentColor" />
              {locale === 'zh' ? '立即运行' : 'Run Axirune'}
            </Link>
            <Link to="/docs" className="text-link">
              {locale === 'zh' ? '阅读语言设计' : 'Read the language design'}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero__facts" aria-label="Project facts">
            <div>
              <strong>0</strong>
              <span>{locale === 'zh' ? '必需模型' : 'REQUIRED MODELS'}</span>
            </div>
            <div>
              <strong>PURE</strong>
              <span>{locale === 'zh' ? '确定性核心' : 'DETERMINISTIC CORE'}</span>
            </div>
            <div>
              <strong>.axi</strong>
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
          <span>VALUE</span>
          <i>→</i>
          <span>TASK</span>
          <i>→</i>
          <span>OUTCOME</span>
          <i>→</i>
          <span>EFFECT</span>
          <i>→</i>
          <span>OPTIONAL AI</span>
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
                程序先是确定的。
                <br />
                Effect 必须有边界。
                <br />
                AI 永远是可选项。
              </>
            ) : (
              <>
                Programs are deterministic.
                <br />
                Effects have boundaries.
                <br />
                AI stays optional.
              </>
            )}
          </h2>
          <div className="manifesto__columns">
            <p>
              {locale === 'zh'
                ? 'Axirune 可以只用 shape、task、递归、集合变换、Outcome 与纯 builtin 写业务程序。相同源码与输入产生相同的值和语义 trace。'
                : 'Axirune can express complete applications with shapes, tasks, recursion, collection transforms, Outcome, and pure builtins. The same source and input produce the same value and semantic trace.'}
            </p>
            <p>
              {locale === 'zh'
                ? '只有当程序选择文件、网络、MCP 或模型时，capability 与 sandbox 才进入执行路径。AI 扩展语言，但不定义语言。'
                : 'Capabilities and sandboxes enter the path only when a program chooses files, network, MCP, or a model. AI extends the language; it does not define it.'}
            </p>
          </div>
        </div>
      </section>

      <section className="concept-section section-shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">02 / SEMANTIC CORE</span>
            <h2>{locale === 'zh' ? '足以编写完整程序的确定性核心' : 'A deterministic core for complete programs'}</h2>
          </div>
          <p>
              {locale === 'zh'
              ? '数据、函数、递归、控制流与错误都是语言本体；外部世界和 AI 被隔离在显式 effect 边界之外。'
              : 'Data, functions, recursion, control flow, and errors live in the language core; the outside world and AI remain behind explicit effect boundaries.'}
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
                {concept.name === 'Value' ? <Braces /> : null}
                {concept.name === 'Task' ? <Cpu /> : null}
                {concept.name === 'Data' ? <GitBranch /> : null}
                {concept.name === 'Outcome' ? <ShieldCheck /> : null}
                {concept.name === 'Effect' ? <KeyRound /> : null}
                {concept.name === 'Optional AI' ? <Network /> : null}
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
              <h2>{locale === 'zh' ? 'Deterministic Core / Optional AI' : 'Deterministic Core / Optional AI'}</h2>
            </div>
            <p>
              {locale === 'zh'
                ? '纯程序直接进入确定性解释器；文件、网络、MCP 与模型只能通过可检查的 effect 网关接入。'
                : 'Pure programs go straight to the deterministic interpreter. Files, network, MCP, and models connect only through checked effect gateways.'}
            </p>
          </div>
          <div className="pipeline">
            <article>
              <span className="pipeline__number">01</span>
              <Braces size={22} />
              <h3>Shapes & tasks</h3>
              <p>{locale === 'zh' ? '解析数据结构、命名参数、用户 task、递归与显式结果类型。' : 'Resolve data shapes, named arguments, user tasks, recursion, and explicit result types.'}</p>
              <small>PARSE · TYPE · RESOLVE</small>
            </article>
            <span className="pipeline__arrow" aria-hidden="true">
              →
            </span>
            <article>
              <span className="pipeline__number">02</span>
              <Cpu size={22} />
              <h3>Pure builtins</h3>
              <p>{locale === 'zh' ? 'Number、Bool、Text、List、Record、Json 与 Outcome 不需要任何外部权限。' : 'Number, Bool, Text, List, Record, Json, and Outcome require no external authority.'}</p>
              <small>CALCULATE · TRANSFORM · ENCODE</small>
            </article>
            <span className="pipeline__arrow" aria-hidden="true">
              →
            </span>
            <article>
              <span className="pipeline__number">03</span>
              <GitBranch size={22} />
              <h3>Checked IR</h3>
              <p>{locale === 'zh' ? '编译为可检查 IR，再由有 fuel 上限的解释器执行并生成语义 trace。' : 'Compile to inspectable IR, then execute in a fuel-bounded interpreter with a semantic trace.'}</p>
              <small>COMPILE · INTERPRET · TRACE</small>
            </article>
            <span className="pipeline__arrow" aria-hidden="true">
              →
            </span>
            <article>
              <span className="pipeline__number">04</span>
              <KeyRound size={22} />
              <h3>Optional effects</h3>
              <p>{locale === 'zh' ? 'I/O、工具、MCP 与模型是可替换适配器，必须获得 capability 才能运行。' : 'I/O, tools, MCP, and models are replaceable adapters and run only with explicit capabilities.'}</p>
              <small>FILES · MCP · MODEL / OPTIONAL</small>
            </article>
          </div>
        </div>
      </section>

      <section className="ai-readability section-shell">
        <div className="section-index">
          <span>04</span>
          <p>LLM-LEGIBLE · HUMAN-AUDITABLE</p>
        </div>
        <div className="ai-readability__content">
          <div>
            <span className="eyebrow">{locale === 'zh' ? '适合 LLM 编写，不依赖 LLM 运行' : 'LLM-WRITABLE, LLM-INDEPENDENT AT RUNTIME'}</span>
            <h2>{locale === 'zh' ? '让模型理解程序，不让模型成为程序的前提。' : 'Let models understand the program—never become its prerequisite.'}</h2>
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
                zh: '用户 task 只用命名参数调用，签名扩展不会挪动位置。',
                en: 'User tasks use named arguments, so signatures can evolve without positional drift.',
              },
              {
                code: '03',
                zh: '纯 builtin 与 effect adapter 分层，重构计算不会意外获得 I/O。',
                en: 'Pure builtins and effect adapters are separate, so refactoring computation cannot gain I/O.',
              },
              {
                code: '04',
                zh: 'AST、IR、Outcome 与 trace 提供机器可读的验证表面。',
                en: 'AST, IR, Outcome, and traces provide machine-readable verification surfaces.',
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
          <span className="eyebrow">REAL APPLICATION · AXIRUNE SOURCE · ZERO MODEL CALLS</span>
          <h2>
            {locale === 'zh'
              ? '亲手运行一个业务逻辑写在 Axirune 里的网页应用。'
              : 'Run a web application whose business logic is written in Axirune.'}
          </h2>
          <div className="home-cta__actions">
            <Link to="/showcase/ledger" className="button button--ink">
              {locale === 'zh' ? '打开 AxiLedger' : 'Open AxiLedger'} <ArrowRight size={16} />
            </Link>
            <Link to="/playground" className="button button--ghost">
              {locale === 'zh' ? '打开 Playground' : 'Open Playground'}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
