import { Activity, BarChart3, Check, Clock3, Download, Gamepad2, Gauge, LoaderCircle, Play, ShieldCheck, TerminalSquare } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { samples, type Locale } from '../content/site'
import { compileProgram, formatProgram, parseProgram } from './languageBridge'

type BenchResult = {
  name: string
  detail: string
  median: number
  p95: number
  runs: number
}

type BenchmarkReport = {
  schema: string
  generatedAt: string
  languageVersion: string
  runtime: {
    node: string
    platform: string
    architecture: string
    cpu: string
    logicalCpus: number
  }
  configuration: {
    samples: number
    warmup: number
  }
  cases: Array<{
    name: string
    fixture: {
      name: string
      bytes: number
      lines: number
    }
    timing: {
      samples: number
      medianMs: number
      p95Ms: number
    }
  }>
}

type ClassicBenchmarkReport = {
  schema: 'axirune-benchmark/classics/1'
  generatedAt: string
  languageVersion: string
  configuration: { warmupSteps: number; measuredSteps: number; seed: number }
  coverage: {
    catalogGames: number
    measuredSharedGames: number
    separatelyReportedFlagships: number
    gameIds: string[]
  }
  sharedEngine: {
    games: Array<{
      gameId: string
      title: string
      engineFamily: string
      fixedStepHz: number
      measurement: { steps: number; elapsedMs: number; stepsPerSecond: number }
      determinism: { matched: boolean; finalDigest: string }
      entities: { peak: { total: number }; withinLimits: boolean }
    }>
    aggregate: {
      totalSteps: number
      elapsedMs: number
      stepsPerSecond: number
      deterministicGames: number
      gamesWithinEntityLimits: number
      maxObservedEntities: number
    }
  }
  flagships: Array<{
    gameId: string
    title: string
    engineFamily: string
    fixedStepHz: number
    deterministicContract: string
  }>
  passed: boolean
}

function titleCase(value: string) {
  return value
    .split(/[-_]/u)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

async function measure(
  name: string,
  detail: string,
  runs: number,
  operation: () => Promise<unknown>,
): Promise<BenchResult> {
  for (let warmup = 0; warmup < 3; warmup += 1) await operation()

  const timings: number[] = []
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now()
    await operation()
    timings.push(performance.now() - start)
  }
  timings.sort((left, right) => left - right)
  const median = timings[Math.floor(timings.length / 2)] ?? 0
  const p95 = timings[Math.min(timings.length - 1, Math.ceil(timings.length * 0.95) - 1)] ?? 0
  return { name, detail, median, p95, runs }
}

export function BenchmarksPage({ locale }: { locale: Locale }) {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<BenchResult[]>([])
  const [releaseResults, setReleaseResults] = useState<BenchResult[]>([])
  const [releaseReport, setReleaseReport] = useState<BenchmarkReport | null>(null)
  const [releaseError, setReleaseError] = useState('')
  const [classicReport, setClassicReport] = useState<ClassicBenchmarkReport | null>(null)
  const [classicError, setClassicError] = useState('')
  const [resultMode, setResultMode] = useState<'release' | 'local'>('release')
  const [runAt, setRunAt] = useState('')
  const smallSource = samples[0]?.code ?? ''
  const workflowSource = samples[1]?.code ?? smallSource
  const corpus = useMemo(() => samples.map((sample) => sample.code).join('\n\n'), [])
  const lineCount = corpus.split('\n').length

  useEffect(() => {
    const controller = new AbortController()
    const loadReleaseReport = async () => {
      try {
        const response = await fetch('/benchmark-results.json', { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const report = (await response.json()) as BenchmarkReport
        if (!Array.isArray(report.cases)) throw new Error('Missing benchmark cases')
        setReleaseReport(report)
        setReleaseResults(
          report.cases.map((benchmarkCase) => ({
            name: `${titleCase(benchmarkCase.name)} / ${titleCase(benchmarkCase.fixture.name)}`,
            detail: `${benchmarkCase.fixture.lines} lines · ${benchmarkCase.fixture.bytes} bytes`,
            median: benchmarkCase.timing.medianMs,
            p95: benchmarkCase.timing.p95Ms,
            runs: benchmarkCase.timing.samples,
          })),
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setReleaseError(error instanceof Error ? error.message : String(error))
      }
    }
    const loadClassicReport = async () => {
      try {
        const response = await fetch('/classics-benchmark-results.json', { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const report = (await response.json()) as ClassicBenchmarkReport
        if (report.schema !== 'axirune-benchmark/classics/1' || report.coverage.catalogGames !== 20) {
          throw new Error('Invalid Classic Worlds benchmark report')
        }
        setClassicReport(report)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setClassicError(error instanceof Error ? error.message : String(error))
      }
    }
    void Promise.all([loadReleaseReport(), loadClassicReport()])
    return () => controller.abort()
  }, [])

  const runBenchmarks = async () => {
    setRunning(true)
    setResultMode('local')
    setResults([])
    await new Promise<void>((resolve) => window.setTimeout(resolve, 30))
    const cases = [
      () => measure('Parse / small', `${smallSource.split('\n').length} lines`, 60, () => parseProgram(smallSource)),
      () => measure('Format / workflow', `${workflowSource.split('\n').length} lines`, 40, () => formatProgram(workflowSource)),
      () => measure('Compile / workflow', `${workflowSource.split('\n').length} lines`, 30, () => compileProgram(workflowSource)),
      () => measure('Parse / corpus', `${lineCount} lines · ${samples.length} files`, 24, () => parseProgram(corpus)),
    ]
    const next: BenchResult[] = []
    for (const benchmarkCase of cases) {
      next.push(await benchmarkCase())
      setResults([...next])
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    }
    setRunAt(new Date().toLocaleTimeString())
    setRunning(false)
  }

  const displayResults = resultMode === 'local' ? results : releaseResults
  const maxP95 = Math.max(...displayResults.map((result) => result.p95), 1)
  const releaseTimestamp = releaseReport
    ? new Date(releaseReport.generatedAt).toLocaleString()
    : ''

  return (
    <>
      <section className="page-hero page-hero--benchmarks">
        <div className="page-hero__index">
          <span>05</span>
          <span>/ BENCHMARKS</span>
        </div>
        <div className="page-hero__copy">
          <span className="eyebrow">
            <Activity size={13} /> REPRODUCIBLE · LOCAL · LABELED
          </span>
          <h1>{locale === 'zh' ? '不给你一张营销跑分表。给你可重复的测量。' : 'No marketing scorecard. Measurements you can reproduce.'}</h1>
          <p>
            {locale === 'zh'
              ? '浏览器基准使用当前页面加载的真实解析器与编译器。结果只描述这台设备、这个浏览器和这次运行。'
              : 'The browser benchmark uses the real parser and compiler loaded by this page. Results describe this device, browser, and run—nothing broader.'}
          </p>
        </div>
        <div className="benchmark-run-card">
          <div>
            <Gauge size={22} />
            <span>LOCAL MICROBENCH</span>
          </div>
          <strong>{displayResults.length ? `${displayResults.length} CASES` : 'LOADING'}</strong>
          <p>
            {resultMode === 'local' && runAt
              ? `${locale === 'zh' ? '本机运行' : 'LOCAL RUN'} ${runAt}`
              : releaseTimestamp
                ? `${locale === 'zh' ? '发布数据' : 'RELEASE DATA'} ${releaseTimestamp}`
                : releaseError
                  ? `${locale === 'zh' ? '发布数据不可用' : 'RELEASE DATA UNAVAILABLE'}`
                  : locale === 'zh'
                    ? '正在读取发布 JSON'
                    : 'LOADING RELEASE JSON'}
          </p>
          <button type="button" onClick={runBenchmarks} disabled={running}>
            {running ? <LoaderCircle className="spin" size={15} /> : <Play size={15} fill="currentColor" />}
            {running
              ? locale === 'zh'
                ? '测量中'
                : 'Measuring'
              : locale === 'zh'
                ? '在此设备运行'
                : 'Run on this device'}
          </button>
        </div>
      </section>

      <section className="benchmark-lab">
        <div className="benchmark-lab__head">
          <div>
            <span className="eyebrow">
              {resultMode === 'release'
                ? `RELEASE JSON / AXIRUNE ${releaseReport?.languageVersion ?? '0.5.0-alpha.1'}`
                : 'BROWSER LAB / REAL COMPILER CORE'}
            </span>
            <h2>{locale === 'zh' ? '编译器微基准' : 'Compiler microbenchmarks'}</h2>
          </div>
          <div className="benchmark-lab__legend">
            <span>
              <i className="legend-median" /> MEDIAN
            </span>
            <span>
              <i className="legend-p95" /> P95
            </span>
          </div>
        </div>

        <div className="benchmark-table" role="table" aria-label="Benchmark results">
          <div className="benchmark-table__row benchmark-table__header" role="row">
            <span role="columnheader">CASE</span>
            <span role="columnheader">INPUT</span>
            <span role="columnheader">MEDIAN</span>
            <span role="columnheader">P95</span>
            <span role="columnheader">RELATIVE SCALE</span>
          </div>
          {displayResults.map((result, index) => {
            const medianWidth = Math.max(2, (result.median / maxP95) * 100)
            const p95Width = Math.max(3, (result.p95 / maxP95) * 100)
            return (
              <div className="benchmark-table__row" role="row" key={`${result.name}-${index}`}>
                <span role="cell">
                  <small>{String(index + 1).padStart(2, '0')}</small>
                  <strong>{result.name}</strong>
                </span>
                <span role="cell">
                  {result.detail}
                  <small>{result.runs} RUNS</small>
                </span>
                <span role="cell" className="benchmark-number">
                  {`${result.median.toFixed(3)} ms`}
                </span>
                <span role="cell" className="benchmark-number">
                  {`${result.p95.toFixed(3)} ms`}
                </span>
                <span role="cell">
                  <span className="benchmark-bar">
                    <i className="benchmark-bar__p95" style={{ width: `${p95Width}%` }} />
                    <i className="benchmark-bar__median" style={{ width: `${medianWidth}%` }} />
                  </span>
                </span>
              </div>
            )
          })}
          {!displayResults.length ? (
            <div className="benchmark-table__row" role="row">
              <span role="cell">
                <small>—</small>
                <strong>{releaseError ? 'Release JSON unavailable' : 'Loading measured results…'}</strong>
              </span>
              <span role="cell">{releaseError || '/benchmark-results.json'}</span>
              <span role="cell" className="benchmark-number">—</span>
              <span role="cell" className="benchmark-number">—</span>
              <span role="cell" />
            </div>
          ) : null}
        </div>

        <div className="benchmark-method">
          <article>
            <Clock3 size={18} />
            <h3>{locale === 'zh' ? '方法' : 'Method'}</h3>
            <p>{locale === 'zh' ? '每项先预热 3 次，再串行采样。计时使用 performance.now()；不扣除调度与 GC。' : 'Each case warms up 3 times, then samples serially with performance.now(). Scheduling and GC are not subtracted.'}</p>
          </article>
          <article>
            <BarChart3 size={18} />
            <h3>{locale === 'zh' ? '读数' : 'Reading'}</h3>
            <p>{locale === 'zh' ? 'Median 表示典型延迟，P95 显示慢尾。页面初始读数直接来自发布的 benchmark-results.json。' : 'Median represents typical latency; P95 exposes the slow tail. Initial readings come directly from the published benchmark-results.json.'}</p>
          </article>
          <article>
            <Check size={18} />
            <h3>{locale === 'zh' ? '边界' : 'Scope'}</h3>
            <p>{locale === 'zh' ? '这里不比较其他语言：不同运行时、I/O 和测试模型会让横向数字失真。' : 'No cross-language ranking appears here: runtimes, I/O, and benchmark models would make those numbers misleading.'}</p>
          </article>
        </div>
      </section>

      <section className="classic-benchmark-lab">
        <div className="classic-benchmark-lab__head">
          <div>
            <span className="eyebrow"><Gamepad2 size={13} /> ARCADE / FIXED INPUT REPLAY</span>
            <h2>{locale === 'zh' ? '20 款作品的确定性证据' : 'Determinism evidence for 20 worlds'}</h2>
          </div>
          <p>{locale === 'zh' ? '18 款共享引擎作品执行固定 Seed 与输入脚本；两款旗舰保留各自的专属确定性测试，不把不同实现混成一项跑分。' : 'Eighteen shared-engine worlds execute a fixed seed and input script. Two flagships retain dedicated determinism suites instead of being mixed into an unlike score.'}</p>
        </div>

        {classicReport ? (
          <>
            <div className="classic-benchmark-facts">
              <div><small>CATALOG</small><strong>{classicReport.coverage.catalogGames}</strong><span>{locale === 'zh' ? '款已覆盖作品' : 'WORLDS COVERED'}</span></div>
              <div><small>REPLAY</small><strong>{classicReport.sharedEngine.aggregate.totalSteps.toLocaleString()}</strong><span>{locale === 'zh' ? '固定输入步' : 'FIXED INPUT STEPS'}</span></div>
              <div><small>THROUGHPUT</small><strong>{classicReport.sharedEngine.aggregate.stepsPerSecond.toLocaleString()}</strong><span>STEPS / SECOND</span></div>
              <div><small>RESULT</small><strong>{classicReport.passed ? '18 / 18' : 'REVIEW'}</strong><span>{locale === 'zh' ? '确定且有界' : 'DETERMINISTIC + BOUNDED'}</span></div>
            </div>

            <div className="classic-benchmark-table" role="table" aria-label="Classic Worlds benchmark results">
              <div className="classic-benchmark-table__row is-header" role="row">
                <span role="columnheader">WORLD</span><span role="columnheader">ENGINE</span><span role="columnheader">STEPS / S</span><span role="columnheader">PEAK</span><span role="columnheader">REPLAY</span>
              </div>
              {classicReport.sharedEngine.games.map((game, index) => (
                <div className="classic-benchmark-table__row" role="row" key={game.gameId}>
                  <span role="cell"><small>{String(index + 1).padStart(2, '0')}</small><strong>{game.title}</strong></span>
                  <span role="cell">{game.engineFamily}<small>{game.fixedStepHz} HZ · {game.measurement.steps.toLocaleString()} STEPS</small></span>
                  <span role="cell" className="benchmark-number">{game.measurement.stepsPerSecond.toLocaleString()}</span>
                  <span role="cell" className="benchmark-number">{game.entities.peak.total}</span>
                  <span role="cell" className={game.determinism.matched && game.entities.withinLimits ? 'is-pass' : 'is-fail'}>
                    {game.determinism.matched && game.entities.withinLimits ? <Check size={13} /> : '!'}
                    {game.determinism.matched && game.entities.withinLimits ? 'MATCH' : 'REVIEW'}
                  </span>
                </div>
              ))}
            </div>

            <div className="classic-benchmark-flagships">
              {classicReport.flagships.map((game) => (
                <article key={game.gameId}>
                  <ShieldCheck size={18} />
                  <span>DEDICATED ENGINE / {game.fixedStepHz} HZ</span>
                  <h3>{game.title}</h3>
                  <p>{locale === 'zh' ? '使用独立状态机与专属确定性合同测试。' : 'Independent state machine with a dedicated determinism contract.'}</p>
                  <code>{game.deterministicContract}</code>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="classic-benchmark-loading">
            {classicError ? classicError : <><LoaderCircle className="spin" size={18} /> {locale === 'zh' ? '读取 Arcade 发布基准' : 'Loading Arcade release benchmark'}</>}
          </div>
        )}
      </section>

      <section className="cli-benchmark section-shell">
        <div>
          <span className="eyebrow">REPRODUCE IN YOUR ENVIRONMENT</span>
          <h2>{locale === 'zh' ? '用 CLI 运行完整 harness。' : 'Run the complete harness with the CLI.'}</h2>
          <p>{locale === 'zh' ? '命令行版本会输出 Node 版本、平台、语料 hash、迭代次数与原始 JSON。' : 'The CLI version reports Node, platform, corpus hash, iterations, and raw JSON.'}</p>
        </div>
        <div className="cli-benchmark__actions">
          <code>
            <TerminalSquare size={17} />
            axirune bench
          </code>
          <a href="/benchmark-results.json" download>
            <Download size={15} />
            {locale === 'zh' ? '下载发布基准 JSON' : 'Download release benchmark JSON'}
          </a>
          <a href="/classics-benchmark-results.json" download>
            <Download size={15} />
            {locale === 'zh' ? '下载 Arcade 基准 JSON' : 'Download Arcade benchmark JSON'}
          </a>
        </div>
      </section>
    </>
  )
}
