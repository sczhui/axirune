import {
  ArrowLeft,
  CircleDot,
  Gamepad2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import type { ClassicRuleContract } from '../../arcade/classic-rule-contract'
import type {
  ArcadeClassicGameId,
  ArcadeGameDefinition,
} from '../../arcade/classics/catalog'
import {
  CLASSIC_WORLD_HEIGHT,
  CLASSIC_WORLD_WIDTH,
  NEUTRAL_CLASSIC_INPUT,
  advanceClassicWorld,
  createClassicWorldState,
  pauseClassicWorld,
  restartClassicWorld,
  startClassicWorld,
  stepClassicWorld,
  type ClassicWorldInput,
  type ClassicWorldState,
  type ClassicWorldStatus,
} from '../../arcade/classics/micro-engine'
import { renderClassicWorld } from '../../arcade/classics/micro-renderer'
import type { RuntimeValue } from '../../language'
import type { Locale } from '../../content/site'
import './classic-world-game.css'

const MAX_DEVICE_PIXEL_RATIO = 3
const MAX_FRAME_SECONDS = 0.1
const MAX_CATCH_UP_STEPS = 12
const HUD_INTERVAL_MS = 100

type HeldControl = 'left' | 'right' | 'up' | 'down' | 'primary' | 'secondary'
type ProgressReason = 'ready' | 'start' | 'tick' | 'pause' | 'restart' | 'stage' | 'complete'

export interface ClassicWorldProgress {
  readonly gameId: ArcadeClassicGameId
  readonly status: ClassicWorldStatus
  readonly stage: number
  readonly score: number
  readonly lives: number
  readonly streak: number
  readonly progress: number
  readonly tick: number
  readonly message: string
  readonly reason: ProgressReason
}

export interface ClassicWorldGameProps {
  readonly game: ArcadeGameDefinition<ArcadeClassicGameId>
  readonly locale: Locale
  readonly contract: ClassicRuleContract
  readonly revision: number
  readonly evaluateRules: (
    input: Readonly<Record<string, RuntimeValue>>,
  ) => Promise<ClassicRuleContract>
  readonly onProgress?: (progress: ClassicWorldProgress) => void
  readonly onExit?: () => void
  readonly className?: string
}

interface HudSnapshot {
  readonly status: ClassicWorldStatus
  readonly stage: number
  readonly score: number
  readonly lives: number
  readonly streak: number
  readonly progress: number
  readonly tick: number
  readonly message: string
}

function hudFromState(state: ClassicWorldState): HudSnapshot {
  return {
    status: state.status,
    stage: state.stage,
    score: state.score,
    lives: state.lives,
    streak: state.streak,
    progress: state.progress,
    tick: state.tick,
    message: state.message,
  }
}

function progressFromState(
  state: ClassicWorldState,
  reason: ProgressReason,
): ClassicWorldProgress {
  return { gameId: state.gameId, ...hudFromState(state), reason }
}

export function ClassicWorldGame({
  game,
  locale,
  contract,
  revision,
  evaluateRules,
  onProgress,
  onExit,
  className = '',
}: ClassicWorldGameProps) {
  if (contract.game !== game.id) {
    throw new Error(`Classic World contract ${contract.game} cannot drive ${game.id}.`)
  }

  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(createClassicWorldState(game.id, contract))
  const contractRef = useRef(contract)
  const inputRef = useRef<ClassicWorldInput>({ ...NEUTRAL_CLASSIC_INPUT })
  const evaluateRulesRef = useRef(evaluateRules)
  const onProgressRef = useRef(onProgress)
  const mountedRef = useRef(false)
  const intersectingRef = useRef(true)
  const pageVisibleRef = useRef(true)
  const renderRequestedRef = useRef(true)
  const transitionKeyRef = useRef<string | null>(null)
  const evaluationGenerationRef = useRef(0)
  const lastPublishedStatusRef = useRef<ClassicWorldStatus>('ready')

  const [hud, setHud] = useState<HudSnapshot>(() => hudFromState(stateRef.current))
  const [started, setStarted] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [gated, setGated] = useState(false)

  contractRef.current = contract
  evaluateRulesRef.current = evaluateRules
  onProgressRef.current = onProgress

  const publish = useCallback((reason: ProgressReason) => {
    const state = stateRef.current
    setHud(hudFromState(state))
    onProgressRef.current?.(progressFromState(state, reason))
    lastPublishedStatusRef.current = state.status
  }, [])

  const focusGame = useCallback(() => {
    requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }))
  }, [])

  const begin = useCallback(() => {
    const current = stateRef.current
    stateRef.current = startClassicWorld(current)
    setStarted(true)
    setRuleError(null)
    renderRequestedRef.current = true
    publish('start')
    focusGame()
  }, [focusGame, publish])

  const togglePause = useCallback(() => {
    if (!started) {
      begin()
      return
    }
    stateRef.current = pauseClassicWorld(stateRef.current)
    inputRef.current = { ...NEUTRAL_CLASSIC_INPUT }
    renderRequestedRef.current = true
    publish('pause')
    if (stateRef.current.status === 'running') focusGame()
  }, [begin, focusGame, publish, started])

  const restart = useCallback((startImmediately = started) => {
    evaluationGenerationRef.current += 1
    transitionKeyRef.current = null
    setTransitioning(false)
    setRuleError(null)
    inputRef.current = { ...NEUTRAL_CLASSIC_INPUT }
    let next = restartClassicWorld(stateRef.current, contractRef.current)
    if (startImmediately) next = startClassicWorld(next)
    stateRef.current = next
    setStarted(startImmediately)
    renderRequestedRef.current = true
    publish('restart')
    if (startImmediately) focusGame()
  }, [focusGame, publish, started])

  const requestNextStage = useCallback(async (state: ClassicWorldState) => {
    const transitionKey = `${revision}:${state.stage}:${state.score}:${state.tick}`
    if (transitionKeyRef.current === transitionKey) return
    transitionKeyRef.current = transitionKey
    const generation = ++evaluationGenerationRef.current
    setTransitioning(true)
    setRuleError(null)

    try {
      const nextContract = await evaluateRulesRef.current({
        stage: state.stage + 1,
        score: state.score,
        streak: state.streak,
      })
      if (!mountedRef.current || generation !== evaluationGenerationRef.current) return
      if (nextContract.game !== game.id) {
        throw new Error(`Rules returned ${nextContract.game}; expected ${game.id}.`)
      }
      contractRef.current = nextContract
      stateRef.current = advanceClassicWorld(stateRef.current, nextContract)
      renderRequestedRef.current = true
      publish('stage')
    } catch (error) {
      if (!mountedRef.current || generation !== evaluationGenerationRef.current) return
      transitionKeyRef.current = null
      setRuleError(error instanceof Error ? error.message : String(error))
    } finally {
      if (mountedRef.current && generation === evaluationGenerationRef.current) {
        setTransitioning(false)
      }
    }
  }, [game.id, publish, revision])

  useEffect(() => {
    contractRef.current = contract
  }, [contract])

  useEffect(() => {
    evaluationGenerationRef.current += 1
    transitionKeyRef.current = null
    const next = createClassicWorldState(game.id, contract)
    stateRef.current = next
    inputRef.current = { ...NEUTRAL_CLASSIC_INPUT }
    lastPublishedStatusRef.current = next.status
    setHud(hudFromState(next))
    setStarted(false)
    setTransitioning(false)
    setRuleError(null)
    renderRequestedRef.current = true
    onProgressRef.current?.(progressFromState(next, 'ready'))
  // A stage evaluation updates the parent contract without replacing the live
  // world. A source rebuild increments revision (and the parent also keys this
  // component), which is the only time the session should be recreated.
  }, [game.id, revision])

  useEffect(() => {
    mountedRef.current = true
    pageVisibleRef.current = document.visibilityState !== 'hidden'
    let animationFrame = 0
    let previousTime = performance.now()
    let accumulator = 0
    let lastHudUpdate = 0

    const canvas = canvasRef.current
    const root = rootRef.current

    const markRender = () => {
      renderRequestedRef.current = true
    }
    const resizeObserver =
      typeof ResizeObserver === 'undefined' || !canvas
        ? null
        : new ResizeObserver(markRender)
    if (canvas && resizeObserver) resizeObserver.observe(canvas)

    const intersectionObserver =
      typeof IntersectionObserver === 'undefined' || !root
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              intersectingRef.current = entry?.isIntersecting ?? true
              const nextGated = !intersectingRef.current || !pageVisibleRef.current
              setGated(nextGated)
              if (nextGated) inputRef.current = { ...NEUTRAL_CLASSIC_INPUT }
              else renderRequestedRef.current = true
              previousTime = performance.now()
              accumulator = 0
            },
            { rootMargin: '180px 0px' },
          )
    if (root && intersectionObserver) intersectionObserver.observe(root)

    const onVisibilityChange = () => {
      pageVisibleRef.current = document.visibilityState !== 'hidden'
      const nextGated = !intersectingRef.current || !pageVisibleRef.current
      setGated(nextGated)
      inputRef.current = { ...NEUTRAL_CLASSIC_INPUT }
      previousTime = performance.now()
      accumulator = 0
      if (!nextGated) renderRequestedRef.current = true
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('resize', markRender, { passive: true })

    const frame = (now: number) => {
      if (!mountedRef.current) return
      const active = intersectingRef.current && pageVisibleRef.current
      const elapsed = Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - previousTime) / 1_000))
      previousTime = now

      if (active && stateRef.current.status === 'running') {
        accumulator += elapsed
        const fixedSeconds = 1 / game.fixedStepHz
        let steps = 0
        while (accumulator >= fixedSeconds && steps < MAX_CATCH_UP_STEPS) {
          stateRef.current = stepClassicWorld(
            stateRef.current,
            inputRef.current,
            contractRef.current,
            fixedSeconds,
          )
          accumulator -= fixedSeconds
          steps += 1
        }
        if (steps === MAX_CATCH_UP_STEPS && accumulator >= fixedSeconds) {
          accumulator %= fixedSeconds
        }
        renderRequestedRef.current = true

        const status = stateRef.current.status
        if (status !== lastPublishedStatusRef.current) {
          if (status === 'stage-clear') {
            publish('complete')
            void requestNextStage(stateRef.current)
          } else if (status === 'won' || status === 'game-over') {
            publish('complete')
          }
        } else if (now - lastHudUpdate >= HUD_INTERVAL_MS) {
          publish('tick')
          lastHudUpdate = now
        }
      } else {
        accumulator = 0
      }

      if (active && renderRequestedRef.current) {
        paintClassicWorld(canvasRef.current, stateRef.current, contractRef.current, now)
        renderRequestedRef.current = stateRef.current.status === 'running'
      }
      animationFrame = requestAnimationFrame(frame)
    }

    animationFrame = requestAnimationFrame(frame)
    return () => {
      mountedRef.current = false
      evaluationGenerationRef.current += 1
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('resize', markRender)
      cancelAnimationFrame(animationFrame)
    }
  }, [game.fixedStepHz, publish, requestNextStage])

  const setHeldControl = useCallback((control: HeldControl, value: boolean) => {
    inputRef.current = { ...inputRef.current, [control]: value }
    if (value && stateRef.current.status === 'ready') begin()
  }, [begin])

  const bindHeldControl = (control: HeldControl) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      setHeldControl(control, true)
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      setHeldControl(control, false)
    },
    onPointerCancel: () => setHeldControl(control, false),
    onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => {
      if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        setHeldControl(control, false)
      }
    },
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event.target)) return
    const control = keyControl(event.key)
    if (control) {
      event.preventDefault()
      setHeldControl(control, true)
      return
    }
    if (event.repeat) return
    const key = event.key.toLowerCase()
    if (key === 'p' || key === 'escape') {
      event.preventDefault()
      togglePause()
    } else if (key === 'r') {
      event.preventDefault()
      restart()
    }
  }

  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event.target)) return
    const control = keyControl(event.key)
    if (!control) return
    event.preventDefault()
    setHeldControl(control, false)
  }

  const updateCanvasPointer = (
    event: PointerEvent<HTMLCanvasElement>,
    active: boolean,
  ) => {
    const position = pointerInWorld(event.currentTarget, event.clientX, event.clientY)
    inputRef.current = {
      ...inputRef.current,
      pointerX: position.x,
      pointerY: position.y,
      pointerActive: active,
    }
  }

  const onCanvasPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    updateCanvasPointer(event, true)
    setHeldControl('primary', true)
    focusGame()
  }

  const onCanvasPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    updateCanvasPointer(event, true)
  }

  const releaseCanvasPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    updateCanvasPointer(event, false)
    setHeldControl('primary', false)
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)) return
    inputRef.current = { ...NEUTRAL_CLASSIC_INPUT }
    if (stateRef.current.status === 'running') {
      stateRef.current = pauseClassicWorld(stateRef.current)
      renderRequestedRef.current = true
      publish('pause')
    }
  }

  const retryStageRules = () => {
    transitionKeyRef.current = null
    void requestNextStage(stateRef.current)
  }

  const primaryLabel = actionLabel(game.engineFamily, 'primary', locale)
  const secondaryLabel = actionLabel(game.engineFamily, 'secondary', locale)
  const overlay = overlayContent(hud, locale, game.localTitle[locale], transitioning, ruleError)
  const statusText = statusLabel(hud.status, locale)

  return (
    <section
      ref={rootRef}
      className={`classic-world-game ${className}`.trim()}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
      aria-label={`${game.localTitle[locale]} ${locale === 'zh' ? '游戏区域' : 'game area'}`}
      data-arcade-game={game.id}
      data-engine-family={game.engineFamily}
      data-game-status={hud.status}
      data-game-stage={hud.stage}
      data-game-score={hud.score}
      data-game-lives={hud.lives}
      data-game-tick={hud.tick}
      data-game-gated={gated ? 'true' : 'false'}
    >
      <header className="classic-world-game__bar">
        <div>
          <CircleDot size={12} aria-hidden="true" />
          <strong>{game.title}</strong>
          <span>{game.engineVersion} · {game.fixedStepHz} HZ</span>
        </div>
        <div className="classic-world-game__bar-actions">
          <span className="classic-world-game__verified">
            <ShieldCheck size={12} aria-hidden="true" /> AXC VERIFIED
          </span>
          <button
            type="button"
            onClick={togglePause}
            aria-label={hud.status === 'paused' || !started
              ? locale === 'zh' ? '开始或继续游戏' : 'Start or resume game'
              : locale === 'zh' ? '暂停游戏' : 'Pause game'}
            aria-pressed={hud.status === 'paused'}
          >
            {hud.status === 'paused' || !started ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            type="button"
            onClick={() => restart()}
            aria-label={locale === 'zh' ? '重新开始' : 'Restart game'}
          >
            <RotateCcw size={14} />
          </button>
          {onExit ? (
            <button
              type="button"
              onClick={() => {
                inputRef.current = { ...NEUTRAL_CLASSIC_INPUT }
                if (stateRef.current.status === 'running') {
                  stateRef.current = pauseClassicWorld(stateRef.current)
                  publish('pause')
                }
                onExit()
              }}
              aria-label={locale === 'zh' ? '退出游戏' : 'Exit game'}
            >
              <ArrowLeft size={14} />
            </button>
          ) : null}
        </div>
      </header>

      <div
        className={`classic-world-game__viewport classic-world-game__viewport--${game.viewport}`}
      >
        <canvas
          ref={canvasRef}
          width={CLASSIC_WORLD_WIDTH}
          height={CLASSIC_WORLD_HEIGHT}
          role="img"
          aria-label={locale === 'zh'
            ? `${game.localTitle.zh} 可玩画布。使用方向键或 WASD，主动作使用空格。`
            : `${game.localTitle.en} playable canvas. Use arrows or WASD and Space for the primary action.`}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={releaseCanvasPointer}
          onPointerCancel={releaseCanvasPointer}
          onPointerLeave={(event) => {
            if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) {
              updateCanvasPointer(event, false)
            }
          }}
        />

        <div className="classic-world-game__hud" aria-hidden="true">
          <div data-hud="score"><small>SCORE</small><strong>{hud.score.toString().padStart(6, '0')}</strong></div>
          <div data-hud="stage"><small>STAGE</small><strong>{String(hud.stage).padStart(2, '0')}</strong></div>
          <div data-hud="lives"><small>LINKS</small><strong>{'◆'.repeat(hud.lives) || '—'}</strong></div>
          <div data-hud="streak"><small>CHAIN</small><strong>×{Math.max(1, hud.streak)}</strong></div>
        </div>

        <div className="classic-world-game__sr-only" aria-live="polite" aria-atomic="true">
          {`${game.localTitle[locale]}：${statusText}，${locale === 'zh' ? '关卡' : 'stage'} ${hud.stage}。${hud.message}`}
        </div>

        {overlay ? (
          <div className="classic-world-game__overlay" data-overlay={overlay.kind}>
            {overlay.kind === 'transition' ? <Sparkles size={30} /> : <Gamepad2 size={32} />}
            <span>{overlay.kicker}</span>
            <strong>{overlay.title}</strong>
            <p>{overlay.description}</p>
            {overlay.action === 'start' ? (
              <button type="button" onClick={begin}><Play size={15} /> {locale === 'zh' ? '开始' : 'START'}</button>
            ) : overlay.action === 'resume' ? (
              <button type="button" onClick={togglePause}><Play size={15} /> {locale === 'zh' ? '继续' : 'RESUME'}</button>
            ) : overlay.action === 'restart' ? (
              <button type="button" onClick={() => restart(true)}><RotateCcw size={15} /> {locale === 'zh' ? '再次挑战' : 'TRY AGAIN'}</button>
            ) : overlay.action === 'retry-rules' ? (
              <button type="button" onClick={retryStageRules}><RotateCcw size={15} /> {locale === 'zh' ? '重试规则' : 'RETRY RULES'}</button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="classic-world-game__controls" aria-label={locale === 'zh' ? '触屏控制' : 'Touch controls'}>
        <div className="classic-world-game__dpad">
          <button type="button" {...bindHeldControl('up')} aria-label={locale === 'zh' ? '向上' : 'Move up'}>↑</button>
          <button type="button" {...bindHeldControl('left')} aria-label={locale === 'zh' ? '向左' : 'Move left'}>←</button>
          <button type="button" {...bindHeldControl('down')} aria-label={locale === 'zh' ? '向下' : 'Move down'}>↓</button>
          <button type="button" {...bindHeldControl('right')} aria-label={locale === 'zh' ? '向右' : 'Move right'}>→</button>
        </div>
        <div className="classic-world-game__actions">
          <button
            className="classic-world-game__action classic-world-game__action--secondary"
            type="button"
            {...bindHeldControl('secondary')}
            aria-label={secondaryLabel}
          >
            <span>B</span><small>{secondaryLabel}</small>
          </button>
          <button
            className="classic-world-game__action classic-world-game__action--primary"
            type="button"
            {...bindHeldControl('primary')}
            aria-label={primaryLabel}
          >
            <span>A</span><small>{primaryLabel}</small>
          </button>
        </div>
      </div>

      <footer className="classic-world-game__telemetry">
        <span data-hud="status"><i /> {statusText.toUpperCase()}</span>
        <span data-hud="message">{hud.message}</span>
        <span data-hud="progress">PROGRESS {Math.max(0, Math.round(hud.progress))}</span>
        <span>RULE / {contractRef.current.phase.toUpperCase()}</span>
      </footer>
    </section>
  )
}

function paintClassicWorld(
  canvas: HTMLCanvasElement | null,
  state: ClassicWorldState,
  contract: ClassicRuleContract,
  now: number,
): void {
  if (!canvas) return
  const bounds = canvas.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return
  const dpr = Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, window.devicePixelRatio || 1))
  const width = Math.max(1, Math.round(bounds.width * dpr))
  const height = Math.max(1, Math.round(bounds.height * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    canvas.dataset.dpr = dpr.toFixed(2)
  }

  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.fillStyle = '#020707'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const scale = Math.min(width / CLASSIC_WORLD_WIDTH, height / CLASSIC_WORLD_HEIGHT)
  const offsetX = (width - CLASSIC_WORLD_WIDTH * scale) / 2
  const offsetY = (height - CLASSIC_WORLD_HEIGHT * scale) / 2
  context.setTransform(scale, 0, 0, scale, offsetX, offsetY)
  renderClassicWorld(context, state, contract, now / 1_000)
}

function pointerInWorld(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const bounds = canvas.getBoundingClientRect()
  const scale = Math.min(bounds.width / CLASSIC_WORLD_WIDTH, bounds.height / CLASSIC_WORLD_HEIGHT)
  const contentWidth = CLASSIC_WORLD_WIDTH * scale
  const contentHeight = CLASSIC_WORLD_HEIGHT * scale
  const offsetX = (bounds.width - contentWidth) / 2
  const offsetY = (bounds.height - contentHeight) / 2
  return {
    x: clamp((clientX - bounds.left - offsetX) / Math.max(scale, Number.EPSILON), 0, CLASSIC_WORLD_WIDTH),
    y: clamp((clientY - bounds.top - offsetY) / Math.max(scale, Number.EPSILON), 0, CLASSIC_WORLD_HEIGHT),
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function keyControl(key: string): HeldControl | null {
  switch (key.toLowerCase()) {
    case 'arrowleft':
    case 'a':
      return 'left'
    case 'arrowright':
    case 'd':
      return 'right'
    case 'arrowup':
    case 'w':
      return 'up'
    case 'arrowdown':
    case 's':
      return 'down'
    case ' ':
    case 'spacebar':
    case 'j':
    case 'z':
      return 'primary'
    case 'shift':
    case 'k':
    case 'x':
      return 'secondary'
    default:
      return null
  }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, textarea, select'))
}

function actionLabel(
  family: ArcadeGameDefinition<ArcadeClassicGameId>['engineFamily'],
  action: 'primary' | 'secondary',
  locale: Locale,
): string {
  const labels: Record<typeof family, { primary: Record<Locale, string>; secondary: Record<Locale, string> }> = {
    'projectile-field': { primary: { zh: '射击', en: 'Fire' }, secondary: { zh: '技能', en: 'Ability' } },
    'ricochet-field': { primary: { zh: '发射', en: 'Launch' }, secondary: { zh: '技能', en: 'Ability' } },
    'grid-field': { primary: { zh: '行动', en: 'Act' }, secondary: { zh: '辅助', en: 'Assist' } },
    'lane-field': { primary: { zh: '加速', en: 'Boost' }, secondary: { zh: '制动', en: 'Brake' } },
    'platform-field': { primary: { zh: '跳跃', en: 'Jump' }, secondary: { zh: '攻击', en: 'Strike' } },
    'falling-grid': { primary: { zh: '旋转', en: 'Rotate' }, secondary: { zh: '速降', en: 'Drop' } },
    'collection-field': { primary: { zh: '选择', en: 'Select' }, secondary: { zh: '取消', en: 'Cancel' } },
    'arena-field': { primary: { zh: '击打', en: 'Strike' }, secondary: { zh: '蓄力', en: 'Charge' } },
  }
  return labels[family][action][locale]
}

function statusLabel(status: ClassicWorldStatus, locale: Locale): string {
  const labels: Record<ClassicWorldStatus, Record<Locale, string>> = {
    ready: { zh: '待启动', en: 'ready' },
    running: { zh: '运行中', en: 'running' },
    paused: { zh: '已暂停', en: 'paused' },
    'stage-clear': { zh: '阶段完成', en: 'stage clear' },
    won: { zh: '世界完成', en: 'world complete' },
    'game-over': { zh: '连接中断', en: 'link lost' },
  }
  return labels[status][locale]
}

function overlayContent(
  hud: HudSnapshot,
  locale: Locale,
  title: string,
  transitioning: boolean,
  ruleError: string | null,
): {
  kind: string
  kicker: string
  title: string
  description: string
  action: 'start' | 'resume' | 'restart' | 'retry-rules' | null
} | null {
  if (ruleError) {
    return {
      kind: 'error',
      kicker: 'RULE TRANSITION REJECTED',
      title: locale === 'zh' ? '规则没有通过验证' : 'RULES DID NOT VERIFY',
      description: ruleError,
      action: 'retry-rules',
    }
  }
  if (transitioning || hud.status === 'stage-clear') {
    return {
      kind: 'transition',
      kicker: 'AXIRUNE / NEXT CONTRACT',
      title: locale === 'zh' ? '正在校准下一阶段' : 'CALIBRATING NEXT STAGE',
      description: locale === 'zh' ? '已完成当前世界，正在执行经过验证的规则 IR。' : 'World complete. Executing verified rule IR for the next stage.',
      action: null,
    }
  }
  if (hud.status === 'ready') {
    return {
      kind: 'ready',
      kicker: 'CAPSULE VERIFIED / INPUT READY',
      title,
      description: locale === 'zh' ? '方向键或 WASD 移动，空格执行主动作，Shift 执行副动作，P 暂停。' : 'Move with arrows or WASD, use Space for the primary action, Shift for secondary, and P to pause.',
      action: 'start',
    }
  }
  if (hud.status === 'paused') {
    return {
      kind: 'paused',
      kicker: 'SIMULATION GATED',
      title: locale === 'zh' ? '游戏已暂停' : 'GAME PAUSED',
      description: locale === 'zh' ? '固定步进时钟已经停止，不会在后台追赶时间。' : 'The fixed-step clock is stopped and will not catch up in the background.',
      action: 'resume',
    }
  }
  if (hud.status === 'won') {
    return {
      kind: 'won',
      kicker: 'WORLD COMPLETE',
      title: hud.score.toLocaleString(),
      description: locale === 'zh' ? '三个阶段已经完成。可以用相同 seed 再次验证结果。' : 'All three stages are complete. Replay the same seed to verify the result.',
      action: 'restart',
    }
  }
  if (hud.status === 'game-over') {
    return {
      kind: 'game-over',
      kicker: 'LINK LOST',
      title: hud.score.toLocaleString(),
      description: locale === 'zh' ? '状态已经冻结；重新开始会恢复相同的确定性 seed。' : 'State is frozen. Restarting restores the same deterministic seed.',
      action: 'restart',
    }
  }
  return null
}
