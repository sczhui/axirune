import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sword,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  DEFAULT_RIVER_OATH_RULES,
  RiverOathEngine,
  createRiverOathEngine,
  getRiverOathStage,
  type RiverOathEffectState,
  type RiverOathEnemyKind,
  type RiverOathEnemyState,
  type RiverOathEvent,
  type RiverOathHeroId,
  type RiverOathInput,
  type RiverOathRuleOverrides,
  type RiverOathSnapshot,
} from '../../arcade/river-oath'
import type { Locale } from '../../content/site'
import './river-oath.css'

const WORLD_WIDTH = 1280
const WORLD_HEIGHT = 720
const MAX_DPR = 2
const MAX_FRAME_MS = 100
const HUD_INTERVAL_MS = 80

const STAGE_BACKGROUNDS: Record<string, string> = {
  'reedwater-causeway': '/arcade/river-oath/stage-reedwater.jpg',
  'cinder-foundry': '/arcade/river-oath/stage-foundry.jpg',
  'moonwake-harbor': '/arcade/river-oath/stage-harbor.jpg',
  'cloudbreak-beacon': '/arcade/river-oath/stage-beacon.jpg',
}

const HEROES: ReadonlyArray<{
  id: RiverOathHeroId
  glyph: string
  name: string
  title: Record<Locale, string>
  note: Record<Locale, string>
}> = [
  {
    id: 'willow-duelist',
    glyph: '柳',
    name: 'SUYIN',
    title: { zh: '柳刃游侠', en: 'Willow Duelist' },
    note: { zh: '迅捷 · 连击 · 广域剑舞', en: 'Speed · chains · wide blade dance' },
  },
  {
    id: 'astral-lancer',
    glyph: '星',
    name: 'JIYAN',
    title: { zh: '星槊先锋', en: 'Astral Lancer' },
    note: { zh: '均衡 · 长距 · 破阵冲锋', en: 'Balanced · reach · formation break' },
  },
  {
    id: 'iron-tactician',
    glyph: '策',
    name: 'MOYAN',
    title: { zh: '玄甲军师', en: 'Iron Tactician' },
    note: { zh: '坚韧 · 重击 · 八方阵印', en: 'Durable · impact · eightfold seal' },
  },
]

export interface RiverOathRuleContract {
  readonly schema: 'axirune-arcade/river-oath/1'
  readonly game: 'river-oath'
  readonly stage: number
  readonly stage_key: string
  readonly wave: number
  readonly wave_key: string
  readonly campaign_index: number
  readonly defeated: number
  readonly enemy_speed: number
  readonly enemy_health: number
  readonly enemy_damage: number
  readonly enemy_guard: number
  readonly spawn_interval_ms: number
  readonly enemy_count: number
  readonly boss_active: boolean
  readonly boss_phase: string
  readonly boss_health: number
  readonly boss_damage: number
  readonly boss_guard: number
  readonly reward_score: number
  readonly reward_renown: number
  readonly drop_kind: string
  readonly drop_count: number
  readonly drop_rate_percent: number
  readonly difficulty: string
}

export interface RiverOathRuleQuery {
  readonly stage: number
  readonly wave: number
  readonly defeated: number
  readonly combo: number
}

export interface RiverOathGameProps {
  readonly locale: Locale
  readonly contract: RiverOathRuleContract
  readonly revision: number
  readonly evaluateRules: (query: RiverOathRuleQuery) => Promise<RiverOathRuleContract>
}

type HeldControl =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'light'
  | 'heavy'
  | 'launcher'
  | 'dodge'
  | 'guard'
  | 'skill'

type HudState = Pick<
  RiverOathSnapshot,
  'status' | 'score' | 'stageIndex' | 'waveIndex' | 'tick' | 'message'
> & {
  health: number
  maxHealth: number
  focus: number
  maxFocus: number
  combo: number
  enemies: number
  stageTitle: string
  waveTitle: string
  boss: { name: string; health: number; maxHealth: number; phase: number } | null
  branchAvailable: readonly string[]
}

const EMPTY_HELD: Record<HeldControl, boolean> = {
  left: false,
  right: false,
  up: false,
  down: false,
  light: false,
  heavy: false,
  launcher: false,
  dodge: false,
  guard: false,
  skill: false,
}

export function RiverOathGame({
  locale,
  contract,
  revision,
  evaluateRules,
}: RiverOathGameProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<RiverOathEngine | null>(null)
  const inputRef = useRef<Record<HeldControl, boolean>>({ ...EMPTY_HELD })
  const contractRef = useRef(contract)
  const revisionRef = useRef(revision)
  const appliedRevisionRef = useRef(revision)
  const evaluateRulesRef = useRef(evaluateRules)
  const mountedRef = useRef(false)
  const intersectingRef = useRef(true)
  const pageVisibleRef = useRef(true)
  const renderRequestedRef = useRef(true)
  const reducedMotionRef = useRef(false)
  const soundOnRef = useRef(false)
  const audioRef = useRef<AudioContext | null>(null)
  const defeatedRef = useRef(0)
  const rulesGenerationRef = useRef(0)
  const rulesUpdatingRef = useRef(false)
  const rulesBoundaryRef = useRef('0:0')
  const imageRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const pulseTimersRef = useRef<Set<number>>(new Set())

  if (!engineRef.current) {
    engineRef.current = createRiverOathEngine({
      heroId: 'astral-lancer',
      rules: contractToOverrides(contract),
    })
  }

  const [selectedHero, setSelectedHero] = useState<RiverOathHeroId>('astral-lancer')
  const [heroLocked, setHeroLocked] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const [rulesUpdating, setRulesUpdating] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [gated, setGated] = useState(false)
  const [hud, setHud] = useState<HudState>(() => hudFromSnapshot(engineRef.current!.snapshot()))

  contractRef.current = contract
  revisionRef.current = revision
  evaluateRulesRef.current = evaluateRules
  soundOnRef.current = soundOn

  const publish = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    setHud(hudFromSnapshot(engine.snapshot()))
    renderRequestedRef.current = true
  }, [])

  const focusGame = useCallback(() => {
    window.requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }))
  }, [])

  const replaceEngine = useCallback((heroId: RiverOathHeroId, start: boolean) => {
    rulesGenerationRef.current += 1
    const next = createRiverOathEngine({ heroId, rules: contractToOverrides(contractRef.current) })
    if (start) next.start()
    engineRef.current = next
    inputRef.current = { ...EMPTY_HELD }
    defeatedRef.current = 0
    rulesBoundaryRef.current = '0:0'
    appliedRevisionRef.current = revisionRef.current
    setRuleError(null)
    rulesUpdatingRef.current = false
    setRulesUpdating(false)
    setHeroLocked(start)
    publish()
  }, [publish])

  const begin = useCallback(() => {
    replaceEngine(selectedHero, true)
    focusGame()
  }, [focusGame, replaceEngine, selectedHero])

  const restart = useCallback(() => {
    replaceEngine(selectedHero, false)
    setHeroLocked(false)
    focusGame()
  }, [focusGame, replaceEngine, selectedHero])

  const togglePause = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    if (engine.status === 'ready') {
      begin()
      return
    }
    if (engine.status === 'running') engine.pause()
    else if (engine.status === 'paused') engine.resume()
    inputRef.current = { ...EMPTY_HELD }
    publish()
    focusGame()
  }, [begin, focusGame, publish])

  const continueStage = useCallback((branchId?: string) => {
    const engine = engineRef.current
    if (!engine || engine.status !== 'stage-clear') return
    if (branchId) engine.chooseBranch(branchId)
    engine.advanceStage()
    const snapshot = engine.snapshot()
    const stage = getRiverOathStage(snapshot)
    const wave = stage.waves[snapshot.waveIndex]
    const generation = ++rulesGenerationRef.current
    engine.pause()
    rulesUpdatingRef.current = true
    setRulesUpdating(true)
    void evaluateRulesRef.current({
      stage: snapshot.stageIndex + 1,
      wave: snapshot.waveIndex + 1,
      defeated: defeatedRef.current,
      combo: snapshot.player.combo.hits,
    }).then((nextContract) => {
      if (!mountedRef.current || generation !== rulesGenerationRef.current) return
      contractRef.current = nextContract
      engineRef.current = applyContractToEngine(engineRef.current!, nextContract)
      appliedRevisionRef.current = revisionRef.current
      rulesBoundaryRef.current = `${snapshot.stageIndex}:${snapshot.waveIndex}`
      engineRef.current.start()
      setRuleError(null)
      publish()
      focusGame()
    }).catch((error) => {
      if (!mountedRef.current || generation !== rulesGenerationRef.current) return
      setRuleError(error instanceof Error ? error.message : String(error))
      engineRef.current?.start()
      publish()
    }).finally(() => {
      if (mountedRef.current && generation === rulesGenerationRef.current) {
        rulesUpdatingRef.current = false
        setRulesUpdating(false)
      }
    })
    void wave
  }, [focusGame, publish])

  const refreshRulesAtBoundary = useCallback((snapshot: RiverOathSnapshot) => {
    const boundary = `${snapshot.stageIndex}:${snapshot.waveIndex}`
    if (boundary === rulesBoundaryRef.current || rulesUpdatingRef.current) return
    rulesBoundaryRef.current = boundary
    const generation = ++rulesGenerationRef.current
    engineRef.current?.pause()
    rulesUpdatingRef.current = true
    setRulesUpdating(true)
    void evaluateRulesRef.current({
      stage: snapshot.stageIndex + 1,
      wave: snapshot.waveIndex + 1,
      defeated: defeatedRef.current,
      combo: snapshot.player.combo.hits,
    }).then((nextContract) => {
      if (!mountedRef.current || generation !== rulesGenerationRef.current) return
      contractRef.current = nextContract
      const current = engineRef.current
      if (current) {
        engineRef.current = applyContractToEngine(current, nextContract)
        engineRef.current.resume()
      }
      appliedRevisionRef.current = revisionRef.current
      setRuleError(null)
      publish()
    }).catch((error) => {
      if (!mountedRef.current || generation !== rulesGenerationRef.current) return
      setRuleError(error instanceof Error ? error.message : String(error))
      engineRef.current?.resume()
      publish()
    }).finally(() => {
      if (mountedRef.current && generation === rulesGenerationRef.current) {
        rulesUpdatingRef.current = false
        setRulesUpdating(false)
      }
    })
  }, [publish])

  const handleEvents = useCallback((events: readonly RiverOathEvent[]) => {
    if (events.length === 0) return
    for (const event of events) {
      if (event.type === 'enemy-defeated') defeatedRef.current += 1
    }
    playEventSounds(events, soundOnRef.current, audioRef)
    const waveEvent = events.find((event) => event.type === 'wave-started')
    if (waveEvent) refreshRulesAtBoundary(engineRef.current!.snapshot())
  }, [refreshRulesAtBoundary])

  useEffect(() => {
    mountedRef.current = true
    pageVisibleRef.current = document.visibilityState !== 'hidden'
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = media.matches
    const onMotion = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches
      renderRequestedRef.current = true
    }
    media.addEventListener?.('change', onMotion)

    for (const [stageId, source] of Object.entries(STAGE_BACKGROUNDS)) {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => {
        if (!mountedRef.current) return
        imageRef.current.set(stageId, image)
        renderRequestedRef.current = true
      }
      image.src = source
    }

    let animationFrame = 0
    let previousTime = performance.now()
    let lastHudTime = 0
    const root = rootRef.current
    const canvas = canvasRef.current

    const intersectionObserver = root && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
          intersectingRef.current = entry?.isIntersecting ?? true
          const nextGated = !intersectingRef.current || !pageVisibleRef.current
          setGated(nextGated)
          if (nextGated) inputRef.current = { ...EMPTY_HELD }
          renderRequestedRef.current = true
          previousTime = performance.now()
        }, { threshold: 0.05 })
      : null
    intersectionObserver?.observe(root!)

    const resizeObserver = canvas && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { renderRequestedRef.current = true })
      : null
    if (canvas) resizeObserver?.observe(canvas)

    const onVisibility = () => {
      pageVisibleRef.current = document.visibilityState !== 'hidden'
      const nextGated = !pageVisibleRef.current || !intersectingRef.current
      setGated(nextGated)
      inputRef.current = { ...EMPTY_HELD }
      previousTime = performance.now()
      renderRequestedRef.current = true
    }
    document.addEventListener('visibilitychange', onVisibility)

    const frame = (time: number) => {
      const engine = engineRef.current
      const active = pageVisibleRef.current && intersectingRef.current
      const elapsed = Math.min(MAX_FRAME_MS, Math.max(0, time - previousTime))
      const hudDue = Boolean(engine && time - lastHudTime >= HUD_INTERVAL_MS)
      previousTime = time
      if (engine && active && engine.status === 'running' && !rulesUpdatingRef.current) {
        const result = engine.advance(elapsed, inputFor(inputRef.current))
        handleEvents(result.events)
        renderRequestedRef.current = true
      }
      const frameSnapshot = engine && ((canvas && active && renderRequestedRef.current) || hudDue)
        ? engine.snapshot()
        : null
      if (engine && canvas && active && renderRequestedRef.current && frameSnapshot) {
        drawRiverOath(canvas, frameSnapshot, imageRef.current, reducedMotionRef.current)
        renderRequestedRef.current = engine.status === 'running'
      }
      if (frameSnapshot && hudDue) {
        setHud(hudFromSnapshot(frameSnapshot))
        lastHudTime = time
      }
      animationFrame = window.requestAnimationFrame(frame)
    }
    animationFrame = window.requestAnimationFrame(frame)

    return () => {
      mountedRef.current = false
      window.cancelAnimationFrame(animationFrame)
      intersectionObserver?.disconnect()
      resizeObserver?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      media.removeEventListener?.('change', onMotion)
      for (const timer of pulseTimersRef.current) window.clearTimeout(timer)
      pulseTimersRef.current.clear()
      void audioRef.current?.close()
      audioRef.current = null
    }
  }, [handleEvents])

  const setControl = useCallback((control: HeldControl, active: boolean) => {
    inputRef.current = { ...inputRef.current, [control]: active }
    if (active) focusGame()
  }, [focusGame])

  const pulseControl = useCallback((control: HeldControl) => {
    setControl(control, true)
    const timer = window.setTimeout(() => {
      pulseTimersRef.current.delete(timer)
      setControl(control, false)
    }, 86)
    pulseTimersRef.current.add(timer)
  }, [setControl])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const control = controlForKey(event.code)
    if (control) {
      event.preventDefault()
      setControl(control, true)
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault()
      if (!event.repeat) togglePause()
    } else if (event.code === 'Enter' && hud.status === 'ready') {
      event.preventDefault()
      begin()
    }
  }

  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    const control = controlForKey(event.code)
    if (!control) return
    event.preventDefault()
    setControl(control, false)
  }

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    soundOnRef.current = next
    if (next) {
      audioRef.current ??= new AudioContext()
      void audioRef.current.resume()
      playTone(audioRef.current, 420, 0.055, 'sine', 0.035)
    }
  }

  const stage = engineRef.current ? getRiverOathStage(engineRef.current.snapshot()) : null
  const branchDefinitions = stage?.branches?.filter(({ id }) => hud.branchAvailable.includes(id)) ?? []
  const pendingRevision = revision > appliedRevisionRef.current
  const statusCopy = statusLabel(hud.status, locale)
  const canToggleSimulation = hud.status === 'ready' || hud.status === 'running' || hud.status === 'paused'
  const simulationControlLabel = hud.status === 'running'
    ? (locale === 'zh' ? '暂停' : 'Pause')
    : hud.status === 'paused'
      ? (locale === 'zh' ? '继续' : 'Resume')
      : hud.status === 'ready'
        ? (locale === 'zh' ? '开始' : 'Start')
        : (locale === 'zh' ? '当前不可用' : 'Unavailable')

  return (
    <article
      ref={rootRef}
      className="river-oath-game"
      data-status={hud.status}
      data-testid="river-oath-game"
      tabIndex={0}
      aria-label={locale === 'zh' ? 'River Oath 原创横版动作游戏' : 'River Oath original lane brawler'}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={() => { inputRef.current = { ...EMPTY_HELD } }}
    >
      <header className="river-oath-game__command-bar">
        <div className="river-oath-game__command-title">
          <span className="river-oath-game__seal" aria-hidden="true">誓</span>
          <div><strong>RIVER OATH</strong><small>{hud.stageTitle} / {hud.waveTitle}</small></div>
        </div>
        <div className="river-oath-game__command-actions">
          <span className={`river-oath-game__runtime ${rulesUpdating ? 'is-building' : ''}`}>
            <i />{rulesUpdating ? 'APPLYING AXC' : pendingRevision ? 'RULES QUEUED' : '60 HZ DETERMINISTIC'}
          </span>
          <button type="button" onClick={toggleSound} aria-label={soundOn ? (locale === 'zh' ? '关闭音效' : 'Mute audio') : (locale === 'zh' ? '开启音效' : 'Enable audio')}>
            {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button type="button" onClick={togglePause} disabled={!canToggleSimulation} aria-label={simulationControlLabel}>
            {hud.status === 'running' ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button type="button" onClick={restart} aria-label={locale === 'zh' ? '重开战役' : 'Restart campaign'}><RotateCcw size={17} /></button>
        </div>
      </header>

      <div className="river-oath-game__viewport">
        <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} aria-hidden="true" />

        <div className="river-oath-game__hud" aria-label={locale === 'zh' ? '战斗状态' : 'Combat status'}>
          <div className="river-oath-game__hero-hud">
            <span className="river-oath-game__portrait" aria-hidden="true">{heroGlyph(selectedHero)}</span>
            <div className="river-oath-game__vitals">
              <div><strong>{heroName(selectedHero)}</strong><small>LV. 01 / {heroTitle(selectedHero, locale)}</small></div>
              <Meter label={locale === 'zh' ? '生命' : 'Health'} value={hud.health} max={hud.maxHealth} kind="health" />
              <Meter label={locale === 'zh' ? '专注' : 'Focus'} value={hud.focus} max={hud.maxFocus} kind="focus" />
            </div>
          </div>
          <div className="river-oath-game__mission-hud">
            <span>{String(hud.stageIndex + 1).padStart(2, '0')} — {String(hud.waveIndex + 1).padStart(2, '0')}</span>
            <strong>{hud.score.toLocaleString()}</strong>
            <small>{locale === 'zh' ? `敌军 ${hud.enemies}` : `${hud.enemies} HOSTILES`}</small>
          </div>
          {hud.combo > 1 ? <div className="river-oath-game__combo"><strong>{hud.combo}</strong><span>CHAIN</span></div> : null}
        </div>

        {hud.boss ? (
          <div className="river-oath-game__boss" role="meter" aria-label={`${hud.boss.name} ${locale === 'zh' ? '生命' : 'health'}`} aria-valuemin={0} aria-valuemax={hud.boss.maxHealth} aria-valuenow={hud.boss.health}>
            <div><span>BOSS / PHASE {hud.boss.phase}</span><strong>{hud.boss.name}</strong></div>
            <i><b style={{ width: `${Math.max(0, hud.boss.health / hud.boss.maxHealth) * 100}%` }} /></i>
          </div>
        ) : null}

        {!heroLocked && hud.status === 'ready' ? (
          <div className="river-oath-game__overlay river-oath-game__hero-select">
            <span className="river-oath-game__eyebrow">THE FIRST BANNER / 01</span>
            <h3>{locale === 'zh' ? '择一人，共赴河山之誓' : 'CHOOSE WHO CARRIES THE OATH'}</h3>
            <p>{locale === 'zh' ? '三名原创英雄拥有独立体型、武器手感与技能倍率。' : 'Three original heroes, each with a distinct silhouette, weapon reach, and skill curve.'}</p>
            <div className="river-oath-game__heroes">
              {HEROES.map((hero) => (
                <button key={hero.id} type="button" className={selectedHero === hero.id ? 'is-selected' : ''} onClick={() => setSelectedHero(hero.id)} aria-pressed={selectedHero === hero.id}>
                  <span>{hero.glyph}</span><strong>{hero.name}</strong><b>{hero.title[locale]}</b><small>{hero.note[locale]}</small>
                </button>
              ))}
            </div>
            <button type="button" className="river-oath-game__primary" onClick={begin}><Sword size={17} />{locale === 'zh' ? '立誓出征' : 'TAKE THE FIELD'}</button>
            <small>{locale === 'zh' ? '键盘：WASD / 方向键移动 · J K U I L · 空格闪避' : 'Keyboard: WASD / arrows · J K U I L · Space to dodge'}</small>
          </div>
        ) : null}

        {heroLocked && hud.status === 'paused' ? (
          <div className="river-oath-game__overlay river-oath-game__pause-panel">
            <Pause size={28} /><span>SIMULATION PAUSED</span>
            <h3>{locale === 'zh' ? '战局已冻结' : 'THE FIELD IS HELD'}</h3>
            <p>{locale === 'zh' ? '确定性时钟与输入状态均已暂停。' : 'The deterministic clock and input state are paused.'}</p>
            <button type="button" className="river-oath-game__primary" onClick={togglePause}><Play size={16} />{locale === 'zh' ? '继续' : 'RESUME'}</button>
          </div>
        ) : null}

        {hud.status === 'stage-clear' ? (
          <div className="river-oath-game__overlay river-oath-game__clear-panel">
            <Sparkles size={29} /><span>STAGE SECURED</span>
            <h3>{locale === 'zh' ? '旌旗已越过此地' : 'THE BANNER MOVES ON'}</h3>
            <p>{locale === 'zh' ? `战功 ${hud.score.toLocaleString()}。选择下一条原创战役路线。` : `${hud.score.toLocaleString()} renown. Choose the next original campaign route.`}</p>
            <div className="river-oath-game__branches">
              {branchDefinitions.length > 0 ? branchDefinitions.map((branch) => (
                <button type="button" key={branch.id} onClick={() => continueStage(branch.id)}>{branch.label}<ChevronRight size={16} /></button>
              )) : <button type="button" onClick={() => continueStage()}>{locale === 'zh' ? '进入下一幕' : 'ENTER NEXT ACT'}<ChevronRight size={16} /></button>}
            </div>
          </div>
        ) : null}

        {(hud.status === 'game-over' || hud.status === 'campaign-clear') ? (
          <div className="river-oath-game__overlay river-oath-game__clear-panel">
            <span>{hud.status === 'campaign-clear' ? 'CAMPAIGN COMPLETE' : 'BANNER FALLEN'}</span>
            <h3>{hud.status === 'campaign-clear' ? (locale === 'zh' ? '河山见证此誓' : 'THE OATH ENDURES') : (locale === 'zh' ? '重整旗鼓' : 'REGROUP')}</h3>
            <p>{locale === 'zh' ? `最终战功 ${hud.score.toLocaleString()}` : `Final renown ${hud.score.toLocaleString()}`}</p>
            <button type="button" className="river-oath-game__primary" onClick={restart}><RotateCcw size={16} />{locale === 'zh' ? '重新开始' : 'BEGIN AGAIN'}</button>
          </div>
        ) : null}

        {gated ? <span className="river-oath-game__gated">RENDER SUSPENDED OFFSCREEN</span> : null}
        {ruleError ? <div className="river-oath-game__rule-error" role="alert">AXC: {ruleError}</div> : null}
      </div>

      <TouchControls locale={locale} onControl={setControl} onPulse={pulseControl} />

      <footer className="river-oath-game__status" aria-live="polite">
        <span><i data-status={hud.status} />{statusCopy}</span>
        <p>{hud.message}</p>
        <span>TICK {hud.tick.toLocaleString()} · AXC {shortRevision(revision)}</span>
      </footer>
    </article>
  )
}

function TouchControls({
  locale,
  onControl,
  onPulse,
}: {
  locale: Locale
  onControl: (control: HeldControl, active: boolean) => void
  onPulse: (control: HeldControl) => void
}) {
  return (
    <div className="river-oath-controls" aria-label={locale === 'zh' ? '触控操作' : 'Touch controls'}>
      <div className="river-oath-controls__dpad">
        <ControlButton control="up" label={locale === 'zh' ? '向后景移动' : 'Move upstage'} onControl={onControl} onPulse={onPulse}><ChevronUp /></ControlButton>
        <ControlButton control="left" label={locale === 'zh' ? '向左移动' : 'Move left'} onControl={onControl} onPulse={onPulse}><ChevronLeft /></ControlButton>
        <i aria-hidden="true" />
        <ControlButton control="right" label={locale === 'zh' ? '向右移动' : 'Move right'} onControl={onControl} onPulse={onPulse}><ChevronRight /></ControlButton>
        <ControlButton control="down" label={locale === 'zh' ? '向前景移动' : 'Move downstage'} onControl={onControl} onPulse={onPulse}><ChevronDown /></ControlButton>
      </div>
      <div className="river-oath-controls__actions">
        <ControlButton control="guard" label={locale === 'zh' ? '防御' : 'Guard'} text="I" onControl={onControl} onPulse={onPulse} />
        <ControlButton control="launcher" label={locale === 'zh' ? '挑空' : 'Launcher'} text="U" onControl={onControl} onPulse={onPulse} />
        <ControlButton control="dodge" label={locale === 'zh' ? '闪避' : 'Dodge'} text="↯" onControl={onControl} onPulse={onPulse} />
        <ControlButton control="skill" label={locale === 'zh' ? '绝技' : 'Skill'} text="L" emphasis onControl={onControl} onPulse={onPulse} />
        <ControlButton control="light" label={locale === 'zh' ? '轻击' : 'Light attack'} text="J" onControl={onControl} onPulse={onPulse} />
        <ControlButton control="heavy" label={locale === 'zh' ? '重击' : 'Heavy attack'} text="K" emphasis onControl={onControl} onPulse={onPulse} />
      </div>
    </div>
  )
}

function ControlButton({
  control,
  label,
  children,
  text,
  emphasis = false,
  onControl,
  onPulse,
}: {
  control: HeldControl
  label: string
  children?: React.ReactNode
  text?: string
  emphasis?: boolean
  onControl: (control: HeldControl, active: boolean) => void
  onPulse: (control: HeldControl) => void
}) {
  const pressedAtRef = useRef(0)
  const begin = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pressedAtRef.current = performance.now()
    onControl(control, true)
  }
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    onControl(control, false)
    // Preserve very short taps that begin and end between two fixed frames.
    if (performance.now() - pressedAtRef.current < 48) onPulse(control)
    pressedAtRef.current = 0
  }
  const cancel = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    pressedAtRef.current = 0
    onControl(control, false)
  }
  return (
    <button
      type="button"
      className={emphasis ? 'is-emphasis' : ''}
      aria-label={label}
      title={label}
      onPointerDown={begin}
      onPointerUp={end}
      onPointerCancel={cancel}
      onLostPointerCapture={() => onControl(control, false)}
      onClick={(event) => { if (event.detail === 0) onPulse(control) }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children ?? <strong>{text}</strong>}<small>{label}</small>
    </button>
  )
}

function Meter({ label, value, max, kind }: { label: string; value: number; max: number; kind: 'health' | 'focus' }) {
  const width = max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0
  return (
    <div className={`river-oath-meter river-oath-meter--${kind}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <i><b style={{ width: `${width}%` }} /></i><span>{Math.ceil(value)} / {Math.ceil(max)}</span>
    </div>
  )
}

function inputFor(held: Record<HeldControl, boolean>): RiverOathInput {
  return {
    moveX: Number(held.right) - Number(held.left),
    moveLane: Number(held.down) - Number(held.up),
    light: held.light,
    heavy: held.heavy,
    launcher: held.launcher,
    dodge: held.dodge,
    guard: held.guard,
    skill: held.skill,
  }
}

function controlForKey(code: string): HeldControl | null {
  if (code === 'ArrowLeft' || code === 'KeyA') return 'left'
  if (code === 'ArrowRight' || code === 'KeyD') return 'right'
  if (code === 'ArrowUp' || code === 'KeyW') return 'up'
  if (code === 'ArrowDown' || code === 'KeyS') return 'down'
  if (code === 'KeyJ') return 'light'
  if (code === 'KeyK') return 'heavy'
  if (code === 'KeyU') return 'launcher'
  if (code === 'KeyI') return 'guard'
  if (code === 'KeyL') return 'skill'
  if (code === 'Space') return 'dodge'
  return null
}

function hudFromSnapshot(snapshot: RiverOathSnapshot): HudState {
  const stage = snapshot.campaign.stages[snapshot.stageIndex]
  const wave = stage?.waves[snapshot.waveIndex]
  const boss = snapshot.enemies.find((enemy) => enemy.boss && enemy.health > 0)
  return {
    status: snapshot.status,
    score: snapshot.score,
    stageIndex: snapshot.stageIndex,
    waveIndex: snapshot.waveIndex,
    tick: snapshot.tick,
    message: snapshot.message,
    health: snapshot.player.health,
    maxHealth: snapshot.player.maxHealth,
    focus: snapshot.player.focus,
    maxFocus: snapshot.rules.player.maxFocus,
    combo: snapshot.player.combo.hits,
    enemies: snapshot.enemies.filter(({ health }) => health > 0).length,
    stageTitle: stage?.scene.title ?? 'River Oath',
    waveTitle: wave?.id.replaceAll('-', ' ').toUpperCase() ?? '—',
    boss: boss ? {
      name: enemyName(boss.kind),
      health: boss.health,
      maxHealth: boss.maxHealth,
      phase: boss.phase,
    } : null,
    branchAvailable: snapshot.branch.available,
  }
}

function contractToOverrides(contract: RiverOathRuleContract): RiverOathRuleOverrides {
  // The opening contract (89 HP / 123 speed / 14 damage) is the neutral
  // calibration point. Later Axirune outputs scale every enemy while retaining
  // each archetype's authored reach, cadence, behavior, and silhouette.
  const healthScale = contract.enemy_health / 89
  const speedScale = contract.enemy_speed / 123
  const damageScale = contract.enemy_damage / 14
  const guardScale = Math.max(.82, 1 + (contract.enemy_guard - 10) / 100)
  const bossForStage: Record<number, RiverOathEnemyKind> = {
    1: 'reedwater-warden',
    2: 'cinder-overseer',
    3: 'harbor-master',
    4: 'cloudbreak-oath',
  }
  const activeBoss = bossForStage[contract.stage] ?? 'cloudbreak-oath'
  const activeBossBase = DEFAULT_RIVER_OATH_RULES.enemies[activeBoss]
  const bossHealthScale = contract.boss_active && contract.boss_health > 0
    ? contract.boss_health / activeBossBase.maxHealth
    : healthScale
  const bossDamageScale = contract.boss_active && contract.boss_damage > 0
    ? contract.boss_damage / activeBossBase.damage
    : damageScale
  const bossKinds = new Set<RiverOathEnemyKind>([
    'reedwater-warden', 'cinder-overseer', 'harbor-master', 'cloudbreak-oath',
  ])
  const enemies = Object.fromEntries(
    (Object.keys(DEFAULT_RIVER_OATH_RULES.enemies) as RiverOathEnemyKind[]).map((kind) => {
      const base = DEFAULT_RIVER_OATH_RULES.enemies[kind]
      const boss = bossKinds.has(kind)
      const defended = base.behavior === 'defender' || base.behavior === 'brute' || boss
      return [kind, {
        maxHealth: Math.max(1, Math.round(base.maxHealth * (boss ? bossHealthScale : healthScale) * (defended ? guardScale : 1))),
        moveSpeed: Math.max(1, base.moveSpeed * speedScale),
        laneSpeed: Math.max(1, base.laneSpeed * speedScale),
        damage: Math.max(0, base.damage * (boss ? bossDamageScale : damageScale)),
      }]
    }),
  ) as RiverOathRuleOverrides['enemies']
  return {
    enemies,
    waves: {
      betweenWaveTicks: Math.max(18, Math.round(contract.spawn_interval_ms / 1_000 * 60)),
      maximumEnemies: Math.max(12, contract.enemy_count),
    },
    pickups: { dropChance: Math.max(0, Math.min(1, contract.drop_rate_percent / 100)) },
  }
}

function applyContractToEngine(engine: RiverOathEngine, contract: RiverOathRuleContract): RiverOathEngine {
  const snapshot = engine.snapshot()
  const overrides = contractToOverrides(contract)
  for (const kind of Object.keys(snapshot.rules.enemies) as RiverOathEnemyKind[]) {
    Object.assign(snapshot.rules.enemies[kind], overrides.enemies?.[kind])
  }
  Object.assign(snapshot.rules.waves, overrides.waves)
  Object.assign(snapshot.rules.pickups, overrides.pickups)
  for (const enemy of snapshot.enemies) {
    const nextMax = snapshot.rules.enemies[enemy.kind].maxHealth
    const ratio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1
    enemy.maxHealth = nextMax
    enemy.health = Math.max(1, Math.min(nextMax, Math.round(nextMax * ratio)))
  }
  return RiverOathEngine.fromSnapshot(snapshot)
}

function drawRiverOath(
  canvas: HTMLCanvasElement,
  snapshot: RiverOathSnapshot,
  images: ReadonlyMap<string, HTMLImageElement>,
  reducedMotion: boolean,
) {
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  const pixelBudget = rect.width < 620 ? 1_200_000 : 2_100_000
  const budgetDpr = Math.sqrt(pixelBudget / (rect.width * rect.height))
  const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1), budgetDpr)
  const pixelWidth = Math.max(1, Math.round(rect.width * dpr))
  const pixelHeight = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(pixelWidth / WORLD_WIDTH, 0, 0, pixelHeight / WORLD_HEIGHT, 0, 0)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  const highDetail = rect.width >= 620 && snapshot.enemies.length <= 8

  const stage = getRiverOathStage(snapshot)
  const impact = snapshot.effects.some((effect) => effect.kind === 'impact' && effect.ageTicks < 4)
  const shake = !reducedMotion && impact ? Math.sin(snapshot.tick * 7.3) * 3.5 : 0
  context.save()
  context.translate(shake, impact ? -Math.abs(shake) * 0.45 : 0)
  drawBackdrop(context, snapshot, images.get(stage.id))
  drawWeather(context, snapshot, reducedMotion)

  const actors: Array<{ lane: number; kind: 'player' | 'enemy' | 'pickup'; value: unknown }> = [
    ...snapshot.pickups.map((value) => ({ lane: value.lane, kind: 'pickup' as const, value })),
    ...snapshot.enemies.filter(({ health }) => health > 0).map((value) => ({ lane: value.lane, kind: 'enemy' as const, value })),
    { lane: snapshot.player.lane, kind: 'player', value: snapshot.player },
  ]
  actors.sort((left, right) => left.lane - right.lane || (left.kind === 'player' ? 1 : -1))
  for (const actor of actors) {
    if (actor.kind === 'enemy') drawEnemy(context, actor.value as RiverOathEnemyState, snapshot, reducedMotion, highDetail)
    else if (actor.kind === 'player') drawHero(context, snapshot, reducedMotion, highDetail)
    else drawPickup(context, actor.value as RiverOathSnapshot['pickups'][number], snapshot, highDetail)
  }
  for (const effect of snapshot.effects.slice(-32)) drawEffect(context, effect, snapshot, reducedMotion, highDetail)
  drawForegroundAtmosphere(context, snapshot)
  context.restore()
}

function drawBackdrop(context: CanvasRenderingContext2D, snapshot: RiverOathSnapshot, image?: HTMLImageElement) {
  const stage = getRiverOathStage(snapshot)
  const [deep, middle, accent] = stage.scene.palette
  context.fillStyle = deep
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  if (image?.complete && image.naturalWidth > 0) {
    const scale = Math.max(WORLD_WIDTH / image.naturalWidth, WORLD_HEIGHT / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    context.drawImage(image, (WORLD_WIDTH - width) / 2, (WORLD_HEIGHT - height) / 2, width, height)
  } else {
    const gradient = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT)
    gradient.addColorStop(0, deep)
    gradient.addColorStop(0.6, middle)
    gradient.addColorStop(1, accent)
    context.fillStyle = gradient
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  }
  const floorShade = context.createLinearGradient(0, 350, 0, WORLD_HEIGHT)
  floorShade.addColorStop(0, 'rgba(0,0,0,0)')
  floorShade.addColorStop(1, 'rgba(2,5,8,.5)')
  context.fillStyle = floorShade
  context.fillRect(0, 300, WORLD_WIDTH, 420)
  const vignette = context.createRadialGradient(640, 410, 120, 640, 380, 760)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(0.72, 'rgba(0,0,0,.08)')
  vignette.addColorStop(1, 'rgba(0,0,0,.58)')
  context.fillStyle = vignette
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
}

function drawWeather(context: CanvasRenderingContext2D, snapshot: RiverOathSnapshot, reducedMotion: boolean) {
  const scene = getRiverOathStage(snapshot).scene
  if (scene.weather === 'mist') {
    for (let index = 0; index < 5; index += 1) {
      const shift = reducedMotion ? 0 : ((snapshot.tick * (0.12 + index * 0.03) + index * 250) % 1500) - 100
      const gradient = context.createRadialGradient(shift, 330 + index * 52, 12, shift, 330 + index * 52, 280)
      gradient.addColorStop(0, 'rgba(220,233,226,.13)')
      gradient.addColorStop(1, 'rgba(220,233,226,0)')
      context.fillStyle = gradient
      context.fillRect(shift - 300, 245, 600, 280)
    }
  }
  if (scene.weather === 'rain') {
    context.strokeStyle = 'rgba(174,210,230,.2)'
    context.lineWidth = 1
    context.beginPath()
    for (let index = 0; index < 76; index += 1) {
      const x = (index * 157 + snapshot.tick * (reducedMotion ? 0 : 9)) % 1380 - 50
      const y = (index * 83 + snapshot.tick * (reducedMotion ? 0 : 14)) % 780 - 30
      context.moveTo(x, y)
      context.lineTo(x - 10, y + 25)
    }
    context.stroke()
  }
  if (scene.weather === 'embers') {
    context.fillStyle = 'rgba(255,174,74,.58)'
    for (let index = 0; index < 34; index += 1) {
      const x = (index * 191 + snapshot.tick * (reducedMotion ? 0 : 0.7)) % 1280
      const y = 690 - ((index * 79 + snapshot.tick * (reducedMotion ? 0 : 1.8)) % 620)
      context.beginPath()
      context.arc(x, y, 1 + (index % 3) * 0.7, 0, Math.PI * 2)
      context.fill()
    }
  }
}

function positionFor(x: number, lane: number, snapshot: RiverOathSnapshot) {
  const arena = getRiverOathStage(snapshot).scene.arena
  const xRatio = (x - arena.minX) / (arena.maxX - arena.minX)
  const laneRatio = (lane - arena.minLane) / (arena.maxLane - arena.minLane)
  return {
    x: 66 + xRatio * 1148,
    y: 405 + laneRatio * 230,
    scale: 0.76 + laneRatio * 0.31,
  }
}

function drawHero(context: CanvasRenderingContext2D, snapshot: RiverOathSnapshot, reducedMotion: boolean, highDetail: boolean) {
  const player = snapshot.player
  const point = positionFor(player.x, player.lane, snapshot)
  const bob = player.action === 'walk' ? Math.sin(player.actionTick * 0.72) * 3 : 0
  const crouch = player.action === 'dodge' ? 12 : player.action === 'heavy' ? 4 : 0
  const lean = player.action === 'dodge' ? -.12 : player.action === 'hurt' ? -.08 : 0
  const hurtFlash = !reducedMotion && player.action === 'hurt' && player.actionTick % 4 < 2
  const palette = heroPalette(player.heroId)
  context.save()
  context.translate(point.x, point.y - bob)
  context.scale(player.facing * point.scale * 1.1, point.scale * 1.1)
  drawShadow(context, 0, 3, player.action === 'dodge' ? 58 : 45, 13, .56)
  if (player.invulnerableTicks > 0) {
    context.globalAlpha = reducedMotion ? .72 : .58 + Math.sin(snapshot.tick * 1.7) * .2
  }
  if (player.action === 'skill') drawHeroAura(context, player.heroId, player.actionTick)
  if (player.action === 'hurt') drawDamageRim(context, 0, -82, 62, 104, '#ffe0a2', reducedMotion ? .22 : .38)
  context.translate(0, crouch)
  context.rotate(lean)
  drawLegs(context, palette, player.action, player.actionTick)
  drawCape(context, palette, player.actionTick, player.heroId)
  drawTorso(context, palette, player.heroId, hurtFlash)
  drawArmsAndWeapon(context, palette, player.heroId, player.action, player.actionTick)
  drawHeroHead(context, palette, player.heroId, highDetail)
  drawAttackArc(context, player.heroId, player.action, player.actionTick)
  context.restore()
}

function drawEnemy(context: CanvasRenderingContext2D, enemy: RiverOathEnemyState, snapshot: RiverOathSnapshot, reducedMotion: boolean, highDetail: boolean) {
  const point = positionFor(enemy.x, enemy.lane, snapshot)
  const scale = point.scale * (enemy.boss ? 1.32 : enemy.kind === 'iron-breaker' ? 1.18 : enemy.kind === 'lacquer-guard' ? 1.11 : 1.02)
  const bob = enemy.action === 'approach' ? Math.sin(enemy.actionTick * .6 + enemy.id) * 2.5 : 0
  const palette = enemyPalette(enemy.kind)
  context.save()
  context.translate(point.x, point.y - enemy.height * .42 - bob)
  context.scale(enemy.facing * scale, scale)
  drawShadow(context, 0, enemy.height * .38 + 3, enemy.boss ? 52 : 36, enemy.boss ? 15 : 10, .48)
  if (enemy.boss) drawBossAura(context, enemy, snapshot.tick)
  if (enemy.action === 'hurt') {
    drawDamageRim(context, 0, -78, enemy.boss ? 72 : 53, enemy.boss ? 112 : 92, palette.accent, .35)
    if (!reducedMotion && enemy.actionTick % 4 < 2) context.globalCompositeOperation = 'screen'
  }
  drawEnemyBackGear(context, palette, enemy, highDetail)
  drawEnemyLegs(context, palette, enemy)
  drawEnemySkirt(context, palette, enemy)
  drawEnemyRearArm(context, palette, enemy)
  drawEnemyTorso(context, palette, enemy)
  drawEnemyHead(context, palette, enemy, highDetail)
  drawEnemyArms(context, palette, enemy)
  if (enemy.health < enemy.maxHealth && !enemy.boss) drawMiniHealth(context, enemy)
  context.restore()
}

type Palette = { dark: string; mid: string; light: string; accent: string; skin: string; metal: string }

const MODEL_OUTLINE = '#101617'

function materialGradient(
  context: CanvasRenderingContext2D,
  top: number,
  bottom: number,
  palette: Pick<Palette, 'dark' | 'mid' | 'light'>,
) {
  const gradient = context.createLinearGradient(-24, top, 26, bottom)
  gradient.addColorStop(0, palette.light)
  gradient.addColorStop(.22, palette.mid)
  gradient.addColorStop(.68, palette.dark)
  gradient.addColorStop(1, shade(palette.dark, -.18))
  return gradient
}

function metalGradient(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, base: string) {
  const gradient = context.createLinearGradient(x1, y1, x2, y2)
  gradient.addColorStop(0, shade(base, -.38))
  gradient.addColorStop(.28, shade(base, .28))
  gradient.addColorStop(.48, '#fff4cf')
  gradient.addColorStop(.62, base)
  gradient.addColorStop(1, shade(base, -.32))
  return gradient
}

function shade(color: string, amount: number) {
  const normalized = color.replace('#', '')
  if (normalized.length !== 6) return color
  const value = Number.parseInt(normalized, 16)
  const shift = amount >= 0 ? 255 : 0
  const ratio = Math.abs(amount)
  const channel = (offset: number) => Math.round(((value >> offset) & 255) * (1 - ratio) + shift * ratio)
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}

function drawJointedLimb(
  context: CanvasRenderingContext2D,
  shoulder: readonly [number, number],
  joint: readonly [number, number],
  end: readonly [number, number],
  width: number,
  base: string,
  highlight: string,
) {
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = MODEL_OUTLINE
  context.lineWidth = width + 5
  context.beginPath(); context.moveTo(...shoulder); context.lineTo(...joint); context.lineTo(...end); context.stroke()
  context.strokeStyle = base
  context.lineWidth = width
  context.beginPath(); context.moveTo(...shoulder); context.lineTo(...joint); context.lineTo(...end); context.stroke()
  context.strokeStyle = highlight
  context.globalAlpha *= .52
  context.lineWidth = Math.max(2, width * .2)
  context.beginPath(); context.moveTo(shoulder[0] - 2, shoulder[1] - 2); context.lineTo(joint[0] - 2, joint[1] - 2); context.stroke()
  context.globalAlpha /= .52
  context.fillStyle = base; context.strokeStyle = MODEL_OUTLINE; context.lineWidth = 3
  context.beginPath(); context.arc(joint[0], joint[1], width * .46, 0, Math.PI * 2); context.fill(); context.stroke()
}

function drawDamageRim(context: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number, color: string, alpha: number) {
  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = alpha
  context.strokeStyle = color
  context.lineWidth = 7
  context.beginPath(); context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2); context.stroke()
  context.globalAlpha *= .75
  context.strokeStyle = '#fff4cf'; context.lineWidth = 2; context.stroke()
  context.restore()
}

function strokeModel(context: CanvasRenderingContext2D, width = 3) {
  context.strokeStyle = MODEL_OUTLINE
  context.lineWidth = width
  context.lineJoin = 'round'
  context.stroke()
}

function heroPalette(hero: RiverOathHeroId): Palette {
  if (hero === 'willow-duelist') return { dark: '#102c30', mid: '#2e7772', light: '#9fd7bd', accent: '#e5bb67', skin: '#e7bb91', metal: '#d8e5dc' }
  if (hero === 'iron-tactician') return { dark: '#1c2330', mid: '#4d5363', light: '#98a2a4', accent: '#d1794c', skin: '#d4a47e', metal: '#c8b890' }
  return { dark: '#17263e', mid: '#365f85', light: '#91bdd1', accent: '#e3a84f', skin: '#e1af84', metal: '#e1d4a8' }
}

function enemyPalette(kind: RiverOathEnemyKind): Palette {
  if (kind === 'reed-spearman') return { dark: '#252e25', mid: '#546044', light: '#91936a', accent: '#a88b4a', skin: '#bd8c6d', metal: '#9aa09a' }
  if (kind === 'hill-archer') return { dark: '#26243a', mid: '#524b6b', light: '#9d8ca1', accent: '#b67a4c', skin: '#bd8a67', metal: '#a7a6a0' }
  if (kind === 'lacquer-guard') return { dark: '#1e2925', mid: '#3d5b4d', light: '#768a65', accent: '#d7ad54', skin: '#bd8c6d', metal: '#b8a669' }
  if (kind === 'rope-hooker') return { dark: '#25251d', mid: '#6a5a38', light: '#a68b51', accent: '#4fa994', skin: '#c08b69', metal: '#9a9b91' }
  if (kind === 'ember-alchemist') return { dark: '#2d1820', mid: '#71342e', light: '#ad6040', accent: '#ff9b38', skin: '#c18a69', metal: '#b9a783' }
  if (kind === 'banner-caller') return { dark: '#201c32', mid: '#51476e', light: '#8e79a1', accent: '#dbb15d', skin: '#c29172', metal: '#aaa69b' }
  if (kind === 'iron-breaker') return { dark: '#17191a', mid: '#3e4240', light: '#747770', accent: '#bb603f', skin: '#b78065', metal: '#a89b7c' }
  if (kind === 'reedwater-warden') return { dark: '#15252b', mid: '#315b63', light: '#70a3a0', accent: '#d5bb69', skin: '#bd8266', metal: '#a9baad' }
  if (kind === 'cinder-overseer') return { dark: '#271518', mid: '#6f2d27', light: '#ad5036', accent: '#ff9d3c', skin: '#bd8266', metal: '#b99362' }
  if (kind === 'harbor-master') return { dark: '#111c2c', mid: '#2b4c65', light: '#5f8197', accent: '#e1ae5d', skin: '#bd8266', metal: '#a4b1b0' }
  if (kind === 'cloudbreak-oath') return { dark: '#18152a', mid: '#453866', light: '#79669d', accent: '#f0b64e', skin: '#bd8266', metal: '#c3ad79' }
  return { dark: '#252629', mid: '#54544d', light: '#89856f', accent: '#a4513e', skin: '#b98665', metal: '#98978b' }
}

function drawShadow(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, alpha: number) {
  context.save()
  context.scale(1, .72)
  const gradient = context.createRadialGradient(x, y, 2, x, y, width)
  gradient.addColorStop(0, `rgba(0,0,0,${alpha})`)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient
  context.beginPath()
  context.ellipse(x, y, width, height, 0, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function drawLegs(context: CanvasRenderingContext2D, palette: Palette, action: string, tick: number) {
  const stride = action === 'walk' ? Math.sin(tick * .7) * 11 : action === 'dodge' ? 15 : 0
  drawJointedLimb(context, [-9, -50], [-12 - stride * .18, -29], [-10 + stride, -8], 12, palette.dark, palette.mid)
  drawJointedLimb(context, [9, -50], [12 + stride * .18, -29], [10 - stride, -8], 13, shade(palette.dark, .08), palette.light)

  for (const [x, forward] of [[-10 + stride, -1], [10 - stride, 1]] as const) {
    context.fillStyle = materialGradient(context, -31, -5, { dark: palette.dark, mid: palette.mid, light: palette.light })
    context.beginPath(); context.roundRect(x - 7, -29, 14, 23, 5); context.fill(); strokeModel(context, 2.5)
    context.strokeStyle = palette.accent; context.lineWidth = 2
    context.beginPath(); context.moveTo(x - 5, -21); context.lineTo(x + 5, -21); context.stroke()
    context.fillStyle = shade(palette.dark, -.25)
    context.beginPath(); context.roundRect(x - (forward > 0 ? 4 : 11), -10, 20, 8, 4); context.fill(); strokeModel(context, 2.5)
  }
}

function drawCape(context: CanvasRenderingContext2D, palette: Palette, tick: number, hero: RiverOathHeroId) {
  const sway = Math.sin(tick * .16) * 6
  const capeGradient = context.createLinearGradient(-40, -108, 4, -24)
  capeGradient.addColorStop(0, hero === 'iron-tactician' ? palette.mid : palette.dark)
  capeGradient.addColorStop(.55, shade(palette.dark, -.12))
  capeGradient.addColorStop(1, shade(palette.dark, -.35))
  context.fillStyle = capeGradient
  context.beginPath()
  context.moveTo(-22, -105)
  context.bezierCurveTo(-42 - sway, -91, -45 - sway, -54, -34 - sway, -20)
  context.lineTo(-8 - sway * .25, -39)
  context.lineTo(17, -98)
  context.closePath(); context.fill(); strokeModel(context, 3)
  context.strokeStyle = shade(palette.light, -.15); context.lineWidth = 1.8; context.globalAlpha *= .58
  context.beginPath(); context.moveTo(-16, -98); context.bezierCurveTo(-31 - sway, -78, -34 - sway, -48, -27 - sway, -25); context.stroke()
  context.beginPath(); context.moveTo(-5, -96); context.bezierCurveTo(-19 - sway * .5, -73, -21 - sway * .5, -52, -14, -38); context.stroke()
  context.globalAlpha /= .58

  if (hero === 'willow-duelist') {
    context.strokeStyle = palette.accent; context.lineWidth = 5; context.lineCap = 'round'
    context.beginPath(); context.moveTo(-14, -104); context.bezierCurveTo(-45 - sway, -98, -58 - sway, -69, -69 - sway, -51); context.stroke()
    context.strokeStyle = shade(palette.accent, .34); context.lineWidth = 1.5; context.stroke()
  } else if (hero === 'iron-tactician') {
    context.fillStyle = shade(palette.mid, -.22)
    context.beginPath(); context.moveTo(6, -53); context.lineTo(24, -42); context.lineTo(18, -14); context.lineTo(2, -37); context.closePath(); context.fill(); strokeModel(context, 2.5)
  }
}

function drawTorso(context: CanvasRenderingContext2D, palette: Palette, hero: RiverOathHeroId, flash: boolean) {
  context.fillStyle = flash ? '#fff2ce' : materialGradient(context, -109, -39, palette)
  context.beginPath(); context.moveTo(-27, -105); context.quadraticCurveTo(0, -117, 25, -104); context.lineTo(30, -52); context.quadraticCurveTo(16, -38, 0, -35); context.quadraticCurveTo(-17, -38, -30, -51); context.closePath(); context.fill(); strokeModel(context, 3.5)

  context.fillStyle = shade(palette.dark, -.2)
  context.beginPath(); context.moveTo(-24, -55); context.lineTo(-30, -31); context.lineTo(-5, -42); context.lineTo(0, -55); context.closePath(); context.fill(); strokeModel(context, 2)
  context.beginPath(); context.moveTo(24, -55); context.lineTo(30, -31); context.lineTo(5, -42); context.lineTo(0, -55); context.closePath(); context.fill(); strokeModel(context, 2)

  const armour = materialGradient(context, -103, -49, palette)
  context.fillStyle = armour
  context.beginPath(); context.roundRect(-20, -101, 41, 51, 9); context.fill(); strokeModel(context, 3)
  context.fillStyle = shade(palette.dark, -.12)
  context.beginPath(); context.moveTo(-17, -100); context.lineTo(0, -86); context.lineTo(17, -100); context.lineTo(12, -107); context.lineTo(0, -94); context.lineTo(-12, -107); context.closePath(); context.fill(); strokeModel(context, 2)

  if (hero === 'iron-tactician') {
    context.fillStyle = metalGradient(context, -18, -98, 18, -53, palette.metal)
    for (let x = -13; x <= 13; x += 13) {
      context.beginPath(); context.roundRect(x - 5, -95, 10, 39, 3); context.fill(); strokeModel(context, 1.5)
      context.fillStyle = palette.accent; context.beginPath(); context.arc(x, -87, 1.7, 0, Math.PI * 2); context.fill()
      context.fillStyle = metalGradient(context, -18, -98, 18, -53, palette.metal)
    }
    context.fillStyle = palette.accent; context.beginPath(); context.arc(0, -71, 7, 0, Math.PI * 2); context.fill(); strokeModel(context, 2)
  } else if (hero === 'astral-lancer') {
    for (let row = 0; row < 3; row += 1) {
      for (let column = -1; column <= 1; column += 1) {
        context.fillStyle = row % 2 ? palette.mid : shade(palette.light, -.08)
        context.beginPath(); context.roundRect(column * 11 - 5, -92 + row * 13, 11, 12, 3); context.fill(); strokeModel(context, 1.5)
      }
    }
    context.strokeStyle = palette.accent; context.lineWidth = 2.5
    context.beginPath(); context.moveTo(-16, -98); context.lineTo(16, -55); context.stroke()
  } else {
    context.fillStyle = shade(palette.light, -.05)
    context.beginPath(); context.moveTo(-17, -98); context.quadraticCurveTo(-3, -84, 17, -83); context.lineTo(14, -68); context.quadraticCurveTo(-3, -71, -16, -83); context.closePath(); context.fill(); strokeModel(context, 2)
    context.strokeStyle = palette.accent; context.lineWidth = 2
    context.beginPath(); context.moveTo(-12, -76); context.quadraticCurveTo(0, -67, 13, -74); context.stroke()
  }

  const belt = context.createLinearGradient(-25, -50, 25, -44)
  belt.addColorStop(0, '#3b261c'); belt.addColorStop(.5, '#76533a'); belt.addColorStop(1, '#2a1b16')
  context.fillStyle = belt; context.beginPath(); context.roundRect(-25, -52, 51, 9, 3); context.fill(); strokeModel(context, 2)
  context.fillStyle = metalGradient(context, -5, -51, 5, -44, palette.accent)
  context.beginPath(); context.roundRect(-6, -53, 12, 11, 3); context.fill(); strokeModel(context, 1.5)
  context.strokeStyle = shade(palette.light, .1); context.lineWidth = 1.5; context.globalAlpha *= .5
  context.beginPath(); context.moveTo(-22, -61); context.quadraticCurveTo(-14, -70, -16, -92); context.moveTo(21, -61); context.quadraticCurveTo(13, -73, 16, -92); context.stroke()
  context.globalAlpha /= .5
}

function drawArmsAndWeapon(context: CanvasRenderingContext2D, palette: Palette, hero: RiverOathHeroId, action: string, tick: number) {
  let swing = 0
  if (action === 'light') swing = Math.min(1, tick / 8) * 1.7 - .6
  if (action === 'heavy') swing = Math.min(1, tick / 18) * 2.2 - 1
  if (action === 'launcher') swing = Math.min(1, tick / 15) * 1.8 - .8
  if (action === 'skill') swing = tick * .3
  drawJointedLimb(context, [-18, -94], [-31, -79], [-34, -60], 10, palette.mid, palette.light)
  context.fillStyle = palette.metal; context.beginPath(); context.ellipse(-23, -98, 16, 11, -.24, 0, Math.PI * 2); context.fill(); strokeModel(context, 2.5)

  context.save(); context.translate(0, -90); context.rotate(swing)
  drawJointedLimb(context, [16, -3], [34, 9], [47, 1], 11, palette.mid, palette.light)
  context.fillStyle = '#4a2e22'; context.beginPath(); context.roundRect(41, -5, 17, 12, 5); context.fill(); strokeModel(context, 2)
  if (hero === 'astral-lancer') {
    context.strokeStyle = MODEL_OUTLINE; context.lineWidth = 9; context.beginPath(); context.moveTo(47, 1); context.lineTo(126, -50); context.stroke()
    context.strokeStyle = '#6e472d'; context.lineWidth = 5; context.stroke()
    context.strokeStyle = '#d7ae73'; context.lineWidth = 1.4; context.beginPath(); context.moveTo(51, -1); context.lineTo(122, -47); context.stroke()
    context.fillStyle = metalGradient(context, 108, -54, 142, -66, palette.metal)
    context.beginPath(); context.moveTo(119, -54); context.lineTo(146, -68); context.lineTo(133, -43); context.lineTo(124, -45); context.closePath(); context.fill(); strokeModel(context, 2.5)
    context.strokeStyle = palette.accent; context.lineWidth = 5; context.beginPath(); context.moveTo(116, -43); context.bezierCurveTo(108, -27, 104, -22, 96, -13); context.stroke()
    context.strokeStyle = '#cc5b43'; context.lineWidth = 3; context.beginPath(); context.moveTo(117, -43); context.bezierCurveTo(125, -27, 121, -19, 126, -9); context.stroke()
  } else if (hero === 'willow-duelist') {
    context.fillStyle = metalGradient(context, 52, 6, 112, -27, palette.metal)
    context.beginPath(); context.moveTo(50, -1); context.quadraticCurveTo(82, -12, 108, -34); context.quadraticCurveTo(91, -6, 55, 10); context.closePath(); context.fill(); strokeModel(context, 2.6)
    context.strokeStyle = '#fffbe3'; context.lineWidth = 1.5; context.beginPath(); context.moveTo(58, 3); context.quadraticCurveTo(84, -7, 102, -27); context.stroke()
    context.fillStyle = palette.accent; context.beginPath(); context.ellipse(51, 2, 12, 5, -.35, 0, Math.PI * 2); context.fill(); strokeModel(context, 2)
  } else {
    context.fillStyle = metalGradient(context, 52, 7, 106, -24, palette.metal)
    context.beginPath(); context.moveTo(51, -2); context.lineTo(100, -31); context.lineTo(108, -23); context.lineTo(69, 11); context.lineTo(54, 10); context.closePath(); context.fill(); strokeModel(context, 3)
    context.strokeStyle = '#fff4cf'; context.lineWidth = 1.6; context.beginPath(); context.moveTo(60, 4); context.lineTo(101, -25); context.stroke()
    context.fillStyle = palette.accent; context.beginPath(); context.roundRect(46, -5, 19, 8, 3); context.fill(); strokeModel(context, 2)
  }
  context.restore()
  context.fillStyle = palette.metal; context.beginPath(); context.ellipse(22, -98, 17, 11, .24, 0, Math.PI * 2); context.fill(); strokeModel(context, 2.5)
}

function drawHeroHead(context: CanvasRenderingContext2D, palette: Palette, hero: RiverOathHeroId, highDetail: boolean) {
  context.fillStyle = shade(palette.skin, -.22); context.beginPath(); context.roundRect(-8, -115, 16, 16, 5); context.fill(); strokeModel(context, 2)
  const face = context.createRadialGradient(7, -134, 2, 0, -129, 27)
  face.addColorStop(0, shade(palette.skin, .24)); face.addColorStop(.48, palette.skin); face.addColorStop(1, shade(palette.skin, -.25))
  context.fillStyle = face
  context.beginPath(); context.moveTo(-15, -139); context.quadraticCurveTo(-14, -153, 1, -155); context.quadraticCurveTo(18, -151, 18, -132); context.quadraticCurveTo(16, -113, 1, -108); context.quadraticCurveTo(-14, -115, -16, -130); context.closePath(); context.fill(); strokeModel(context, 2.8)
  context.fillStyle = shade(palette.skin, -.08); context.beginPath(); context.ellipse(-15, -132, 5, 7, 0, 0, Math.PI * 2); context.fill(); strokeModel(context, 1.5)
  context.fillStyle = palette.dark
  context.beginPath(); context.moveTo(-17, -139); context.quadraticCurveTo(-12, -160, 2, -160); context.quadraticCurveTo(18, -158, 19, -140); context.lineTo(12, -145); context.quadraticCurveTo(2, -140, -4, -150); context.quadraticCurveTo(-8, -139, -17, -132); context.closePath(); context.fill(); strokeModel(context, 2.4)
  if (hero === 'willow-duelist') {
    context.fillStyle = shade(palette.dark, -.1); context.beginPath(); context.arc(-5, -157, 9, 0, Math.PI * 2); context.fill(); strokeModel(context, 2)
    for (let strand = 0; strand < 3; strand += 1) {
      context.strokeStyle = strand === 1 ? palette.mid : palette.dark; context.lineWidth = 5 - strand
      context.beginPath(); context.moveTo(-10, -157 + strand * 2); context.bezierCurveTo(-31, -167 + strand * 3, -42, -147, -50 - strand * 4, -125 + strand * 5); context.stroke()
    }
    context.fillStyle = palette.accent; context.beginPath(); context.ellipse(-7, -157, 10, 3, 0, 0, Math.PI * 2); context.fill()
  } else if (hero === 'astral-lancer') {
    context.fillStyle = shade(palette.dark, -.08); context.beginPath(); context.ellipse(-2, -163, 9, 7, 0, 0, Math.PI * 2); context.fill(); strokeModel(context, 2)
    context.fillStyle = metalGradient(context, -8, -166, 8, -148, palette.accent)
    context.beginPath(); context.moveTo(-8, -157); context.lineTo(0, -177); context.lineTo(8, -157); context.closePath(); context.fill(); strokeModel(context, 2)
    context.strokeStyle = '#b9483d'; context.lineWidth = 4; context.beginPath(); context.moveTo(0, -174); context.quadraticCurveTo(-10, -186, -5, -196); context.stroke()
  } else {
    context.fillStyle = shade(palette.dark, -.12)
    context.beginPath(); context.moveTo(-17, -158); context.lineTo(15, -158); context.lineTo(21, -147); context.lineTo(-21, -147); context.closePath(); context.fill(); strokeModel(context, 2.5)
    context.fillStyle = palette.accent; context.beginPath(); context.roundRect(-6, -165, 12, 13, 3); context.fill(); strokeModel(context, 1.8)
    context.strokeStyle = shade(palette.dark, -.2); context.lineWidth = 2
    context.beginPath(); context.moveTo(4, -112); context.quadraticCurveTo(6, -103, 1, -99); context.moveTo(4, -112); context.quadraticCurveTo(12, -106, 10, -101); context.stroke()
  }
  if (highDetail) {
    context.strokeStyle = '#2a1b18'; context.lineWidth = 2.2; context.lineCap = 'round'
    context.beginPath(); context.moveTo(3, -137); context.lineTo(12, -139); context.moveTo(5, -133); context.lineTo(11, -133); context.stroke()
    context.beginPath(); context.moveTo(15, -129); context.lineTo(20, -126); context.lineTo(15, -124); context.stroke()
    context.strokeStyle = shade(palette.skin, -.35); context.lineWidth = 1.6
    context.beginPath(); context.moveTo(5, -116); context.quadraticCurveTo(12, -113, 15, -117); context.stroke()
    context.fillStyle = 'rgba(255,235,202,.36)'; context.beginPath(); context.ellipse(8, -145, 5, 7, -.3, 0, Math.PI * 2); context.fill()
  } else {
    context.strokeStyle = '#291a17'; context.lineWidth = 2.6
    context.beginPath(); context.moveTo(4, -135); context.lineTo(12, -136); context.stroke()
  }
}

function drawAttackArc(context: CanvasRenderingContext2D, hero: RiverOathHeroId, action: string, tick: number) {
  const active = action === 'light' ? tick >= 4 && tick <= 11 : action === 'heavy' ? tick >= 12 && tick <= 23 : action === 'launcher' ? tick >= 10 && tick <= 20 : action === 'skill'
  if (!active) return
  context.save(); context.globalCompositeOperation = 'screen'
  const alpha = action === 'skill' ? .72 : .48
  context.strokeStyle = hero === 'willow-duelist' ? `rgba(113,255,207,${alpha})` : hero === 'iron-tactician' ? `rgba(255,157,91,${alpha})` : `rgba(132,213,255,${alpha})`
  context.lineWidth = action === 'skill' ? 13 : 7
  context.beginPath()
  const phase = action === 'skill' ? tick * .24 : tick * .1
  context.arc(18, -76, action === 'skill' ? 96 : 72, -1.2 + phase, .6 + phase)
  context.stroke()
  context.lineWidth = 2; context.strokeStyle = 'rgba(255,255,255,.85)'; context.stroke()
  context.restore()
}

function drawHeroAura(context: CanvasRenderingContext2D, hero: RiverOathHeroId, tick: number) {
  const hue = hero === 'willow-duelist' ? '92,255,196' : hero === 'iron-tactician' ? '255,113,67' : '85,190,255'
  const radius = 62 + Math.sin(tick * .4) * 12
  const gradient = context.createRadialGradient(0, -72, 8, 0, -72, radius)
  gradient.addColorStop(0, `rgba(${hue},.3)`); gradient.addColorStop(1, `rgba(${hue},0)`)
  context.fillStyle = gradient; context.beginPath(); context.arc(0, -72, radius, 0, Math.PI * 2); context.fill()
}

function drawEnemyBackGear(context: CanvasRenderingContext2D, palette: Palette, enemy: RiverOathEnemyState, highDetail: boolean) {
  const kind = enemy.kind
  context.save()
  if (kind === 'hill-archer') {
    context.fillStyle = '#493426'; context.beginPath(); context.roundRect(-34, -112, 16, 68, 7); context.fill(); strokeModel(context, 2.5)
    context.strokeStyle = palette.metal; context.lineWidth = 2
    const arrows = highDetail ? 5 : 3
    for (let index = 0; index < arrows; index += 1) {
      const x = -31 + index * 3
      context.beginPath(); context.moveTo(x, -108); context.lineTo(x - 5, -151 - index * 2); context.stroke()
      context.fillStyle = palette.accent; context.beginPath(); context.moveTo(x - 5, -151 - index * 2); context.lineTo(x - 10, -143 - index * 2); context.lineTo(x, -145 - index * 2); context.closePath(); context.fill()
    }
  } else if (kind === 'rope-hooker') {
    context.strokeStyle = '#8b693e'; context.lineWidth = 7
    for (let ring = 0; ring < 3; ring += 1) { context.beginPath(); context.ellipse(-22, -80 + ring * 7, 21, 14, -.25, 0, Math.PI * 2); context.stroke() }
    context.strokeStyle = '#d0aa6a'; context.lineWidth = 1.5; context.beginPath(); context.ellipse(-22, -73, 21, 14, -.25, 0, Math.PI * 2); context.stroke()
  } else if (kind === 'ember-alchemist') {
    context.fillStyle = '#473021'; context.beginPath(); context.roundRect(-35, -101, 24, 55, 8); context.fill(); strokeModel(context, 3)
    for (let index = 0; index < 3; index += 1) {
      context.fillStyle = index === 1 ? '#a84a28' : '#677b52'; context.beginPath(); context.ellipse(-38 - index * 3, -86 + index * 18, 9, 12, .2, 0, Math.PI * 2); context.fill(); strokeModel(context, 2)
    }
  } else if (kind === 'banner-caller') {
    context.strokeStyle = MODEL_OUTLINE; context.lineWidth = 9; context.beginPath(); context.moveTo(-18, -42); context.lineTo(-14, -205); context.stroke()
    context.strokeStyle = '#745033'; context.lineWidth = 5; context.stroke()
    const cloth = context.createLinearGradient(-16, -194, -92, -126)
    cloth.addColorStop(0, palette.light); cloth.addColorStop(.6, palette.mid); cloth.addColorStop(1, palette.dark)
    context.fillStyle = cloth; context.beginPath(); context.moveTo(-14, -194); context.quadraticCurveTo(-68, -181, -91, -157); context.lineTo(-76, -129); context.quadraticCurveTo(-51, -147, -13, -144); context.closePath(); context.fill(); strokeModel(context, 3)
    context.strokeStyle = palette.accent; context.lineWidth = 2; context.beginPath(); context.moveTo(-24, -181); context.lineTo(-68, -148); context.stroke()
  } else if (kind === 'reedwater-warden') {
    context.fillStyle = shade(palette.mid, -.28)
    for (const side of [-1, 1]) {
      context.save(); context.scale(side, 1)
      context.beginPath(); context.moveTo(18, -110); context.quadraticCurveTo(56, -135, 76, -108); context.lineTo(48, -84); context.lineTo(19, -93); context.closePath(); context.fill(); strokeModel(context, 3)
      context.strokeStyle = palette.accent; context.lineWidth = 2; context.beginPath(); context.moveTo(28, -105); context.lineTo(62, -110); context.stroke(); context.restore()
    }
  } else if (kind === 'cinder-overseer') {
    context.strokeStyle = shade(palette.metal, -.35); context.lineWidth = 11; context.lineCap = 'round'
    context.beginPath(); context.moveTo(-23, -100); context.lineTo(-39, -139); context.lineTo(-54, -145); context.stroke()
    context.beginPath(); context.moveTo(22, -101); context.lineTo(37, -132); context.stroke()
    context.fillStyle = '#b64727'; context.beginPath(); context.arc(-53, -147, 8, 0, Math.PI * 2); context.fill(); strokeModel(context, 2)
  } else if (kind === 'harbor-master') {
    context.strokeStyle = '#8d6d49'; context.lineWidth = 8
    for (let ring = 0; ring < 3; ring += 1) { context.beginPath(); context.ellipse(-28, -83 + ring * 8, 26, 17, -.2, 0, Math.PI * 2); context.stroke() }
    context.strokeStyle = palette.metal; context.lineWidth = 3
    for (let index = 0; index < 5; index += 1) { context.beginPath(); context.ellipse(34 + index * 3, -108 + index * 12, 6, 9, .2, 0, Math.PI * 2); context.stroke() }
  } else if (kind === 'cloudbreak-oath') {
    for (const side of [-1, 1]) {
      context.save(); context.scale(side, 1)
      context.fillStyle = shade(palette.dark, -.2); context.beginPath(); context.moveTo(14, -110); context.lineTo(64, -145); context.lineTo(45, -94); context.lineTo(76, -66); context.lineTo(18, -81); context.closePath(); context.fill(); strokeModel(context, 3)
      context.strokeStyle = palette.accent; context.lineWidth = 2; context.beginPath(); context.moveTo(26, -104); context.lineTo(55, -126); context.moveTo(31, -87); context.lineTo(62, -72); context.stroke(); context.restore()
    }
  }
  context.restore()
}

function drawEnemyLegs(context: CanvasRenderingContext2D, palette: Palette, enemy: RiverOathEnemyState) {
  const stride = enemy.action === 'approach' ? Math.sin(enemy.actionTick * .58) * 9 : 0
  const heavy = enemy.boss || enemy.kind === 'iron-breaker' || enemy.kind === 'lacquer-guard'
  const width = heavy ? 14 : 10
  drawJointedLimb(context, [-10, -48], [-13 - stride * .15, -27], [-11 + stride, -7], width, shade(palette.dark, -.06), palette.mid)
  drawJointedLimb(context, [10, -48], [13 + stride * .15, -27], [11 - stride, -7], width + 1, palette.dark, palette.light)
  for (const x of [-11 + stride, 11 - stride]) {
    context.fillStyle = heavy ? metalGradient(context, x - 9, -27, x + 8, -5, palette.metal) : shade(palette.dark, -.25)
    context.beginPath(); context.roundRect(x - 8, -28, 16, 23, 4); context.fill(); strokeModel(context, 2)
    context.fillStyle = shade(palette.dark, -.34); context.beginPath(); context.roundRect(x - 11, -9, 22, 7, 3); context.fill(); strokeModel(context, 2)
  }
}

function drawEnemySkirt(context: CanvasRenderingContext2D, palette: Palette, enemy: RiverOathEnemyState) {
  const wide = enemy.boss || enemy.kind === 'iron-breaker'
  const half = wide ? 34 : enemy.kind === 'banner-caller' ? 28 : 24
  context.fillStyle = materialGradient(context, -69, -27, { dark: shade(palette.dark, -.18), mid: palette.dark, light: palette.mid })
  context.beginPath(); context.moveTo(-half + 3, -68); context.quadraticCurveTo(0, -74, half - 3, -68); context.lineTo(half + 5, -25); context.lineTo(0, -36); context.lineTo(-half - 5, -25); context.closePath(); context.fill(); strokeModel(context, 3)
  const plates = wide ? 6 : 4
  for (let index = 0; index < plates; index += 1) {
    const x = -half + 6 + index * ((half * 2 - 12) / Math.max(1, plates - 1))
    context.strokeStyle = index % 2 ? shade(palette.mid, -.22) : palette.accent; context.lineWidth = index % 2 ? 2.5 : 1.5
    context.beginPath(); context.moveTo(x, -64); context.lineTo(x * 1.18, -32); context.stroke()
  }
  if (enemy.boss) {
    context.fillStyle = shade(palette.mid, -.16)
    context.beginPath(); context.moveTo(-30, -65); context.lineTo(-58, -22); context.lineTo(-38, -29); context.lineTo(-18, -62); context.fill(); strokeModel(context, 2.5)
    context.strokeStyle = palette.accent; context.lineWidth = 2; context.beginPath(); context.moveTo(-30, -59); context.lineTo(-48, -29); context.stroke()
  }
}

function drawEnemyRearArm(context: CanvasRenderingContext2D, palette: Palette, enemy: RiverOathEnemyState) {
  const width = enemy.boss || enemy.kind === 'iron-breaker' ? 13 : 9
  drawJointedLimb(context, [-18, -96], [-31, -83], [-35, -61], width, shade(palette.mid, -.2), palette.mid)
  context.fillStyle = shade(palette.metal, -.2); context.beginPath(); context.ellipse(-23, -99, width + 4, 10, -.25, 0, Math.PI * 2); context.fill(); strokeModel(context, 2.5)
}

function drawEnemyTorso(context: CanvasRenderingContext2D, palette: Palette, enemy: RiverOathEnemyState) {
  const width = enemy.boss ? 58 : enemy.kind === 'iron-breaker' ? 54 : enemy.kind === 'lacquer-guard' ? 48 : 42
  context.fillStyle = materialGradient(context, -113, -49, palette)
  context.beginPath(); context.moveTo(-width / 2 + 5, -108); context.quadraticCurveTo(0, -119, width / 2 - 4, -108); context.lineTo(width / 2 + 4, -54); context.quadraticCurveTo(0, -43, -width / 2 - 4, -54); context.closePath(); context.fill(); strokeModel(context, enemy.boss ? 4 : 3)
  context.fillStyle = shade(palette.dark, -.24)
  context.beginPath(); context.moveTo(-width / 2 + 3, -105); context.lineTo(-width / 2 + 10, -54); context.lineTo(-width / 2 - 4, -57); context.closePath(); context.fill()

  const shoulderWidth = enemy.boss ? 24 : enemy.kind === 'iron-breaker' ? 21 : 15
  context.fillStyle = metalGradient(context, -width / 2 - 8, -112, width / 2 + 9, -88, palette.metal)
  context.beginPath(); context.ellipse(-width / 2, -101, shoulderWidth, 11, -.2, 0, Math.PI * 2); context.fill(); strokeModel(context, 2.5)
  context.beginPath(); context.ellipse(width / 2, -101, shoulderWidth, 11, .2, 0, Math.PI * 2); context.fill(); strokeModel(context, 2.5)

  if (enemy.kind === 'river-raider') {
    context.fillStyle = shade(palette.mid, -.16); context.beginPath(); context.moveTo(-18, -103); context.lineTo(20, -70); context.lineTo(15, -58); context.lineTo(-22, -91); context.closePath(); context.fill(); strokeModel(context, 2)
    context.fillStyle = palette.accent; context.beginPath(); context.roundRect(-3, -84, 8, 8, 2); context.fill()
  } else if (enemy.kind === 'lacquer-guard') {
    for (let row = 0; row < 3; row += 1) {
      for (let column = -1; column <= 1; column += 1) {
        context.fillStyle = row % 2 ? shade(palette.mid, -.12) : palette.light
        context.beginPath(); context.roundRect(column * 13 - 6, -94 + row * 13, 12, 12, 3); context.fill(); strokeModel(context, 1.7)
      }
    }
  } else if (enemy.kind === 'rope-hooker') {
    context.strokeStyle = '#b38a50'; context.lineWidth = 5
    context.beginPath(); context.ellipse(0, -78, 22, 12, .18, 0, Math.PI * 2); context.stroke()
    context.strokeStyle = '#e0ba74'; context.lineWidth = 1.4; context.stroke()
  } else if (enemy.kind === 'ember-alchemist') {
    context.fillStyle = '#36211c'; context.beginPath(); context.moveTo(-19, -102); context.lineTo(19, -102); context.lineTo(15, -56); context.lineTo(-15, -56); context.closePath(); context.fill(); strokeModel(context, 2.5)
    context.fillStyle = '#ff8737'; context.beginPath(); context.arc(0, -79, 9, 0, Math.PI * 2); context.fill(); strokeModel(context, 2)
    context.fillStyle = '#ffe3a1'; context.beginPath(); context.arc(-2, -82, 3, 0, Math.PI * 2); context.fill()
  } else if (enemy.kind === 'banner-caller') {
    context.fillStyle = shade(palette.mid, .05); context.beginPath(); context.moveTo(-19, -103); context.quadraticCurveTo(0, -85, 19, -103); context.lineTo(15, -55); context.lineTo(-15, -55); context.closePath(); context.fill(); strokeModel(context, 2)
    context.strokeStyle = palette.accent; context.lineWidth = 2.5; context.beginPath(); context.moveTo(-15, -93); context.quadraticCurveTo(0, -78, 15, -93); context.stroke()
  } else if (enemy.kind === 'iron-breaker') {
    context.fillStyle = metalGradient(context, -24, -103, 24, -52, palette.metal)
    for (let column = -2; column <= 2; column += 1) {
      context.beginPath(); context.roundRect(column * 11 - 5, -99, 10, 43, 3); context.fill(); strokeModel(context, 1.7)
    }
    context.fillStyle = palette.accent; context.beginPath(); context.roundRect(-18, -79, 36, 8, 3); context.fill(); strokeModel(context, 1.5)
  } else if (enemy.boss) {
    drawBossChest(context, palette, enemy)
  } else {
    context.strokeStyle = palette.metal; context.lineWidth = 3
    context.beginPath(); context.moveTo(-width / 2 + 6, -89); context.lineTo(width / 2 - 6, -89); context.moveTo(-width / 2 + 5, -72); context.lineTo(width / 2 - 5, -72); context.stroke()
  }

  context.fillStyle = '#40291f'; context.beginPath(); context.roundRect(-width / 2 - 3, -57, width + 6, 9, 3); context.fill(); strokeModel(context, 2)
  context.fillStyle = metalGradient(context, -6, -58, 6, -48, palette.accent); context.beginPath(); context.roundRect(-6, -59, 12, 11, 3); context.fill(); strokeModel(context, 1.5)
}

function drawBossChest(context: CanvasRenderingContext2D, palette: Palette, enemy: RiverOathEnemyState) {
  if (enemy.kind === 'reedwater-warden') {
    for (let row = 0; row < 3; row += 1) {
      context.strokeStyle = row === enemy.phase - 1 ? palette.accent : palette.metal; context.lineWidth = 4
      context.beginPath(); context.moveTo(-22, -94 + row * 13); context.quadraticCurveTo(0, -82 + row * 13, 22, -94 + row * 13); context.stroke()
    }
  } else if (enemy.kind === 'cinder-overseer') {
    context.fillStyle = '#2c1713'; context.beginPath(); context.roundRect(-24, -98, 48, 45, 8); context.fill(); strokeModel(context, 3)
    context.fillStyle = '#ff7f2f'; context.beginPath(); context.arc(0, -77, 12 + enemy.phase * 2, 0, Math.PI * 2); context.fill(); strokeModel(context, 2)
    context.fillStyle = '#ffe39b'; context.beginPath(); context.arc(-3, -81, 4, 0, Math.PI * 2); context.fill()
  } else if (enemy.kind === 'harbor-master') {
    context.strokeStyle = palette.accent; context.lineWidth = 6
    context.beginPath(); context.moveTo(-22, -99); context.lineTo(20, -54); context.stroke()
    for (let index = 0; index < 4; index += 1) { context.strokeStyle = palette.metal; context.lineWidth = 3; context.beginPath(); context.ellipse(-13 + index * 9, -86 + index * 8, 6, 8, -.7, 0, Math.PI * 2); context.stroke() }
  } else {
    context.strokeStyle = palette.accent; context.lineWidth = 3
    context.beginPath(); context.moveTo(-20, -98); context.lineTo(-5, -83); context.lineTo(-14, -72); context.lineTo(3, -61); context.lineTo(19, -80); context.stroke()
    context.fillStyle = '#f6d886'; context.beginPath(); context.arc(3, -61, 4 + enemy.phase, 0, Math.PI * 2); context.fill()
  }
}

function drawEnemyArms(context: CanvasRenderingContext2D, palette: Palette, enemy: RiverOathEnemyState) {
  const attacking = enemy.action === 'attack'
  const attackRule = DEFAULT_RIVER_OATH_RULES.enemies[enemy.kind]
  const activeProgress = Math.min(1, enemy.actionTick / Math.max(1, attackRule.attackActiveTick))
  const angle = attacking ? easeOutBack(activeProgress) * 1.72 - .72 : -.08
  context.save(); context.translate(18, -93); context.rotate(angle)
  const kind = enemy.kind
  const armWidth = enemy.boss || kind === 'iron-breaker' ? 14 : 10
  drawJointedLimb(context, [0, 0], [20, 15], [37, 9], armWidth, palette.mid, palette.light)
  context.fillStyle = '#3c281f'; context.beginPath(); context.roundRect(31, 3, 16, 12, 5); context.fill(); strokeModel(context, 2)
  if (kind === 'hill-archer') {
    context.strokeStyle = MODEL_OUTLINE; context.lineWidth = 8; context.beginPath(); context.arc(63, 4, 34, -1.35, 1.35); context.stroke()
    context.strokeStyle = '#9a7042'; context.lineWidth = 4; context.stroke()
    context.strokeStyle = '#d9cfad'; context.lineWidth = 1.5; context.beginPath(); context.moveTo(71, -29); context.lineTo(71, 37); context.stroke()
    if (attacking) { context.strokeStyle = palette.metal; context.lineWidth = 2; context.beginPath(); context.moveTo(38, 8); context.lineTo(112, 8); context.stroke(); context.fillStyle = palette.metal; context.beginPath(); context.moveTo(112, 8); context.lineTo(101, 2); context.lineTo(101, 14); context.closePath(); context.fill() }
  } else if (kind === 'ember-alchemist') {
    context.fillStyle = '#f18a3d'; context.beginPath(); context.arc(54, 7, 14, 0, Math.PI * 2); context.fill(); strokeModel(context, 3)
    context.fillStyle = '#ffe19a'; context.beginPath(); context.arc(50, 3, 5, 0, Math.PI * 2); context.fill()
    context.strokeStyle = '#7f3d27'; context.lineWidth = 3; context.beginPath(); context.moveTo(49, -7); context.lineTo(58, -12); context.stroke()
  } else if (kind === 'banner-caller') {
    context.strokeStyle = MODEL_OUTLINE; context.lineWidth = 9; context.beginPath(); context.moveTo(35, 11); context.lineTo(73, -77); context.stroke()
    context.strokeStyle = '#765337'; context.lineWidth = 5; context.stroke()
    context.fillStyle = metalGradient(context, 62, -69, 86, -90, palette.metal); context.beginPath(); context.moveTo(68, -77); context.lineTo(85, -92); context.lineTo(79, -68); context.closePath(); context.fill(); strokeModel(context, 2)
  } else if (kind === 'lacquer-guard') {
    const shield = context.createLinearGradient(28, -25, 75, 32)
    shield.addColorStop(0, shade(palette.light, .1)); shield.addColorStop(.35, palette.mid); shield.addColorStop(1, shade(palette.dark, -.3))
    context.fillStyle = shield; context.beginPath(); context.moveTo(40, -28); context.quadraticCurveTo(77, -21, 75, 8); context.quadraticCurveTo(67, 34, 42, 40); context.quadraticCurveTo(23, 11, 40, -28); context.fill(); strokeModel(context, 5)
    context.strokeStyle = palette.metal; context.lineWidth = 3; context.beginPath(); context.moveTo(45, -20); context.quadraticCurveTo(65, -13, 67, 7); context.quadraticCurveTo(61, 25, 46, 31); context.stroke()
    context.fillStyle = palette.accent; context.beginPath(); context.arc(52, 5, 8, 0, Math.PI * 2); context.fill(); strokeModel(context, 2)
  } else if (kind === 'river-raider') {
    context.fillStyle = metalGradient(context, 42, 9, 102, -24, palette.metal)
    context.beginPath(); context.moveTo(39, 6); context.quadraticCurveTo(72, -2, 102, -28); context.quadraticCurveTo(83, 4, 47, 17); context.closePath(); context.fill(); strokeModel(context, 2.7)
    context.fillStyle = palette.accent; context.beginPath(); context.ellipse(43, 9, 11, 4, -.3, 0, Math.PI * 2); context.fill(); strokeModel(context, 1.8)
  } else if (kind === 'iron-breaker') {
    context.strokeStyle = MODEL_OUTLINE; context.lineWidth = 15; context.beginPath(); context.moveTo(38, 9); context.lineTo(92, -32); context.stroke()
    context.strokeStyle = '#6d5137'; context.lineWidth = 9; context.stroke()
    context.fillStyle = metalGradient(context, 80, -54, 126, -14, palette.metal)
    context.beginPath(); context.moveTo(80, -49); context.lineTo(116, -61); context.lineTo(132, -30); context.lineTo(96, -13); context.closePath(); context.fill(); strokeModel(context, 4)
    context.fillStyle = palette.accent; context.beginPath(); context.roundRect(96, -52, 9, 30, 3); context.fill()
  } else if (kind === 'reedwater-warden') {
    drawPolearm(context, palette, 41, 9, 126, -43, 'tide')
  } else if (kind === 'cinder-overseer') {
    context.strokeStyle = MODEL_OUTLINE; context.lineWidth = 15; context.beginPath(); context.moveTo(37, 10); context.lineTo(89, -30); context.stroke()
    context.strokeStyle = '#60402d'; context.lineWidth = 9; context.stroke()
    context.fillStyle = metalGradient(context, 75, -62, 133, -8, palette.metal)
    context.beginPath(); context.roundRect(81, -59, 46, 46, 8); context.fill(); strokeModel(context, 4)
    for (let vent = 0; vent < 3; vent += 1) { context.fillStyle = '#f0742f'; context.beginPath(); context.roundRect(91 + vent * 10, -48, 5, 24, 2); context.fill() }
  } else if (kind === 'harbor-master') {
    context.strokeStyle = palette.metal; context.lineWidth = 4
    for (let link = 0; link < 5; link += 1) { context.beginPath(); context.ellipse(44 + link * 12, 7 - link * 6, 8, 5, -.45, 0, Math.PI * 2); context.stroke() }
    context.fillStyle = metalGradient(context, 87, -48, 135, 5, palette.metal)
    context.beginPath(); context.moveTo(98, -23); context.lineTo(122, -42); context.lineTo(132, -32); context.lineTo(117, -16); context.lineTo(137, -3); context.quadraticCurveTo(111, 9, 101, -5); context.lineTo(92, 5); context.closePath(); context.fill(); strokeModel(context, 3)
  } else if (kind === 'cloudbreak-oath') {
    drawPolearm(context, palette, 40, 8, 130, -46, 'storm')
  } else {
    const length = kind === 'reed-spearman' || kind === 'rope-hooker' ? 105 : enemy.boss ? 91 : 64
    context.strokeStyle = MODEL_OUTLINE; context.lineWidth = 9
    context.beginPath(); context.moveTo(25, 19); context.lineTo(length, -18); context.stroke()
    context.strokeStyle = '#644930'; context.lineWidth = 5; context.stroke()
    context.fillStyle = metalGradient(context, length - 8, -32, length + 22, -10, palette.metal)
    if (kind === 'rope-hooker') {
      context.strokeStyle = palette.metal; context.lineWidth = 7; context.beginPath(); context.arc(length + 3, -20, 14, -.7, 1.8); context.stroke()
      context.strokeStyle = '#fff2cb'; context.lineWidth = 1.5; context.stroke()
    } else {
      context.beginPath(); context.moveTo(length - 4, -22); context.lineTo(length + 22, -30); context.lineTo(length + 5, -9); context.closePath(); context.fill(); strokeModel(context, 2.4)
    }
  }
  context.restore()
}

function drawPolearm(context: CanvasRenderingContext2D, palette: Palette, x1: number, y1: number, x2: number, y2: number, style: 'tide' | 'storm') {
  context.strokeStyle = MODEL_OUTLINE; context.lineWidth = 10; context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke()
  context.strokeStyle = '#68482f'; context.lineWidth = 6; context.stroke()
  context.fillStyle = metalGradient(context, x2 - 10, y2 - 18, x2 + 36, y2 + 16, palette.metal)
  if (style === 'tide') {
    context.beginPath(); context.moveTo(x2 - 4, y2 - 3); context.lineTo(x2 + 31, y2 - 22); context.lineTo(x2 + 19, y2 + 4); context.lineTo(x2 + 35, y2 + 15); context.lineTo(x2 + 5, y2 + 10); context.closePath(); context.fill(); strokeModel(context, 3)
    context.strokeStyle = '#83d8d4'; context.lineWidth = 3; context.beginPath(); context.moveTo(x2 - 2, y2 + 6); context.bezierCurveTo(x2 + 13, y2 + 25, x2 + 2, y2 + 38, x2 + 18, y2 + 49); context.stroke()
  } else {
    context.beginPath(); context.moveTo(x2 - 4, y2); context.lineTo(x2 + 18, y2 - 27); context.lineTo(x2 + 24, y2 - 5); context.lineTo(x2 + 46, y2 - 12); context.lineTo(x2 + 27, y2 + 12); context.lineTo(x2 + 11, y2 + 8); context.closePath(); context.fill(); strokeModel(context, 3)
    context.strokeStyle = '#f6d064'; context.lineWidth = 3; context.beginPath(); context.moveTo(x2 + 9, y2 - 5); context.lineTo(x2 + 21, y2 + 8); context.lineTo(x2 + 31, y2 - 7); context.stroke()
  }
}

function easeOutBack(value: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2)
}

function drawEnemyHead(context: CanvasRenderingContext2D, palette: Palette, enemy: RiverOathEnemyState, highDetail: boolean) {
  const boss = enemy.boss
  const headWidth = boss ? 19 : enemy.kind === 'iron-breaker' ? 18 : 15
  context.fillStyle = shade(palette.skin, -.2); context.beginPath(); context.roundRect(-7, -116, 15, 15, 5); context.fill(); strokeModel(context, 2)
  const face = context.createRadialGradient(7, -138, 2, 0, -131, 26)
  face.addColorStop(0, shade(palette.skin, .2)); face.addColorStop(.5, palette.skin); face.addColorStop(1, shade(palette.skin, -.28))
  context.fillStyle = face
  context.beginPath(); context.moveTo(-headWidth, -140); context.quadraticCurveTo(-headWidth + 2, -154, 0, -157); context.quadraticCurveTo(headWidth, -153, headWidth, -133); context.quadraticCurveTo(headWidth - 2, -115, 1, -110); context.quadraticCurveTo(-headWidth + 1, -116, -headWidth, -132); context.closePath(); context.fill(); strokeModel(context, 2.8)

  drawEnemyHeadgear(context, palette, enemy)

  if (enemy.kind === 'ember-alchemist') {
    context.fillStyle = shade(palette.dark, -.2); context.beginPath(); context.moveTo(-16, -133); context.lineTo(18, -136); context.lineTo(15, -117); context.lineTo(-13, -116); context.closePath(); context.fill(); strokeModel(context, 2)
    context.fillStyle = '#e17836'; context.beginPath(); context.arc(8, -135, 4, 0, Math.PI * 2); context.fill()
  } else if (enemy.kind === 'lacquer-guard' || enemy.kind === 'iron-breaker') {
    context.fillStyle = shade(palette.dark, -.28); context.beginPath(); context.roundRect(-headWidth + 2, -140, headWidth * 2 - 2, 20, 4); context.fill(); strokeModel(context, 2)
    context.strokeStyle = palette.accent; context.lineWidth = 2; context.beginPath(); context.moveTo(2, -132); context.lineTo(14, -132); context.stroke()
  } else if (highDetail) {
    context.strokeStyle = '#291816'; context.lineWidth = boss ? 2.8 : 2; context.lineCap = 'round'
    context.beginPath(); context.moveTo(2, -139); context.lineTo(12, -141); context.moveTo(5, -134); context.lineTo(12, -134); context.stroke()
    context.beginPath(); context.moveTo(15, -129); context.lineTo(20, -126); context.lineTo(15, -124); context.stroke()
    if (boss) {
      context.strokeStyle = shade(palette.dark, -.25); context.lineWidth = 2.4
      context.beginPath(); context.moveTo(3, -116); context.quadraticCurveTo(10, -108, 16, -116); context.moveTo(4, -114); context.quadraticCurveTo(7, -102, 1, -98); context.stroke()
    }
  } else {
    context.strokeStyle = '#291816'; context.lineWidth = 2.5; context.beginPath(); context.moveTo(4, -136); context.lineTo(12, -137); context.stroke()
  }
}

function drawEnemyHeadgear(context: CanvasRenderingContext2D, palette: Palette, enemy: RiverOathEnemyState) {
  const kind = enemy.kind
  if (kind === 'river-raider') {
    context.fillStyle = palette.dark; context.beginPath(); context.arc(0, -145, 18, Math.PI, Math.PI * 2); context.lineTo(17, -136); context.lineTo(-17, -136); context.closePath(); context.fill(); strokeModel(context, 2.5)
    context.fillStyle = palette.accent; context.beginPath(); context.roundRect(-19, -145, 38, 6, 2); context.fill(); strokeModel(context, 1.5)
    context.strokeStyle = palette.accent; context.lineWidth = 4; context.beginPath(); context.moveTo(-17, -141); context.quadraticCurveTo(-33, -137, -38, -119); context.stroke()
  } else if (kind === 'reed-spearman') {
    context.fillStyle = materialGradient(context, -173, -137, palette); context.beginPath(); context.moveTo(-25, -143); context.quadraticCurveTo(0, -179, 25, -143); context.lineTo(18, -136); context.lineTo(-18, -136); context.closePath(); context.fill(); strokeModel(context, 3)
    context.strokeStyle = palette.accent; context.lineWidth = 2; context.beginPath(); context.moveTo(-19, -144); context.lineTo(19, -144); context.stroke()
  } else if (kind === 'hill-archer') {
    context.fillStyle = shade(palette.dark, -.1); context.beginPath(); context.moveTo(-23, -139); context.quadraticCurveTo(-15, -168, 1, -173); context.quadraticCurveTo(19, -161, 22, -138); context.lineTo(14, -121); context.lineTo(-15, -121); context.closePath(); context.fill(); strokeModel(context, 3)
    context.strokeStyle = palette.accent; context.lineWidth = 2; context.beginPath(); context.moveTo(-16, -145); context.quadraticCurveTo(0, -153, 17, -144); context.stroke()
  } else if (kind === 'rope-hooker') {
    context.fillStyle = shade(palette.dark, -.12); context.beginPath(); context.arc(0, -145, 18, Math.PI, Math.PI * 2); context.lineTo(16, -134); context.lineTo(-17, -134); context.closePath(); context.fill(); strokeModel(context, 2.5)
    context.fillStyle = palette.accent; context.beginPath(); context.roundRect(-20, -147, 40, 7, 3); context.fill(); strokeModel(context, 1.5)
  } else if (kind === 'ember-alchemist') {
    context.fillStyle = shade(palette.dark, -.2); context.beginPath(); context.moveTo(-21, -143); context.quadraticCurveTo(0, -171, 22, -143); context.lineTo(16, -134); context.lineTo(-17, -134); context.closePath(); context.fill(); strokeModel(context, 2.5)
    context.fillStyle = palette.metal
    for (const x of [-7, 7]) { context.beginPath(); context.arc(x, -145, 6, 0, Math.PI * 2); context.fill(); strokeModel(context, 1.5); context.fillStyle = '#ffb44b'; context.beginPath(); context.arc(x + 1, -146, 2.5, 0, Math.PI * 2); context.fill(); context.fillStyle = palette.metal }
  } else if (kind === 'banner-caller') {
    context.fillStyle = shade(palette.dark, -.16); context.beginPath(); context.moveTo(-18, -151); context.lineTo(-10, -177); context.lineTo(11, -177); context.lineTo(19, -150); context.closePath(); context.fill(); strokeModel(context, 3)
    context.fillStyle = palette.accent; context.beginPath(); context.roundRect(-16, -157, 34, 7, 2); context.fill(); strokeModel(context, 1.5)
  } else if (kind === 'lacquer-guard' || kind === 'iron-breaker') {
    const crown = kind === 'iron-breaker' ? 29 : 23
    context.fillStyle = metalGradient(context, -crown, -174, crown, -136, palette.metal); context.beginPath(); context.moveTo(-crown, -143); context.lineTo(-18, -163); context.lineTo(-7, -158); context.lineTo(0, -179); context.lineTo(8, -158); context.lineTo(18, -164); context.lineTo(crown, -143); context.lineTo(18, -134); context.lineTo(-18, -134); context.closePath(); context.fill(); strokeModel(context, 3)
  } else if (enemy.boss) {
    drawBossCrest(context, palette, enemy)
  } else {
    context.fillStyle = palette.dark; context.beginPath(); context.arc(0, -145, 18, Math.PI, Math.PI * 2); context.lineTo(16, -134); context.lineTo(-17, -134); context.closePath(); context.fill(); strokeModel(context, 2.5)
  }
}

function drawBossCrest(context: CanvasRenderingContext2D, palette: Palette, enemy: RiverOathEnemyState) {
  context.fillStyle = metalGradient(context, -30, -183, 31, -136, palette.metal)
  if (enemy.kind === 'reedwater-warden') {
    context.beginPath(); context.moveTo(-29, -142); context.lineTo(-19, -167); context.lineTo(-8, -158); context.lineTo(0, -185); context.lineTo(8, -158); context.lineTo(20, -169); context.lineTo(29, -142); context.lineTo(18, -134); context.lineTo(-18, -134); context.closePath(); context.fill(); strokeModel(context, 3)
    context.strokeStyle = '#84c6b5'; context.lineWidth = 3; for (const x of [-12, 0, 12]) { context.beginPath(); context.moveTo(x, -166); context.quadraticCurveTo(x - 8, -184, x - 4, -199); context.stroke() }
  } else if (enemy.kind === 'cinder-overseer') {
    context.beginPath(); context.roundRect(-24, -166, 48, 31, 8); context.fill(); strokeModel(context, 4)
    context.fillStyle = '#241211'; for (let slot = -1; slot <= 1; slot += 1) { context.beginPath(); context.roundRect(slot * 12 - 3, -158, 6, 18, 2); context.fill() }
    context.fillStyle = '#f67d2d'; context.beginPath(); context.moveTo(-9, -166); context.quadraticCurveTo(0, -192, 9, -166); context.closePath(); context.fill(); strokeModel(context, 2)
  } else if (enemy.kind === 'harbor-master') {
    context.fillStyle = shade(palette.dark, -.12); context.beginPath(); context.moveTo(-31, -143); context.quadraticCurveTo(-20, -174, 0, -176); context.quadraticCurveTo(21, -173, 31, -143); context.lineTo(22, -133); context.lineTo(-23, -133); context.closePath(); context.fill(); strokeModel(context, 3)
    context.fillStyle = palette.accent; context.beginPath(); context.roundRect(-31, -149, 62, 7, 3); context.fill(); strokeModel(context, 1.5)
  } else {
    context.beginPath(); context.moveTo(-28, -143); context.lineTo(-18, -167); context.lineTo(-6, -158); context.lineTo(0, -190); context.lineTo(7, -158); context.lineTo(19, -170); context.lineTo(29, -143); context.lineTo(18, -133); context.lineTo(-18, -133); context.closePath(); context.fill(); strokeModel(context, 3)
    context.strokeStyle = palette.accent; context.lineWidth = 3; context.beginPath(); context.moveTo(-15, -156); context.lineTo(-2, -146); context.lineTo(13, -159); context.stroke()
  }
}

function drawBossAura(context: CanvasRenderingContext2D, enemy: RiverOathEnemyState, tick: number) {
  const radius = 72 + enemy.phase * 9 + Math.sin(tick * .15) * 5
  const gradient = context.createRadialGradient(0, -74, 20, 0, -74, radius)
  gradient.addColorStop(0, `rgba(235,85,49,${.1 + enemy.phase * .04})`)
  gradient.addColorStop(1, 'rgba(235,85,49,0)')
  context.fillStyle = gradient; context.beginPath(); context.arc(0, -74, radius, 0, Math.PI * 2); context.fill()
}

function drawMiniHealth(context: CanvasRenderingContext2D, enemy: RiverOathEnemyState) {
  const width = 48
  context.fillStyle = 'rgba(5,8,8,.72)'; context.fillRect(-width / 2 - 1, -169, width + 2, 6)
  context.fillStyle = '#dc7354'; context.fillRect(-width / 2, -168, width * Math.max(0, enemy.health / enemy.maxHealth), 4)
}

function drawPickup(context: CanvasRenderingContext2D, pickup: RiverOathSnapshot['pickups'][number], snapshot: RiverOathSnapshot, highDetail: boolean) {
  const point = positionFor(pickup.x, pickup.lane, snapshot)
  const bounce = Math.sin((snapshot.tick + pickup.id * 7) * .12) * 5
  const color = pickup.kind === 'herbal-draught' ? '#83d697' : pickup.kind === 'focus-seal' ? '#74d6ec' : '#e5aa52'
  context.save(); context.translate(point.x, point.y - 22 + bounce); context.scale(point.scale, point.scale)
  drawShadow(context, 0, 26 - bounce, 20, 6, .36)
  context.shadowColor = color; context.shadowBlur = highDetail ? 8 : 0; context.fillStyle = color
  if (pickup.kind === 'war-drum') {
    context.beginPath(); context.roundRect(-17, -12, 34, 24, 7); context.fill(); context.strokeStyle = '#5d3729'; context.lineWidth = 4; context.stroke()
  } else {
    context.beginPath(); context.moveTo(0, -19); context.lineTo(16, 0); context.lineTo(0, 19); context.lineTo(-16, 0); context.closePath(); context.fill()
    context.fillStyle = '#efffe9'; context.fillRect(-2, -9, 4, 18); context.fillRect(-9, -2, 18, 4)
  }
  context.restore()
}

function drawEffect(context: CanvasRenderingContext2D, effect: RiverOathEffectState, snapshot: RiverOathSnapshot, reducedMotion: boolean, highDetail: boolean) {
  const point = positionFor(effect.x, effect.lane, snapshot)
  const progress = Math.min(1, effect.ageTicks / effect.durationTicks)
  context.save(); context.translate(point.x, point.y - 68); context.scale(point.scale, point.scale)
  if (effect.kind === 'slash') {
    context.globalCompositeOperation = 'screen'; context.globalAlpha = 1 - progress
    context.strokeStyle = '#f8efbd'; context.lineWidth = 10 * effect.intensity
    context.beginPath(); context.arc(0, 0, 55 + progress * 55, -1.8, .5); context.stroke()
  } else if (effect.kind === 'impact' || effect.kind === 'defeat') {
    const count = reducedMotion ? 4 : highDetail ? 10 : 6
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2 + effect.id
      const distance = progress * (effect.kind === 'defeat' ? 88 : 52) * effect.intensity
      context.fillStyle = effect.kind === 'defeat' ? `rgba(245,126,67,${1 - progress})` : `rgba(255,232,166,${1 - progress})`
      context.beginPath(); context.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, 5 * (1 - progress), 0, Math.PI * 2); context.fill()
    }
  } else if (effect.kind === 'dust') {
    context.fillStyle = `rgba(190,177,146,${.22 * (1 - progress)})`
    context.beginPath(); context.ellipse(0, 62, 25 + progress * 34, 8 + progress * 8, 0, 0, Math.PI * 2); context.fill()
  } else if (effect.kind === 'focus') {
    context.globalCompositeOperation = 'screen'; context.strokeStyle = `rgba(93,220,255,${.7 * (1 - progress)})`; context.lineWidth = 6
    context.beginPath(); context.arc(0, 0, 30 + progress * 110, 0, Math.PI * 2); context.stroke()
  } else if (effect.kind === 'boss-aura') {
    context.strokeStyle = `rgba(255,91,50,${.4 * (1 - progress)})`; context.lineWidth = 4
    context.beginPath(); context.arc(0, 0, 55 + progress * 80, 0, Math.PI * 2); context.stroke()
  }
  context.restore()
}

function drawForegroundAtmosphere(context: CanvasRenderingContext2D, snapshot: RiverOathSnapshot) {
  const stage = getRiverOathStage(snapshot)
  const gradient = context.createLinearGradient(0, 570, 0, 720)
  gradient.addColorStop(0, 'rgba(2,6,8,0)'); gradient.addColorStop(1, 'rgba(2,6,8,.48)')
  context.fillStyle = gradient; context.fillRect(0, 560, 1280, 160)
  context.fillStyle = stage.scene.palette[3]
  context.globalAlpha = .06
  for (let index = 0; index < 8; index += 1) {
    const x = (index * 197 + snapshot.tick * .06) % 1380 - 50
    context.beginPath(); context.ellipse(x, 680 - (index % 3) * 18, 86, 9, 0, 0, Math.PI * 2); context.fill()
  }
  context.globalAlpha = 1
}

function playEventSounds(events: readonly RiverOathEvent[], enabled: boolean, audioRef: React.MutableRefObject<AudioContext | null>) {
  if (!enabled) return
  const audio = audioRef.current
  if (!audio) return
  let played = 0
  for (const event of events) {
    if (played >= 4) break
    if (event.type === 'player-action' && ['light', 'heavy', 'launcher'].includes(event.action)) {
      playTone(audio, event.action === 'heavy' ? 128 : event.action === 'launcher' ? 310 : 220, .055, 'sawtooth', .025); played += 1
    } else if (event.type === 'player-action' && event.action === 'skill') {
      playTone(audio, 520, .22, 'triangle', .04, 880); played += 1
    } else if (event.type === 'enemy-hit') {
      playTone(audio, 86, .045, 'square', .025); played += 1
    } else if (event.type === 'player-hit') {
      playTone(audio, 64, .09, 'sawtooth', .03); played += 1
    } else if (event.type === 'boss-phase') {
      playTone(audio, 92, .3, 'triangle', .04, 184); played += 1
    }
  }
}

function playTone(audio: AudioContext, frequency: number, duration: number, type: OscillatorType, volume: number, endFrequency?: number) {
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  const now = audio.currentTime
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, now)
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + .008)
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration)
  oscillator.connect(gain).connect(audio.destination)
  oscillator.start(now); oscillator.stop(now + duration + .01)
}

function heroName(id: RiverOathHeroId) { return HEROES.find((hero) => hero.id === id)?.name ?? 'JIYAN' }
function heroGlyph(id: RiverOathHeroId) { return HEROES.find((hero) => hero.id === id)?.glyph ?? '星' }
function heroTitle(id: RiverOathHeroId, locale: Locale) { return HEROES.find((hero) => hero.id === id)?.title[locale] ?? 'Astral Lancer' }
function enemyName(kind: RiverOathEnemyKind) {
  const names: Record<RiverOathEnemyKind, string> = {
    'river-raider': 'RIVER RAIDER',
    'reed-spearman': 'REED SPEARMAN',
    'hill-archer': 'HILL ARCHER',
    'lacquer-guard': 'LACQUER GUARD',
    'rope-hooker': 'ROPE HOOKER',
    'ember-alchemist': 'EMBER ALCHEMIST',
    'banner-caller': 'BANNER CALLER',
    'iron-breaker': 'IRON BREAKER',
    'reedwater-warden': 'REEDWATER WARDEN',
    'cinder-overseer': 'CINDER OVERSEER',
    'harbor-master': 'HARBOR MASTER',
    'cloudbreak-oath': 'CLOUDBREAK OATH',
  }
  return names[kind]
}
function shortRevision(value: number) { return String(value).padStart(2, '0') }
function statusLabel(status: RiverOathSnapshot['status'], locale: Locale) {
  const zh = { ready: '等待出征', running: '战斗中', paused: '已暂停', 'stage-clear': '关卡完成', 'campaign-clear': '战役完成', 'game-over': '败阵' }
  const en = { ready: 'READY', running: 'LIVE', paused: 'PAUSED', 'stage-clear': 'STAGE CLEAR', 'campaign-clear': 'CAMPAIGN CLEAR', 'game-over': 'GAME OVER' }
  return (locale === 'zh' ? zh : en)[status]
}
