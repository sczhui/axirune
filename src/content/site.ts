export type Locale = 'zh' | 'en'

export type Sample = {
  slug: string
  title: Record<Locale, string>
  eyebrow: string
  description: Record<Locale, string>
  code: string
  tags: string[]
}

export type DocSection = {
  id: string
  kicker: string
  title: Record<Locale, string>
  summary: Record<Locale, string>
  body: Record<Locale, string[]>
  code?: string
}

export type Concept = {
  index: string
  name: string
  group: string
  title: Record<Locale, string>
  description: Record<Locale, string>
  syntax: string
}

export const navItems = [
  { path: '/playground', label: { zh: '演练场', en: 'Playground' } },
  { path: '/ide', label: { zh: '在线 IDE', en: 'IDE' } },
  { path: '/docs', label: { zh: '文档', en: 'Docs' } },
  { path: '/examples', label: { zh: '示例', en: 'Examples' } },
  { path: '/benchmarks', label: { zh: '基准', en: 'Benchmarks' } },
  { path: '/download', label: { zh: '下载', en: 'Download' } },
] as const

export const heroSource = `space hello
edition 1

grant text.compose to greet

task greet
  give Text
  need text.compose
  let message [call Text.join
    :parts [list «Hello, » «Nexilume» «!»]
  ]
  emit message
  yield message
/task

launch greet`

export const samples: Sample[] = [
  {
    slug: 'hello-boundary',
    title: { zh: '最小权限的问候', en: 'Minimum-authority greeting' },
    eyebrow: 'TASK · CAPABILITY · CALL',
    description: {
      zh: '一个任务声明它需要文本组合能力；只有部署根显式授权后，调用才合法。',
      en: 'A task declares that it needs text composition; the call is legal only after the deployment root grants it.',
    },
    code: heroSource,
    tags: ['task', 'capability', 'call'],
  },
  {
    slug: 'tool-receipt',
    title: { zh: '有回执的天气工具', en: 'Weather tool with a receipt' },
    eyebrow: 'TOOL · CAPABILITY · SANDBOX',
    description: {
      zh: '外部调用同时经过 capability 与 sandbox；输入、权限决定和结果自动进入 trace。',
      en: 'An external call passes both capability and sandbox gates; input, authority decision, and result enter the trace.',
    },
    code: `space tool_receipt
edition 1

grant weather.read to main

capability weather.read
  effect network.read
  resource «https://weather.example/v1»
/capability

tool weather.current
  take city Text trust untrusted
  give Text
  need capability weather.read
  permission ask
  fault ServiceUnavailable
/tool

sandbox weather_demo
  network allow «weather.example»
  clock allow
  limit calls 4
/sandbox

task main
  give Text
  use weather.current
  within weather_demo
  let forecast [call weather.current
    :city «Singapore»
  ]
  emit «Tool receipt attached to trace.»
  yield forecast
/task

launch main`,
    tags: ['tool', 'capability', 'sandbox'],
  },
  {
    slug: 'mcp-codegraph',
    title: { zh: 'MCP 代码图谱', en: 'MCP code graph' },
    eyebrow: 'MCP · CONTEXT · SANDBOX',
    description: {
      zh: 'MCP server 先固定协议与 schema，再生成类型化工具；传输细节不会渗入任务逻辑。',
      en: 'An MCP server pins protocol and schema before exposing typed tools; transport details stay out of task logic.',
    },
    code: `space mcp_native
edition 1

grant repository.read to main

capability repository.read
  effect network.read
  resource «mcp://codegraph»
/capability

mcp codegraph
  transport stdio
  command «gitnexus mcp»
  protocol «2025-06-18»
  import tool query_graph
  import resource repository_context
  need capability repository.read
/mcp

task main
  give Text
  use codegraph.query_graph
  let graph [call codegraph.query_graph
    :query «calls:CheckoutService»
  ]
  emit «MCP response passed schema and capability checks.»
  yield graph
/task

launch main`,
    tags: ['mcp', 'schema', 'capability'],
  },
  {
    slug: 'parallel-triage',
    title: { zh: '结构化并行分诊', en: 'Structured parallel triage' },
    eyebrow: 'FLOW · PARALLEL · TRACE',
    description: {
      zh: '并发不是裸线程：每个分支拥有预算、取消规则和合并契约。',
      en: 'Concurrency is not a raw thread: every branch owns a budget, cancellation rule, and merge contract.',
    },
    code: `space triage
edition 1

task inspect_logs
  give Text
  budget tokens 4000
  yield «log clue»
/task

task inspect_metrics
  give Text
  budget tokens 2000
  yield «metric clue»
/task

task inspect_changes
  give Text
  budget tokens 2000
  yield «deploy clue»
/task

task main
  give Text
  weave inspect_logs | inspect_metrics | inspect_changes as evidence
  emit evidence
  yield «Triage evidence settled.»
/task

launch main`,
    tags: ['parallel', 'budget', 'trace'],
  },
]

export const concepts: Concept[] = [
  {
    index: '01',
    name: 'Intent',
    group: 'SEMANTICS',
    title: { zh: '意图是一等值', en: 'Intent is a value' },
    description: {
      zh: '目标、约束与完成条件由编译器共同检查，不再散落在注释和字符串里。',
      en: 'Goals, constraints, and completion conditions are checked together—not scattered across comments and strings.',
    },
    syntax: 'intent resolve · until verified · /intent',
  },
  {
    index: '02',
    name: 'Authority',
    group: 'SAFETY',
    title: { zh: '权限沿数据流传播', en: 'Authority follows dataflow' },
    description: {
      zh: 'Capability 可组合、可收窄、可耗尽。调用链无法凭空获得调用者没有的权力。',
      en: 'Capabilities compose, narrow, and expire. A call chain cannot invent authority its caller never had.',
    },
    syntax: 'agent scout · need weather_read · /agent',
  },
  {
    index: '03',
    name: 'Memory',
    group: 'STATE',
    title: { zh: '记忆有形状，也有寿命', en: 'Memory has shape and lifetime' },
    description: {
      zh: '工作记忆、会话记忆和持久记忆都有 schema、保留策略与来源标记。',
      en: 'Working, session, and durable memory have schemas, retention policies, and provenance.',
    },
    syntax: 'remember trip :city city :forecast forecast',
  },
  {
    index: '04',
    name: 'Failure',
    group: 'RECOVERY',
    title: { zh: '错误是下一步的协议', en: 'Errors are next-step protocols' },
    description: {
      zh: '错误携带恢复路径、重试预算与是否需要人类介入；未知状态不能被吞掉。',
      en: 'Failures carry recovery routes, retry budgets, and escalation rules; uncertainty cannot be swallowed.',
    },
    syntax: 'route result · when fail recover · /route',
  },
  {
    index: '05',
    name: 'Trace',
    group: 'OBSERVABILITY',
    title: { zh: '每次运行都是可回放证据', en: 'Every run is replayable evidence' },
    description: {
      zh: 'Prompt、工具调用、权限决策和状态变化产生同一条结构化 trace。',
      en: 'Prompts, tool calls, authority decisions, and state changes share one structured trace.',
    },
    syntax: 'checkpoint «finance-approval»',
  },
  {
    index: '06',
    name: 'Flow',
    group: 'CONCURRENCY',
    title: { zh: '并发是结构，不是时序猜谜', en: 'Concurrency is structure' },
    description: {
      zh: '并行分支必须声明预算、终止条件与合并规则，取消会结构化地向下传播。',
      en: 'Parallel branches declare budgets, finish conditions, and merge rules; cancellation propagates structurally.',
    },
    syntax: 'weave evidence · settle first_valid · /weave',
  },
]

export const docSections: DocSection[] = [
  {
    id: 'why-nexilume',
    kicker: '00 / ORIENTATION',
    title: { zh: '为什么是 Nexilume', en: 'Why Nexilume' },
    summary: {
      zh: 'Nexilume 不是让传统程序“调用一下模型”，而是把 Agent 的语义提升到语言层。',
      en: 'Nexilume does not bolt a model call onto a conventional program. It lifts agent semantics into the language.',
    },
    body: {
      zh: [
        'LLM 很擅长生成局部正确的文本，却很难长期维护隐藏在字符串、配置、框架约定和运行时副作用里的真实意图。Nexilume 把这些约定变成编译器看得见的结构。',
        '源代码优先表达“允许发生什么、完成意味着什么、失败后做什么”。编译器再生成确定性执行计划、权限清单和可回放 trace。',
      ],
      en: [
        'LLMs can generate locally plausible text, yet struggle to maintain intent hidden across strings, configuration, framework conventions, and runtime side effects. Nexilume makes those contracts visible to the compiler.',
        'Source expresses what may happen, what completion means, and what follows failure. The compiler produces a deterministic plan, authority manifest, and replayable trace.',
      ],
    },
  },
  {
    id: 'spaces',
    kicker: '01 / PROGRAM SHAPE',
    title: { zh: 'Space 与帧', en: 'Spaces and frames' },
    summary: {
      zh: '一个文件属于一个 space；程序由有名字、有边界的语义帧组成。',
      en: 'A file belongs to one space; a program is made of named, bounded semantic frames.',
    },
    body: {
      zh: [
        'Nexilume 不用 class 充当万能容器。memory、capability、tool、prompt、agent、workflow、context 和 sandbox 各自拥有不同的静态规则。',
        '这让模型可以从局部结构推断意图，也让自动重构只触碰目标语义帧。',
      ],
      en: [
        'Nexilume does not use classes as universal containers. memory, capability, tool, prompt, agent, workflow, context, and sandbox each have distinct static rules.',
        'A model can infer intent from local shape, while automated refactors touch only the semantic frame in scope.',
      ],
    },
    code: `space support
edition 1

memory case_record
  field id Text
  field state CaseState
  retain 30d
  provenance required
/memory

capability crm_read
  allow tool crm.read
/capability

agent resolver
  need crm_read
  use memory case_record
/agent`,
  },
  {
    id: 'types',
    kicker: '02 / TYPE SYSTEM',
    title: { zh: '证据类型与渐进确定性', en: 'Evidence types and progressive certainty' },
    summary: {
      zh: '值不仅有形状，还携带来源、置信度、敏感级别和权限要求。',
      en: 'Values carry shape, provenance, confidence, sensitivity, and authority requirements.',
    },
    body: {
      zh: [
        '普通结构类型描述数据；evidence 类型描述“我们凭什么相信它”。未经验证的模型输出不能直接流入需要 Verified<T> 的工具。',
        'Unknown 不是 null 的别名。它必须被 refine、defer 或显式交给人类，编译器会追踪未解决的不确定性。',
      ],
      en: [
        'Structural types describe data; evidence types describe why it can be trusted. Unverified model output cannot flow into a tool requiring Verified<T>.',
        'Unknown is not another spelling of null. It must be refined, deferred, or explicitly handed to a person; the compiler tracks unresolved uncertainty.',
      ],
    },
    code: `task verify_route
  take guess [Claim Route]
  give [Outcome [Verified Route map_policy] VerifyFault]
  let checked [call map.check
    :route guess
    :policy map_policy
  ]
  yield checked
/task`,
  },
  {
    id: 'authority',
    kicker: '03 / AUTHORITY',
    title: { zh: 'Capability 与 Permission', en: 'Capabilities and permission' },
    summary: {
      zh: '权力不是环境变量，而是可检查、可传递、可耗尽的值。',
      en: 'Authority is not an environment variable. It is a checkable, transferable, exhaustible value.',
    },
    body: {
      zh: [
        'capability 声明可用工具和硬限制；agent 或 workflow 必须通过 uses 明确接收。子流程只能获得父流程权限的子集。',
        '静态清单处理已知边界，运行时 permit 处理依赖真实参数的决策。所有 allow、deny 与 escalate 都进入 trace。',
      ],
      en: [
        'A capability declares tools and hard limits; agents and workflows receive it explicitly through uses. A child flow can only inherit a subset.',
        'The static manifest handles known boundaries; runtime permits decide parameter-dependent requests. Every allow, deny, and escalation enters the trace.',
      ],
    },
    code: `capability billing_read
  allow tool invoice.read
  allow tool refund.prepare
  deny tool refund.commit
  limit calls 8
/capability

permission finance_approval
  take request RefundRequest
  when approved
    mint refund_commit for 10m
  /when
/permission`,
  },
  {
    id: 'tools-mcp',
    kicker: '04 / EXTERNAL WORLD',
    title: { zh: 'Tool Call 与 MCP', en: 'Tool calls and MCP' },
    summary: {
      zh: '外部调用是语言级 effect；MCP 是有 schema 的模块边界。',
      en: 'External calls are language-level effects; MCP is a schema-bearing module boundary.',
    },
    body: {
      zh: [
        '每个 tool call 的输入、输出、超时、幂等性和权限要求都进入 IR。调用结果默认携带来源信息。',
        'mcp 帧把远程 server 转成可检查的命名空间。传输方式不会泄漏到业务逻辑，测试时可由模拟端口替换。',
      ],
      en: [
        'Every tool call contributes input, output, timeout, idempotency, and authority requirements to IR. Results carry provenance by default.',
        'An mcp frame turns a remote server into a checkable namespace. Transport does not leak into business logic and can be replaced by a simulated port in tests.',
      ],
    },
    code: `mcp papers
  transport stdio
  endpoint «paper-index»
  pin schema «sha256:91b7»
  expose search
  expose fetch
/mcp

let hits [call papers.search
  :query query
  :limit 6
]`,
  },
  {
    id: 'context-memory',
    kicker: '05 / COGNITION',
    title: { zh: 'Prompt、Context 与 Memory', en: 'Prompt, context, and memory' },
    summary: {
      zh: '给模型看的、模型记住的、程序持久化的是三种不同东西。',
      en: 'What a model sees, what it remembers, and what a program persists are three different things.',
    },
    body: {
      zh: [
        'prompt 是版本化模板，输入与输出有类型；context 是一次推理可见的受预算视图；memory 是跨步骤或跨运行的显式状态。',
        '编译器可以计算上下文上限、识别敏感字段泄漏，并在自动重构时保持 prompt 契约。',
      ],
      en: [
        'A prompt is a versioned, typed template; context is a budgeted view visible to one inference; memory is explicit state across steps or runs.',
        'The compiler can bound context, catch sensitive-field leakage, and preserve prompt contracts through automated refactors.',
      ],
    },
    code: `context brief
  budget tokens 24000
  keep goal
  keep evidence
  redact customer.ssn
  forget raw_results after 15m
/context`,
  },
  {
    id: 'agents-workflows',
    kicker: '06 / EXECUTION',
    title: { zh: 'Agent 与 Workflow', en: 'Agents and workflows' },
    summary: {
      zh: 'Agent 负责受约束判断；Workflow 负责可预测编排。',
      en: 'Agents own bounded judgment; workflows own predictable orchestration.',
    },
    body: {
      zh: [
        'agent 可以观察、推理、调用工具并发出事件，但只能在声明的 capability、context 和 sandbox 内行动。',
        'workflow 定义 step、依赖、并行、checkpoint 与 merge。两者可组合，但不会混成一个不可分析的回调图。',
      ],
      en: [
        'An agent may observe, reason, call tools, and emit events, but only inside its declared capability, context, and sandbox.',
        'A workflow defines steps, dependencies, parallelism, checkpoints, and merges. The two compose without collapsing into an opaque callback graph.',
      ],
    },
    code: `workflow publish
  stable «publish.v1»
  take draft Draft
  give [Outcome Release PublishFault]

  stage verify
    next approve
  /stage

  stage approve
    checkpoint «editor»
    next release
  /stage

  stage release
    yield [ok release]
    compensate unpublish
  /stage
/workflow`,
  },
  {
    id: 'concurrency',
    kicker: '07 / CONCURRENCY',
    title: { zh: '结构化并发', en: 'Structured concurrency' },
    summary: {
      zh: '没有失联任务：生命周期、预算与取消都属于父级作用域。',
      en: 'No orphan work: lifetime, budget, and cancellation belong to a parent scope.',
    },
    body: {
      zh: [
        'parallel 块必须声明完成策略。first_valid、all、quorum 等策略让结果合并可读，也让资源消耗可计算。',
        '父级结束会取消未完成分支；分支不能在作用域外偷偷保留权限或上下文。',
      ],
      en: [
        'A parallel block declares a completion strategy. first_valid, all, and quorum make merging readable and resource use calculable.',
        'Finishing the parent cancels unfinished branches; a branch cannot retain authority or context beyond its scope.',
      ],
    },
    code: `weave evidence
  settle first_valid
  within 8s

  branch logs
    budget tokens 4000
    yield [call inspect.logs :source incident.logs]
  /branch

  branch metrics
    budget tokens 2000
    yield [call inspect.metrics :source incident.metrics]
  /branch
/weave`,
  },
  {
    id: 'failure',
    kicker: '08 / FAILURE',
    title: { zh: '可恢复错误', en: 'Recoverable failure' },
    summary: {
      zh: 'Error 描述状态、证据和下一条合法路径，而不是一段待匹配文本。',
      en: 'An error describes state, evidence, and legal next routes—not a string to pattern-match later.',
    },
    body: {
      zh: [
        'retry 需要预算和退避；fallback 需要类型兼容；escalate 需要明确接收者。编译器会拒绝没有出口的 effectful failure。',
        '当副作用结果未知时，Nexilume 进入 uncertain 状态并要求 reconcile，避免重复扣款一类的“重试成功”。',
      ],
      en: [
        'Retries need budgets and backoff; fallbacks need compatible types; escalation needs a named receiver. The compiler rejects effectful failures with no route.',
        'When an effect outcome is unknown, Nexilume enters uncertain state and requires reconciliation, avoiding the classic “successful retry” that charges twice.',
      ],
    },
    code: `route charge_result
  when ok receipt
    yield receipt
  /when
  when fail transient
    retry 2 backoff exponential
  /when
  when fail uncertain
    reconcile [call ledger.lookup :id charge_id]
  /when
  when fail permanent
    escalate finance_desk
  /when
/route`,
  },
  {
    id: 'sandbox',
    kicker: '09 / CONTAINMENT',
    title: { zh: 'Sandbox 是程序边界', en: 'Sandbox is a program boundary' },
    summary: {
      zh: '网络、文件、进程、时间和预算限制都是可编译策略。',
      en: 'Network, filesystem, process, time, and budget limits are compilable policy.',
    },
    body: {
      zh: [
        'sandbox 与 capability 分工明确：capability 说明“允许做什么”，sandbox 说明“执行环境最多能触及哪里”。两层都必须通过。',
        'manifest 命令可以在运行前导出部署所需的最小权限。',
      ],
      en: [
        'Sandbox and capability divide responsibility: capability says what may be done; sandbox says what the execution environment can reach. Both gates must pass.',
        'The manifest command exports minimum deployment authority before anything runs.',
      ],
    },
    code: `sandbox worker
  network allow «api.example»
  filesystem allow «/work/out» write
  process deny all
  walltime 30s
/sandbox`,
  },
]

export const quickStart = `npm install -g https://nexilume.velhu.com/downloads/nexilume-language-0.1.0.tgz
nexilume check hello.nxl
nexilume run hello.nxl`

export const cliCommands = [
  ['nexilume check', '静态检查 / static checks'],
  ['nexilume run', '解释执行 / execute'],
  ['nexilume build', '编译 IR / compile IR'],
  ['nexilume fmt', '结构化格式化 / format'],
  ['nexilume ast', '查看语法树 / inspect AST'],
  ['nexilume ir', '查看执行计划 / inspect IR'],
  ['nexilume manifest', '导出最小权限 / authority manifest'],
  ['nexilume bench', '运行基准 / benchmark'],
] as const
