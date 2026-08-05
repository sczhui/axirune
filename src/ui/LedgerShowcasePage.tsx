import {
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  Database,
  Download,
  Gauge,
  LoaderCircle,
  Plus,
  Play,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  SquareTerminal,
  Trash2,
  TriangleAlert,
  WifiOff,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import ledgerSource from '../../apps/axiledger/main.axi?raw'
import {
  DEFAULT_LEDGER_BUDGET_CENTS,
  categoryLabel,
  createSampleTransactions,
  ledgerCategories,
  type LedgerKind,
  type LedgerTransaction,
} from '../content/ledgerData'
import type { Locale } from '../content/site'
import {
  runProgramWithInput,
  serializeInspector,
  type DiagnosticView,
  type RunView,
} from './languageBridge'
import './ledger-showcase.css'

type LedgerReport = {
  schema: string
  currency: string
  transactionCount: number
  validCount: number
  invalidCount: number
  incomeCents: number
  expenseCents: number
  netCents: number
  budgetCents: number
  remainingCents: number
  overBudget: boolean
  categories: Record<string, number>
}

type RunState = 'ready' | 'running' | 'executed' | 'failed'
type InspectorTab = 'trace' | 'report' | 'source' | 'output'

type StoredLedger = {
  budgetCents: number
  transactions: LedgerTransaction[]
}

const STORAGE_KEY = 'axirune-ledger-showcase/v1'

const text = {
  zh: {
    eyebrow: '真实应用演示 / AXILEDGER',
    titleA: '账本在网页里。',
    titleB: '计算在 Axirune 里。',
    lead:
      '添加真实交易，设置月度预算，然后让浏览器中的 Axirune 解释器生成确定性财务报告。业务计算来自 main.axi，不调用模型、网络或远程服务。',
    pureRuntime: 'PURE BROWSER RUNTIME',
    noModel: 'NO MODEL',
    noNetwork: 'NO NETWORK',
    sourceLocal: 'SOURCE STAYS LOCAL',
    ready: 'AXIRUNE READY',
    running: 'AXIRUNE RUNNING',
    executed: 'AXIRUNE EXECUTED',
    failed: 'EXECUTION FAILED',
    changed: 'DATA CHANGED · RUN AGAIN',
    run: '运行 Axirune',
    rerun: '重新运行',
    runHint: '编译 main.axi，并使用当前账本作为显式输入。',
    sourceLines: '行 Axirune 源码',
    permissions: '外部权限',
    remoteCalls: '远程调用',
    workspace: '账本工作台',
    workspaceLead: '修改输入后重新运行，报表、图表和审计轨迹会一起更新。',
    monthlyBudget: '月度支出预算',
    reset: '恢复示例',
    download: '下载报告',
    addTransaction: '新增交易',
    date: '日期',
    description: '描述',
    descriptionPlaceholder: '例如：客户午餐',
    type: '类型',
    income: '收入',
    expense: '支出',
    category: '分类',
    amount: '金额（USD）',
    note: '备注',
    notePlaceholder: '可选',
    add: '加入账本',
    incomeTotal: '总收入',
    expenseTotal: '总支出',
    net: '净余额',
    remaining: '预算剩余',
    overBudget: '超出预算',
    verified: '有效记录',
    categorySpend: '分类支出',
    categoryLead: '条形图直接使用 Axirune 返回的 categories 记录。',
    noExpenses: '当前没有分类支出。',
    transactions: '交易明细',
    localData: 'LOCAL DATA',
    delete: '删除',
    empty: '账本为空。添加一笔交易开始。',
    trace: '审计轨迹',
    report: '报告 JSON',
    source: 'main.axi',
    output: '程序输出',
    traceLead: '解释器语义事件，而不是网页伪造的日志。',
    awaiting: '等待首次执行。',
    noTrace: '本次执行没有返回 trace 事件。',
    diagnostics: '编译 / 运行诊断',
    valid: '有效',
    invalid: '无效',
    records: '条记录',
    reportSchema: 'REPORT SCHEMA',
    duration: '浏览器执行耗时',
    auditNote: '下载文件包含输入、Axirune 报告、诊断和完整 trace，可离线审计。',
    formError: '请输入描述和大于 0 的金额。',
  },
  en: {
    eyebrow: 'REAL APPLICATION SHOWCASE / AXILEDGER',
    titleA: 'Ledger in the browser.',
    titleB: 'Logic in Axirune.',
    lead:
      'Add real transactions, set a monthly budget, then let the in-browser Axirune interpreter produce a deterministic financial report. The business logic lives in main.axi—no model, network, or remote service involved.',
    pureRuntime: 'PURE BROWSER RUNTIME',
    noModel: 'NO MODEL',
    noNetwork: 'NO NETWORK',
    sourceLocal: 'SOURCE STAYS LOCAL',
    ready: 'AXIRUNE READY',
    running: 'AXIRUNE RUNNING',
    executed: 'AXIRUNE EXECUTED',
    failed: 'EXECUTION FAILED',
    changed: 'DATA CHANGED · RUN AGAIN',
    run: 'Run Axirune',
    rerun: 'Run again',
    runHint: 'Compile main.axi with the current ledger as explicit input.',
    sourceLines: 'lines of Axirune',
    permissions: 'external permissions',
    remoteCalls: 'remote calls',
    workspace: 'Ledger workspace',
    workspaceLead: 'Change the input and run again; the report, chart, and audit trace update together.',
    monthlyBudget: 'Monthly expense budget',
    reset: 'Reset sample',
    download: 'Download report',
    addTransaction: 'Add transaction',
    date: 'Date',
    description: 'Description',
    descriptionPlaceholder: 'e.g. Client lunch',
    type: 'Type',
    income: 'Income',
    expense: 'Expense',
    category: 'Category',
    amount: 'Amount (USD)',
    note: 'Note',
    notePlaceholder: 'Optional',
    add: 'Add to ledger',
    incomeTotal: 'Total income',
    expenseTotal: 'Total expense',
    net: 'Net balance',
    remaining: 'Budget remaining',
    overBudget: 'Over budget',
    verified: 'Valid records',
    categorySpend: 'Expense by category',
    categoryLead: 'Bars are rendered directly from the categories record returned by Axirune.',
    noExpenses: 'There is no categorized expense yet.',
    transactions: 'Transactions',
    localData: 'LOCAL DATA',
    delete: 'Delete',
    empty: 'The ledger is empty. Add a transaction to begin.',
    trace: 'Audit trace',
    report: 'Report JSON',
    source: 'main.axi',
    output: 'Program output',
    traceLead: 'Interpreter semantic events, not logs fabricated by the UI.',
    awaiting: 'Awaiting the first execution.',
    noTrace: 'This execution returned no trace events.',
    diagnostics: 'Compile / runtime diagnostics',
    valid: 'valid',
    invalid: 'invalid',
    records: 'records',
    reportSchema: 'REPORT SCHEMA',
    duration: 'Browser execution time',
    auditNote: 'The download includes input, Axirune report, diagnostics, and the complete trace for offline audit.',
    formError: 'Enter a description and an amount greater than 0.',
  },
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeReport(value: unknown): LedgerReport | null {
  let candidate = value
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate) as unknown
    } catch {
      return null
    }
  }
  if (!isRecord(candidate)) return null

  const rawCategories = isRecord(candidate.categories) ? candidate.categories : {}
  const categories = Object.fromEntries(
    Object.entries(rawCategories)
      .map(([key, amount]) => [key, finiteNumber(amount)] as const)
      .filter(([, amount]) => amount >= 0),
  )

  return {
    schema: String(candidate.schema ?? 'axirune-ledger-report/1'),
    currency: String(candidate.currency ?? 'USD'),
    transactionCount: finiteNumber(candidate.transaction_count),
    validCount: finiteNumber(candidate.valid_count),
    invalidCount: finiteNumber(candidate.invalid_count),
    incomeCents: finiteNumber(candidate.income_cents),
    expenseCents: finiteNumber(candidate.expense_cents),
    netCents: finiteNumber(candidate.net_cents),
    budgetCents: finiteNumber(candidate.budget_cents),
    remainingCents: finiteNumber(candidate.remaining_cents),
    overBudget: candidate.over_budget === true,
    categories,
  }
}

function reportFromRun(run: RunView): LedgerReport | null {
  const direct = normalizeReport(run.value)
  if (direct) return direct
  for (const line of [...run.output].reverse()) {
    const parsed = normalizeReport(line)
    if (parsed) return parsed
  }
  return null
}

function isStoredTransaction(value: unknown): value is LedgerTransaction {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.description === 'string' &&
    (value.kind === 'income' || value.kind === 'expense') &&
    typeof value.category === 'string' &&
    typeof value.amountCents === 'number' &&
    Number.isFinite(value.amountCents) &&
    value.amountCents > 0 &&
    typeof value.note === 'string'
  )
}

function loadStoredLedger(): StoredLedger {
  if (typeof window === 'undefined') {
    return {
      budgetCents: DEFAULT_LEDGER_BUDGET_CENTS,
      transactions: createSampleTransactions(),
    }
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '') as unknown
    if (!isRecord(parsed) || !Array.isArray(parsed.transactions)) throw new Error('Invalid ledger')
    const transactions = parsed.transactions.filter(isStoredTransaction)
    const budgetCents = finiteNumber(parsed.budgetCents, DEFAULT_LEDGER_BUDGET_CENTS)
    return {
      budgetCents: budgetCents >= 0 ? Math.round(budgetCents) : DEFAULT_LEDGER_BUDGET_CENTS,
      transactions,
    }
  } catch {
    return {
      budgetCents: DEFAULT_LEDGER_BUDGET_CENTS,
      transactions: createSampleTransactions(),
    }
  }
}

function today(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function makeTransactionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `txn-${crypto.randomUUID()}`
  }
  return `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function LedgerShowcasePage({ locale }: { locale: Locale }) {
  const copy = text[locale]
  const initialLedger = useMemo(loadStoredLedger, [])
  const [transactions, setTransactions] = useState(initialLedger.transactions)
  const [budgetCents, setBudgetCents] = useState(initialLedger.budgetCents)
  const [runState, setRunState] = useState<RunState>('ready')
  const [lastRun, setLastRun] = useState<RunView | null>(null)
  const [report, setReport] = useState<LedgerReport | null>(null)
  const [lastRunSignature, setLastRunSignature] = useState('')
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<InspectorTab>('trace')
  const [formError, setFormError] = useState('')
  const [draft, setDraft] = useState({
    date: today(),
    description: '',
    kind: 'expense' as LedgerKind,
    category: 'Food',
    amount: '',
    note: '',
  })
  const autoRunStarted = useRef(false)

  const inputSignature = useMemo(
    () => JSON.stringify({ budgetCents, transactions }),
    [budgetCents, transactions],
  )
  const dirty = Boolean(lastRunSignature) && inputSignature !== lastRunSignature

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
        style: 'currency',
        currency: report?.currency ?? 'USD',
        minimumFractionDigits: 2,
      }),
    [locale, report?.currency],
  )

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ budgetCents, transactions } satisfies StoredLedger),
    )
  }, [budgetCents, transactions])

  const executeLedger = useCallback(async () => {
    const signature = JSON.stringify({ budgetCents, transactions })
    setRunState('running')
    setActiveTab('trace')
    const started = performance.now()
    const result = await runProgramWithInput(ledgerSource, {
      currency: 'USD',
      budget_cents: budgetCents,
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        kind: transaction.kind,
        category: transaction.category,
        amount_cents: transaction.amountCents,
        note: transaction.note,
      })),
    })
    const duration = performance.now() - started
    const nextReport = reportFromRun(result)
    const hasErrors = result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')

    setElapsedMs(duration)
    setLastRun(result)
    setReport(nextReport)
    setLastRunSignature(signature)
    setRunState(!hasErrors && nextReport ? 'executed' : 'failed')
    if (hasErrors || !nextReport) setActiveTab('output')
  }, [budgetCents, transactions])

  useEffect(() => {
    if (autoRunStarted.current) return
    autoRunStarted.current = true
    void executeLedger()
  }, [executeLedger])

  const resetLedger = () => {
    setTransactions(createSampleTransactions())
    setBudgetCents(DEFAULT_LEDGER_BUDGET_CENTS)
    setFormError('')
  }

  const addTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(draft.amount)
    if (!draft.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFormError(copy.formError)
      return
    }

    setTransactions((current) => [
      ...current,
      {
        id: makeTransactionId(),
        date: draft.date || today(),
        description: draft.description.trim(),
        kind: draft.kind,
        category: draft.kind === 'income' ? 'Income' : draft.category,
        amountCents: Math.round(amount * 100),
        note: draft.note.trim(),
      },
    ])
    setDraft((current) => ({
      ...current,
      description: '',
      amount: '',
      note: '',
    }))
    setFormError('')
  }

  const deleteTransaction = (id: string) => {
    setTransactions((current) => current.filter((transaction) => transaction.id !== id))
  }

  const downloadReport = () => {
    if (!report || !lastRun) return
    const artifact = {
      generated_by: 'Axirune 0.5.0-alpha.1 / AxiLedger',
      generated_at: new Date().toISOString(),
      execution: {
        runtime: 'browser',
        model: false,
        network: false,
        capabilities: [],
        elapsed_ms: elapsedMs,
      },
      input: {
        currency: 'USD',
        budget_cents: budgetCents,
        transactions: transactions.map((transaction) => ({
          id: transaction.id,
          date: transaction.date,
          description: transaction.description,
          kind: transaction.kind,
          category: transaction.category,
          amount_cents: transaction.amountCents,
          note: transaction.note,
        })),
      },
      report: lastRun.value,
      diagnostics: lastRun.diagnostics,
      trace: lastRun.trace,
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json;charset=utf-8' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `axiledger-report-${today()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const categories = useMemo(
    () =>
      Object.entries(report?.categories ?? {})
        .filter(([, amount]) => amount > 0)
        .sort((left, right) => right[1] - left[1]),
    [report],
  )
  const maxCategory = Math.max(...categories.map(([, amount]) => amount), 1)
  const runLabel =
    runState === 'running'
      ? copy.running
      : runState === 'failed'
        ? copy.failed
        : dirty
          ? copy.changed
          : runState === 'executed'
            ? copy.executed
            : copy.ready
  const outputText = lastRun
    ? lastRun.output.length > 0
      ? lastRun.output.join('\n')
      : serializeInspector(lastRun.value)
    : copy.awaiting
  const sourceLineCount = ledgerSource.trim().split('\n').length

  return (
    <div className="ledger-page">
      <section className="ledger-hero">
        <div className="ledger-hero__copy">
          <span className="ledger-eyebrow">
            <ReceiptText size={14} /> {copy.eyebrow}
          </span>
          <h1>
            <span>{copy.titleA}</span>
            <strong>{copy.titleB}</strong>
          </h1>
          <p>{copy.lead}</p>
          <div className="ledger-trust-row" aria-label="Runtime guarantees">
            <span>
              <ShieldCheck size={14} /> {copy.noModel}
            </span>
            <span>
              <WifiOff size={14} /> {copy.noNetwork}
            </span>
            <span>
              <Database size={14} /> {copy.sourceLocal}
            </span>
          </div>
        </div>

        <aside className="ledger-runtime-card">
          <header>
            <span className="ledger-runtime-card__lights" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <code>apps/axiledger/main.axi</code>
          </header>
          <div className="ledger-runtime-card__body">
            <span className="ledger-runtime-card__mode">{copy.pureRuntime}</span>
            <div
              className={`ledger-execution-mark ledger-execution-mark--${runState}${dirty ? ' is-dirty' : ''}`}
              aria-live="polite"
            >
              {runState === 'running' ? (
                <LoaderCircle className="ledger-spin" size={24} />
              ) : runState === 'failed' ? (
                <TriangleAlert size={24} />
              ) : (
                <CheckCircle2 size={24} />
              )}
              <strong>{runLabel}</strong>
            </div>
            <div className="ledger-runtime-card__facts">
              <span>
                <strong>{sourceLineCount}</strong>
                {copy.sourceLines}
              </span>
              <span>
                <strong>0</strong>
                {copy.permissions}
              </span>
              <span>
                <strong>0</strong>
                {copy.remoteCalls}
              </span>
            </div>
            <button
              type="button"
              className="ledger-run-button"
              onClick={() => void executeLedger()}
              disabled={runState === 'running'}
            >
              {runState === 'running' ? <LoaderCircle className="ledger-spin" /> : <Play fill="currentColor" />}
              <span>{runState === 'executed' && !dirty ? copy.rerun : copy.run}</span>
            </button>
            <small>{copy.runHint}</small>
          </div>
        </aside>
      </section>

      <section className="ledger-studio">
        <header className="ledger-studio__header">
          <div>
            <span>AXILEDGER / WORKSPACE</span>
            <h2>{copy.workspace}</h2>
            <p>{copy.workspaceLead}</p>
          </div>
          <div className="ledger-studio__actions">
            <label className="ledger-budget-input">
              <span>{copy.monthlyBudget}</span>
              <div>
                <b>$</b>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={(budgetCents / 100).toFixed(2)}
                  onChange={(event) =>
                    setBudgetCents(Math.max(0, Math.round(Number(event.target.value || 0) * 100)))
                  }
                />
              </div>
            </label>
            <button type="button" className="ledger-action-button" onClick={resetLedger}>
              <RotateCcw size={15} /> {copy.reset}
            </button>
            <button
              type="button"
              className="ledger-action-button"
              onClick={downloadReport}
              disabled={!report}
            >
              <Download size={15} /> {copy.download}
            </button>
          </div>
        </header>

        {lastRun?.diagnostics.length ? (
          <div className="ledger-diagnostics" role="alert">
            <strong>
              <TriangleAlert size={15} /> {copy.diagnostics}
            </strong>
            <ul>
              {lastRun.diagnostics.map((diagnostic: DiagnosticView, index) => (
                <li key={`${diagnostic.code ?? 'diagnostic'}-${index}`}>
                  <code>{diagnostic.code ?? diagnostic.severity.toUpperCase()}</code>
                  {diagnostic.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="ledger-kpis">
          <article>
            <span>
              <CircleDollarSign size={17} /> {copy.incomeTotal}
            </span>
            <strong>{money.format((report?.incomeCents ?? 0) / 100)}</strong>
            <small>income_cents</small>
          </article>
          <article>
            <span>
              <ReceiptText size={17} /> {copy.expenseTotal}
            </span>
            <strong>{money.format((report?.expenseCents ?? 0) / 100)}</strong>
            <small>expense_cents</small>
          </article>
          <article className={(report?.netCents ?? 0) < 0 ? 'is-alert' : ''}>
            <span>
              <BarChart3 size={17} /> {copy.net}
            </span>
            <strong>{money.format((report?.netCents ?? 0) / 100)}</strong>
            <small>net_cents</small>
          </article>
          <article className={report?.overBudget ? 'is-alert' : 'is-signal'}>
            <span>
              <Gauge size={17} /> {report?.overBudget ? copy.overBudget : copy.remaining}
            </span>
            <strong>{money.format(Math.abs(report?.remainingCents ?? 0) / 100)}</strong>
            <small>{report?.overBudget ? 'over_budget = true' : 'remaining_cents'}</small>
          </article>
          <article>
            <span>
              <ShieldCheck size={17} /> {copy.verified}
            </span>
            <strong>
              {report?.validCount ?? 0}
              <em>/ {report?.transactionCount ?? transactions.length}</em>
            </strong>
            <small>
              {report?.invalidCount ?? 0} {copy.invalid}
            </small>
          </article>
        </div>

        <div className="ledger-main-grid">
          <div className="ledger-data-column">
            <form className="ledger-composer" onSubmit={addTransaction}>
              <header>
                <span>INPUT / NEW RECORD</span>
                <h3>{copy.addTransaction}</h3>
              </header>
              <div className="ledger-composer__fields">
                <label>
                  <span>{copy.date}</span>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, date: event.target.value }))
                    }
                  />
                </label>
                <label className="ledger-composer__description">
                  <span>{copy.description}</span>
                  <input
                    value={draft.description}
                    placeholder={copy.descriptionPlaceholder}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>{copy.type}</span>
                  <select
                    value={draft.kind}
                    onChange={(event) => {
                      const kind = event.target.value as LedgerKind
                      setDraft((current) => ({
                        ...current,
                        kind,
                        category: kind === 'income' ? 'Income' : current.category === 'Income' ? 'Food' : current.category,
                      }))
                    }}
                  >
                    <option value="expense">{copy.expense}</option>
                    <option value="income">{copy.income}</option>
                  </select>
                </label>
                <label>
                  <span>{copy.category}</span>
                  <select
                    value={draft.kind === 'income' ? 'Income' : draft.category}
                    disabled={draft.kind === 'income'}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, category: event.target.value }))
                    }
                  >
                    {ledgerCategories
                      .filter((category) => draft.kind === 'income' || category.value !== 'Income')
                      .map((category) => (
                        <option value={category.value} key={category.value}>
                          {category[locale]}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>{copy.amount}</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={draft.amount}
                    placeholder="0.00"
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, amount: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>{copy.note}</span>
                  <input
                    value={draft.note}
                    placeholder={copy.notePlaceholder}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, note: event.target.value }))
                    }
                  />
                </label>
                <button type="submit">
                  <Plus size={17} /> {copy.add}
                </button>
              </div>
              {formError ? <p className="ledger-composer__error">{formError}</p> : null}
            </form>

            <section className="ledger-transactions">
              <header>
                <div>
                  <span>DATASET / {transactions.length.toString().padStart(2, '0')}</span>
                  <h3>{copy.transactions}</h3>
                </div>
                <em>{copy.localData}</em>
              </header>
              <div className="ledger-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{copy.date}</th>
                      <th>{copy.description}</th>
                      <th>{copy.category}</th>
                      <th>{copy.type}</th>
                      <th>{copy.amount}</th>
                      <th>
                        <span className="sr-only">{copy.delete}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>
                          <time dateTime={transaction.date}>{transaction.date}</time>
                        </td>
                        <td>
                          <strong>{transaction.description}</strong>
                          {transaction.note ? <small>{transaction.note}</small> : null}
                        </td>
                        <td>
                          <span className="ledger-category-pill">
                            {categoryLabel(transaction.category, locale)}
                          </span>
                        </td>
                        <td>
                          <span className={`ledger-kind ledger-kind--${transaction.kind}`}>
                            {transaction.kind === 'income' ? copy.income : copy.expense}
                          </span>
                        </td>
                        <td className={`ledger-amount ledger-amount--${transaction.kind}`}>
                          {transaction.kind === 'income' ? '+' : '−'}
                          {money.format(transaction.amountCents / 100)}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => deleteTransaction(transaction.id)}
                            aria-label={`${copy.delete}: ${transaction.description}`}
                            title={copy.delete}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {transactions.length === 0 ? <p className="ledger-table-empty">{copy.empty}</p> : null}
              </div>
            </section>
          </div>

          <aside className="ledger-insights">
            <section className="ledger-category-chart">
              <header>
                <div>
                  <span>AXIRUNE RESULT / CATEGORIES</span>
                  <h3>{copy.categorySpend}</h3>
                </div>
                <BarChart3 size={20} />
              </header>
              <p>{copy.categoryLead}</p>
              <div className="ledger-bars">
                {categories.map(([category, amount], index) => (
                  <div className="ledger-bar" key={category}>
                    <div>
                      <span>
                        <i>{String(index + 1).padStart(2, '0')}</i>
                        {categoryLabel(category, locale)}
                      </span>
                      <strong>{money.format(amount / 100)}</strong>
                    </div>
                    <span className="ledger-bar__track">
                      <i style={{ width: `${Math.max(4, (amount / maxCategory) * 100)}%` }} />
                    </span>
                  </div>
                ))}
                {categories.length === 0 ? <span className="ledger-bars__empty">{copy.noExpenses}</span> : null}
              </div>
            </section>

            <section className="ledger-inspector">
              <div className="ledger-inspector__tabs" role="tablist">
                {(
                  [
                    ['trace', copy.trace, ShieldCheck],
                    ['report', copy.report, Database],
                    ['source', copy.source, Code2],
                    ['output', copy.output, SquareTerminal],
                  ] as const
                ).map(([tab, label, Icon]) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    className={activeTab === tab ? 'is-active' : ''}
                    onClick={() => setActiveTab(tab)}
                    key={tab}
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="ledger-inspector__body">
                {activeTab === 'trace' ? (
                  <>
                    <header className="ledger-trace-head">
                      <div>
                        <strong>{copy.trace}</strong>
                        <span>{copy.traceLead}</span>
                      </div>
                      <em>{lastRun?.trace.length ?? 0} EVENTS</em>
                    </header>
                    {lastRun?.trace.length ? (
                      <ol className="ledger-trace-list">
                        {lastRun.trace.slice(0, 120).map((entry, index) => (
                          <li key={`${entry.id}-${index}`}>
                            <span className={`ledger-trace-node ledger-trace-node--${entry.status}`}>
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <small>
                                {entry.kind} {entry.elapsed ? `· ${entry.elapsed}` : ''}
                              </small>
                              <strong>{entry.label}</strong>
                              {entry.detail ? <code>{entry.detail}</code> : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="ledger-inspector__empty">
                        {lastRun ? copy.noTrace : copy.awaiting}
                      </p>
                    )}
                  </>
                ) : null}

                {activeTab === 'report' ? (
                  <div className="ledger-code-panel">
                    <header>
                      <span>{copy.reportSchema}</span>
                      <code>{report?.schema ?? '—'}</code>
                    </header>
                    <pre>
                      <code>
                        {lastRun?.value ? serializeInspector(lastRun.value) : copy.awaiting}
                      </code>
                    </pre>
                  </div>
                ) : null}

                {activeTab === 'source' ? (
                  <div className="ledger-code-panel">
                    <header>
                      <span>AXIRUNE 0.5.0-ALPHA.1 / UTF-8</span>
                      <code>{sourceLineCount} LINES</code>
                    </header>
                    <pre>
                      <code>{ledgerSource.trim()}</code>
                    </pre>
                  </div>
                ) : null}

                {activeTab === 'output' ? (
                  <div className="ledger-code-panel">
                    <header>
                      <span>STDOUT / JSON</span>
                      <code>{lastRun?.status.toUpperCase() ?? 'READY'}</code>
                    </header>
                    <pre>
                      <code>{outputText}</code>
                    </pre>
                  </div>
                ) : null}
              </div>

              <footer className="ledger-inspector__footer">
                <span>
                  <i className={runState === 'executed' ? 'is-live' : ''} />
                  {runLabel}
                </span>
                <span>
                  {copy.duration}: {elapsedMs === null ? '—' : `${elapsedMs.toFixed(1)} ms`}
                </span>
              </footer>
            </section>

            <p className="ledger-audit-note">
              <ShieldCheck size={15} />
              {copy.auditNote}
            </p>
          </aside>
        </div>
      </section>
    </div>
  )
}
