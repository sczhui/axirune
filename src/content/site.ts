import factorialSource from '../../examples/factorial.axi?raw'
import helloSource from '../../examples/hello.axi?raw'
import invoiceSource from '../../examples/invoice-total.axi?raw'
import mcpSource from '../../examples/mcp-native.axi?raw'
import optionalAiSource from '../../examples/optional-ai.axi?raw'
import outcomeSource from '../../examples/outcome-division.axi?raw'
import wordFrequencySource from '../../examples/word-frequency.axi?raw'

export type Locale = 'zh' | 'en'
export type RuntimeClass = 'core' | 'io' | 'ai'

export type Sample = {
  slug: string
  title: Record<Locale, string>
  eyebrow: string
  description: Record<Locale, string>
  code: string
  tags: string[]
  runtime: RuntimeClass
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

export const heroSource = invoiceSource.trim()

export const runtimeLabels: Record<RuntimeClass, Record<Locale, string>> = {
  core: { zh: '纯核心 · 无需 LLM', en: 'PURE CORE · NO LLM' },
  io: { zh: '可选 I/O · 无需 LLM', en: 'OPTIONAL I/O · NO LLM' },
  ai: { zh: '可选 AI / MCP', en: 'OPTIONAL AI / MCP' },
}

export const samples: Sample[] = [
  {
    slug: 'invoice-total',
    title: { zh: '发票汇总', en: 'Invoice total' },
    eyebrow: 'SHAPE · TASK · FOLD · JSON',
    description: {
      zh: '用 shape、用户 task、算术、List.fold 与 Json.encode 汇总三条发票明细。整个程序不调用模型、工具或网络。',
      en: 'Summarize three invoice lines with shapes, user tasks, arithmetic, List.fold, and Json.encode. No model, tool, or network is involved.',
    },
    code: invoiceSource.trim(),
    tags: ['shape', 'task', 'List.fold', 'Json.encode'],
    runtime: 'core',
  },
  {
    slug: 'factorial',
    title: { zh: '递归阶乘', en: 'Recursive factorial' },
    eyebrow: 'TASK CALL · RECURSION · LAZY IF',
    description: {
      zh: '用户 task 在表达式中调用自身；Core.if 只求值选中的分支，因此递归能确定终止。',
      en: 'A user task calls itself inside an expression. Core.if evaluates only the selected branch, so recursion terminates deterministically.',
    },
    code: factorialSource.trim(),
    tags: ['recursion', 'Core.if', 'Number'],
    runtime: 'core',
  },
  {
    slug: 'hello',
    title: { zh: '用户 Task 调用', en: 'User task call' },
    eyebrow: 'TASK · NAMED ARGUMENTS · TEXT',
    description: {
      zh: '最小完整程序：main 以命名参数调用 greet，再输出确定性文本。',
      en: 'The smallest complete program: main calls greet with a named argument and emits deterministic text.',
    },
    code: helloSource.trim(),
    tags: ['task', 'named call', 'Text.join'],
    runtime: 'core',
  },
  {
    slug: 'outcome-division',
    title: { zh: '安全除法 Outcome', en: 'Safe division Outcome' },
    eyebrow: 'OUTCOME · LAZY BRANCH · JSON',
    description: {
      zh: '除数为零不是隐藏异常：safe_divide 返回显式失败值，未选择的除法分支不会运行。',
      en: 'Division by zero is not a hidden exception. safe_divide returns an explicit failure value and the unselected division branch never runs.',
    },
    code: outcomeSource.trim(),
    tags: ['Outcome', 'Core.if', 'Json.encode'],
    runtime: 'core',
  },
  {
    slug: 'word-frequency',
    title: { zh: '文件词频 CLI', en: 'File word-frequency CLI' },
    eyebrow: 'FILE I/O · CAPABILITY · FOLD',
    description: {
      zh: '读取文件是显式 effect；分词、计数与 JSON 编码仍由确定性核心完成，不需要 LLM。',
      en: 'Reading a file is an explicit effect; splitting, counting, and JSON encoding remain deterministic and require no LLM.',
    },
    code: wordFrequencySource.trim(),
    tags: ['filesystem', 'capability', 'Record', 'List.fold'],
    runtime: 'io',
  },
  {
    slug: 'mcp-codegraph',
    title: { zh: '可选 MCP 代码图谱', en: 'Optional MCP code graph' },
    eyebrow: 'OPTIONAL · MCP · CAPABILITY',
    description: {
      zh: 'MCP 是独立的可选适配器。协议、导入工具与资源权限均在源码中显式声明。',
      en: 'MCP is an independent optional adapter. Protocol, imported tools, and resource authority are explicit in source.',
    },
    code: mcpSource.trim(),
    tags: ['optional', 'MCP', 'schema', 'capability'],
    runtime: 'ai',
  },
  {
    slug: 'optional-ai',
    title: { zh: '可选 AI 工单分类', en: 'Optional AI ticket triage' },
    eyebrow: 'OPTIONAL · PROMPT · AGENT · MODEL',
    description: {
      zh: '只有这个被明确标记的示例需要模型能力；prompt、非可信数据、预算和权限都有独立 frame。',
      en: 'Only this explicitly labelled example needs model authority. Prompt, untrusted data, budget, and permission each have a separate frame.',
    },
    code: optionalAiSource.trim(),
    tags: ['optional AI', 'prompt', 'agent', 'capability'],
    runtime: 'ai',
  },
]

export const concepts: Concept[] = [
  {
    index: '01',
    name: 'Value',
    group: 'DATA',
    title: { zh: '值是不可变数据', en: 'Values are immutable data' },
    description: {
      zh: 'Number、Bool、Text、List 与 Record 组成确定性值世界；shape 为业务数据命名。',
      en: 'Number, Bool, Text, List, and Record form the deterministic value world; shapes name domain data.',
    },
    syntax: '[record :sku «paper» :quantity 2]',
  },
  {
    index: '02',
    name: 'Task',
    group: 'COMPUTATION',
    title: { zh: 'Task 是命名函数', en: 'Tasks are named functions' },
    description: {
      zh: 'task 只接受命名参数，可在表达式中调用其他 task，也可以递归调用自身。',
      en: 'Tasks accept named arguments, call other tasks in expressions, and may call themselves recursively.',
    },
    syntax: '[call factorial :n 6]',
  },
  {
    index: '03',
    name: 'Data',
    group: 'TRANSFORM',
    title: { zh: '集合变换可检查', en: 'Collection transforms are inspectable' },
    description: {
      zh: 'List.map、filter、fold 通过 :using 指定回调 task，不捕获隐藏闭包。',
      en: 'List.map, filter, and fold name callback tasks through :using and capture no hidden closure.',
    },
    syntax: '[call List.fold :list xs :using «sum» :initial 0]',
  },
  {
    index: '04',
    name: 'Outcome',
    group: 'FAILURE',
    title: { zh: '错误是返回值', en: 'Failure is a return value' },
    description: {
      zh: 'Outcome.ok 与 Outcome.fail 让预期失败进入类型与数据流，而不是进入隐藏异常通道。',
      en: 'Outcome.ok and Outcome.fail keep expected failure in types and dataflow, not a hidden exception channel.',
    },
    syntax: '[call Outcome.fail :fault reason]',
  },
  {
    index: '05',
    name: 'Effect',
    group: 'AUTHORITY',
    title: { zh: '外部世界按需接入', en: 'The outside world is opt-in' },
    description: {
      zh: '文件、网络与进程需要 capability、permission 与 sandbox；纯程序的权限清单为空。',
      en: 'Files, network, and processes need capability, permission, and sandbox; a pure program has an empty manifest.',
    },
    syntax: 'need capability host.fs.read',
  },
  {
    index: '06',
    name: 'Optional AI',
    group: 'EXTENSION',
    title: { zh: 'AI 扩展语言，不定义语言', en: 'AI extends; it does not define' },
    description: {
      zh: 'Prompt、Context、Memory、Agent 与 MCP 仅在需要推理或外部协议时启用。',
      en: 'Prompt, Context, Memory, Agent, and MCP activate only when inference or an external protocol is needed.',
    },
    syntax: 'need capability model.infer',
  },
]

export const docSections: DocSection[] = [
  {
    id: 'why-axirune',
    kicker: '00 / ORIENTATION',
    title: { zh: '确定性优先，AI 可选', en: 'Deterministic first, AI optional' },
    summary: {
      zh: 'Axirune 0.3 是具备可选 Agent 扩展的确定性通用语言与解释器。名称取自 axiom 与 rune：让意图成为可检查的公理，让每个 effect 都有边界。',
      en: 'Axirune 0.3 is a deterministic general-purpose language and interpreter with optional agent extensions. Its name joins axiom and rune: make intent axiomatic and bound every effect.',
    },
    body: {
      zh: [
        'shape、task、递归、控制流、集合处理、JSON 与 Outcome 足以表达完整业务计算。它们由纯核心执行，不需要模型、工具、网络或 API key。',
        '文件、进程、网络、MCP 与 AI 仍是一等语言概念，但它们位于显式 effect 边界后面。选择 AI 是程序的能力决定，不是语言的运行前提。',
      ],
      en: [
        'Shapes, tasks, recursion, control flow, collection processing, JSON, and Outcome express complete business computation. The pure core executes them without a model, tool, network, or API key.',
        'Files, processes, network, MCP, and AI remain first-class language concepts, but live behind explicit effect boundaries. Choosing AI is a program capability decision, never a runtime prerequisite.',
      ],
    },
  },
  {
    id: 'syntax',
    kicker: '01 / SOURCE SHAPE',
    title: { zh: 'Frame、表达式与命名参数', en: 'Frames, expressions, and named arguments' },
    summary: {
      zh: '语义边界显式闭合；调用不会因参数顺序而改变含义。',
      en: 'Semantic boundaries close explicitly; call meaning never depends on parameter order.',
    },
    body: {
      zh: [
        '源文件以 space 和 edition 开始。task、shape、tool 等 frame 使用 /task、/shape、/tool 关闭；缩进只负责排版。',
        '表达式写成 [call target :name value]。文本使用 «…»；list 与 record 也使用前缀构造。',
      ],
      en: [
        'A source file begins with space and edition. Frames such as task, shape, and tool close with /task, /shape, and /tool; indentation is presentation only.',
        'Expressions use [call target :name value]. Text uses «…»; list and record are prefix constructors too.',
      ],
    },
    code: `task greet
  take name Text
  give Text
  yield [call Text.join
    :parts [list «Hello, » name «!»]
  ]
/task

let message = [call greet :name «Axirune»]`,
  },
  {
    id: 'values',
    kicker: '02 / VALUES & SHAPES',
    title: { zh: '标量、集合与业务数据', en: 'Scalars, collections, and domain data' },
    summary: {
      zh: '不可变值组成核心；shape 给 Record 结构稳定的业务名字。',
      en: 'Immutable values form the core; shapes give stable domain names to record structures.',
    },
    body: {
      zh: [
        '核心值包括 Nothing、Bool、Number、Text、List、Record 与 Outcome。Json.encode 把值编码成稳定文本，Json.decode 把 JSON 文本恢复为值。',
        'shape 声明字段契约；运行时 record 构造仍然是普通不可变值，可由 Record.get、put、keys、values 与 merge 处理。',
      ],
      en: [
        'Core values are Nothing, Bool, Number, Text, List, Record, and Outcome. Json.encode produces stable text; Json.decode restores JSON text to values.',
        'A shape declares a field contract. Runtime record constructors remain ordinary immutable values processed by Record.get, put, keys, values, and merge.',
      ],
    },
    code: `shape Line
  field sku Text
  field quantity Number
  field unit_price Number
/shape

let line = [record
  :sku «paper»
  :quantity 2
  :unit_price 12.5
]`,
  },
  {
    id: 'tasks',
    kicker: '03 / FUNCTIONS & RECURSION',
    title: { zh: '用户 Task 与递归', en: 'User tasks and recursion' },
    summary: {
      zh: 'task 是真正可调用的用户函数；递归使用同一套命名调用语义。',
      en: 'A task is a real user-defined callable; recursion uses the same named-call semantics.',
    },
    body: {
      zh: [
        'take 定义命名输入，give 定义结果，yield 返回值。在 let、yield、builtin 参数或其他表达式位置都可以 [call task-name :arg value]。',
        '递归不是特殊语法。解释器为所有调用统一执行 frame-depth、step、time 与 output 限制，因此失控递归会以预算耗尽结束。',
      ],
      en: [
        'take defines named inputs, give defines the result, and yield returns it. [call task-name :arg value] works in let, yield, builtin arguments, and other expression positions.',
        'Recursion has no special syntax. The interpreter applies frame-depth, step, time, and output limits to every call, so runaway recursion ends as budget exhaustion.',
      ],
    },
    code: `task factorial
  take n Number
  give Number
  yield [call Core.if
    :when [call Number.lessOrEqual :left n :right 1]
    :then 1
    :else [call Number.multiply
      :left n
      :right [call factorial
        :n [call Number.subtract :left n :right 1]
      ]
    ]
  ]
/task`,
  },
  {
    id: 'builtins',
    kicker: '04 / PURE STANDARD LIBRARY',
    title: { zh: '纯 Builtin', en: 'Pure builtins' },
    summary: {
      zh: '计算、文本、数据和错误操作由解释器提供，但没有任何环境权限。',
      en: 'The interpreter provides computation, text, data, and error operations with no ambient authority.',
    },
    body: {
      zh: [
        'Number 提供算术、取整与比较；Bool 提供惰性 and/or；Text 提供 join、split、slice 与常用变换；Record 和 Json 处理结构化数据。',
        'Builtin 的名称、命名参数、返回类型与惰性规则来自同一个 registry，编译器、CLI、LSP 与浏览器运行时共享它。',
      ],
      en: [
        'Number provides arithmetic, rounding, and comparisons; Bool provides lazy and/or; Text provides join, split, slice, and common transforms; Record and Json handle structured data.',
        'Builtin names, named parameters, return types, and laziness come from one registry shared by compiler, CLI, LSP, and browser runtime.',
      ],
    },
    code: `let gross [call Number.multiply :left quantity :right unit_price]
let words = [call Text.split :text source :separator « »]
let json = [call Json.encode :value invoice]`,
  },
  {
    id: 'collections',
    kicker: '05 / DATA PIPELINES',
    title: { zh: 'List.map、filter 与 fold', en: 'List.map, filter, and fold' },
    summary: {
      zh: '集合操作调用有名字的 task；没有不可见闭包或宿主函数指针。',
      en: 'Collection operations call named tasks; there are no invisible closures or host function pointers.',
    },
    body: {
      zh: [
        'map/filter 回调接收 item 与 index；fold 回调接收 accumulator、item 与 index。:using «task-name» 让回调边进入可序列化调用图。',
        '迭代顺序与结果是确定的，并受 collection-size、step、time 与 frame-depth 上限约束。',
      ],
      en: [
        'Map/filter callbacks receive item and index; fold callbacks receive accumulator, item, and index. :using «task-name» keeps callback edges in the serializable call graph.',
        'Iteration order and results are deterministic and bounded by collection-size, step, time, and frame-depth limits.',
      ],
    },
    code: `let subtotal [call List.fold
  :list lines
  :using «add_line»
  :initial 0
]`,
  },
  {
    id: 'control',
    kicker: '06 / CONTROL FLOW',
    title: { zh: '惰性 Core.if', en: 'Lazy Core.if' },
    summary: {
      zh: '只求值被选择的分支，这是递归与安全 fallback 的语义保证。',
      en: 'Only the selected branch is evaluated—a semantic guarantee for recursion and safe fallback.',
    },
    body: {
      zh: [
        'Core.if 先求值 :when，然后只运行 :then 或 :else。未选择分支不会调用 task、消耗递归深度或触发 effect。',
        'Bool.and、Bool.or 与 Core.coalesce 同样对不需要的参数保持惰性。',
      ],
      en: [
        'Core.if evaluates :when first, then runs only :then or :else. The unselected branch cannot call a task, consume recursion depth, or trigger an effect.',
        'Bool.and, Bool.or, and Core.coalesce are likewise lazy for arguments they do not need.',
      ],
    },
    code: `yield [call Core.if
  :when is_zero
  :then [call Outcome.fail :fault reason]
  :else [call Outcome.ok
    :value [call Number.divide :left numerator :right denominator]
  ]
]`,
  },
  {
    id: 'outcome',
    kicker: '07 / ERRORS',
    title: { zh: 'Outcome 是显式错误通道', en: 'Outcome is the explicit error channel' },
    summary: {
      zh: '可预期失败与普通数据一起返回、编码、检查和组合。',
      en: 'Expected failure is returned, encoded, inspected, and composed with ordinary data.',
    },
    body: {
      zh: [
        'Outcome.ok 包装成功值，Outcome.fail 包装 fault。Outcome.isOk 检查分支；value 与 fault 只允许解包匹配的状态。',
        'Builtin 参数错误、越界、无效 JSON 或预算耗尽属于运行时 fault；业务可预期错误应由任务主动返回 Outcome。',
      ],
      en: [
        'Outcome.ok wraps success and Outcome.fail wraps a fault. Outcome.isOk checks the branch; value and fault unwrap only the matching state.',
        'Invalid builtin arguments, bounds errors, invalid JSON, and exhausted budgets are runtime faults. Expected domain failure should be returned deliberately as Outcome.',
      ],
    },
    code: `let result [call Outcome.fail
  :fault [record
    :code «DIVIDE_BY_ZERO»
    :message «The denominator must not be zero.»
  ]
]`,
  },
  {
    id: 'effects',
    kicker: '08 / I/O & AUTHORITY',
    title: { zh: 'I/O 是显式 Effect', en: 'I/O is an explicit effect' },
    summary: {
      zh: '普通 task 不会突然读文件；外部操作必须同时通过 capability、permission 与 sandbox。',
      en: 'An ordinary task cannot suddenly read a file. External operations pass capability, permission, and sandbox.',
    },
    body: {
      zh: [
        'tool 声明命名输入、结果与所需 capability。调用者 use 工具并在 sandbox 内执行；部署根 grant 不可伪造的运行时权柄。',
        'axirune manifest 在运行前导出最小权限。只使用 pure builtins 的程序得到空清单。',
      ],
      en: [
        'A tool declares named input, result, and required capability. The caller uses the tool inside a sandbox; the deployment root grants an unforgeable runtime handle.',
        'axirune manifest exports minimum authority before execution. Programs using only pure builtins receive an empty manifest.',
      ],
    },
    code: `capability host.fs.read
  effect filesystem.read
  resource «./input.txt»
/capability

tool File.readText
  take path Text
  give Text
  need capability host.fs.read
  permission ask
/tool`,
  },
  {
    id: 'optional-ai',
    kicker: '09 / OPTIONAL AI & MCP',
    title: { zh: 'Prompt、Agent 与 MCP 是可选扩展', en: 'Prompt, Agent, and MCP are optional extensions' },
    summary: {
      zh: '需要推理时显式加入，不需要时完全不进入程序或运行时。',
      en: 'Add inference explicitly when useful; otherwise it never enters the program or runtime.',
    },
    body: {
      zh: [
        'prompt 区分 instruction 与 attached data；context 管理一次推理可见内容；memory 管理跨步骤状态；agent 组合模型配置与预算。',
        'MCP 固定协议并导入带 schema 的工具。模型和 MCP 都必须通过 capability/sandbox，无法绕过普通 effect 规则。',
      ],
      en: [
        'Prompt separates instruction from attached data; context bounds what one inference sees; memory carries state across steps; agent combines model configuration and budgets.',
        'MCP pins a protocol and imports schema-bearing tools. Models and MCP both pass capability/sandbox checks and cannot bypass ordinary effect rules.',
      ],
    },
    code: `capability model.infer
  effect model.infer
  resource «balanced»
/capability

agent classifier
  model balanced
  use prompt triage
  need capability model.infer
  budget turns 1
/agent`,
  },
  {
    id: 'toolchain',
    kicker: '10 / EXECUTION',
    title: { zh: '同一个编译器与解释器', en: 'One compiler and interpreter' },
    summary: {
      zh: 'CLI、Playground、在线 IDE 与测试共享语言核心。',
      en: 'CLI, Playground, online IDE, and tests share the language core.',
    },
    body: {
      zh: [
        'parseSource、formatSource、compileSource 与 runSource 是公开 API。编译器生成 checked IR；解释器执行 IR 并返回 output、emissions、value、diagnostics 与 trace。',
        'CLI 提供 check、run、fmt、ast、ir、manifest、build 与 bench。工具链不把 Axirune 源码转换成宿主脚本再 eval。',
      ],
      en: [
        'parseSource, formatSource, compileSource, and runSource are public APIs. The compiler emits checked IR; the interpreter returns output, emissions, value, diagnostics, and trace.',
        'The CLI provides check, run, fmt, ast, ir, manifest, build, and bench. The toolchain does not translate Axirune source into a host script and eval it.',
      ],
    },
    code: `axirune check examples/invoice-total.axi
axirune run examples/factorial.axi
axirune ir examples/outcome-division.axi
axirune manifest examples/word-frequency.axi
axirune run examples/word-frequency.axi --allow-read .`,
  },
]

export const quickStart = `npm install -g https://axirune.velhu.com/downloads/axirune-language-0.3.0.tgz
axirune check examples/invoice-total.axi
axirune run examples/invoice-total.axi`

export const cliCommands = [
  ['axirune check', '静态检查 / static checks'],
  ['axirune run', '确定性解释运行 / deterministic run'],
  ['axirune build', '编译 IR / compile IR'],
  ['axirune fmt', '结构化格式化 / format'],
  ['axirune ast', '查看语法树 / inspect AST'],
  ['axirune ir', '查看执行计划 / inspect IR'],
  ['axirune manifest', '导出 effect 权限 / effect manifest'],
  ['axirune bench', '运行实测基准 / measured benchmark'],
] as const
