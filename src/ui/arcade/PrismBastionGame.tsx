import { Gem, Pause, Play, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  BREAKER_FIXED_STEP_SECONDS,
  BREAKER_BRICK_RULES,
  BREAKER_RULES,
  createBreakerGame,
  stepBreakerGame,
  type BreakerBrick,
  type BreakerEvent,
  type BreakerGameState,
} from '../../arcade/breaker-engine'
import type { RuntimeValue } from '../../language'
import type { Locale } from '../../content/site'
import type { PrismContract } from '../ArcadePage'

type PrismBastionGameProps = {
  locale: Locale
  contract: PrismContract
  art: string
  evaluateRules(input: Readonly<Record<string, RuntimeValue>>): Promise<PrismContract>
}

type PrismParticle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

type TrailPoint = { x: number; y: number; life: number }

export function PrismBastionGame({ locale, contract, art, evaluateRules }: PrismBastionGameProps) {
  const gameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const stateRef = useRef<BreakerGameState | null>(null)
  const contractRef = useRef(contract)
  const evaluateRef = useRef(evaluateRules)
  const inputRef = useRef({ left: false, right: false, launch: false, targetX: null as number | null })
  const effectsRef = useRef<PrismParticle[]>([])
  const trailsRef = useRef<TrailPoint[]>([])
  const clearedRef = useRef(0)
  const ruleSequenceRef = useRef(0)
  const startedRef = useRef(false)
  const visibleRef = useRef(true)
  const paintRequestedRef = useRef(true)
  const [started, setStarted] = useState(false)
  const [hud, setHud] = useState<BreakerGameState>(() => tuneBreaker(createBreakerGame({ seed: 0xb451_2026 }), contract, true))

  if (!stateRef.current) stateRef.current = tuneBreaker(createBreakerGame({ seed: 0xb451_2026 }), contract, true)

  useEffect(() => {
    const image = new Image()
    image.decoding = 'async'
    image.src = art
    image.onload = () => {
      imageRef.current = image
      paintRequestedRef.current = true
    }
    return () => { imageRef.current = null }
  }, [art])

  useEffect(() => {
    contractRef.current = contract
    evaluateRef.current = evaluateRules
    if (stateRef.current) {
      stateRef.current = tuneBreaker(stateRef.current, contract, true)
      setHud(stateRef.current)
      paintRequestedRef.current = true
    }
  }, [contract, evaluateRules])

  useEffect(() => {
    let animationFrame = 0
    let lastTime = performance.now()
    let accumulator = 0
    let lastHud = 0
    let mounted = true

    const frame = (now: number) => {
      const elapsed = Math.min(0.05, Math.max(0, (now - lastTime) / 1_000))
      lastTime = now
      let state = stateRef.current
      const renderable = visibleRef.current && document.visibilityState !== 'hidden'
      const active = Boolean(state && renderable && startedRef.current && state.phase !== 'paused' && !isTerminal(state.phase))
      if (state && active) {
        accumulator += elapsed
        let steps = 0
        while (accumulator >= BREAKER_FIXED_STEP_SECONDS && steps < 8) {
          const axis = Number(inputRef.current.right) - Number(inputRef.current.left)
          state = stepBreakerGame(state, {
            axis,
            targetX: inputRef.current.targetX ?? undefined,
            launch: inputRef.current.launch,
          })
          inputRef.current.launch = false
          state = tuneBreaker(state, contractRef.current, false)
          handleBreakerEvents(state.events, state)
          accumulator -= BREAKER_FIXED_STEP_SECONDS
          steps += 1
        }
        stateRef.current = state
      } else {
        accumulator = Math.min(accumulator, BREAKER_FIXED_STEP_SECONDS)
      }

      if (state && renderable && (active || paintRequestedRef.current)) {
        updatePrismParticles(effectsRef.current, elapsed)
        updateTrail(trailsRef.current, state, elapsed)
        drawPrismBastion(canvasRef.current, imageRef.current, state, effectsRef.current, trailsRef.current, now)
        paintRequestedRef.current = false
        if (now - lastHud > 80 || isTerminal(state.phase) || state.phase === 'level-clear') {
          lastHud = now
          setHud(state)
        }
      }
      animationFrame = requestAnimationFrame(frame)
    }

    const handleBreakerEvents = (events: readonly BreakerEvent[], state: BreakerGameState) => {
      for (const event of events) {
        if (event.type === 'brick-broken') {
          clearedRef.current += 1
          const brick = state.bricks.find((candidate) => candidate.id === event.brickId)
          if (brick) addPrismBurst(effectsRef.current, brick.x + brick.width / 2, brick.y + brick.height / 2, colorForBrick(event.brickKind), event.brickId.length)
        }
        if (event.type === 'nova-burst') {
          addPrismBurst(effectsRef.current, event.x, event.y, '#bdf765', Math.round(event.x + event.y), 34)
        }
        if (event.type === 'level-start') {
          const sequence = ++ruleSequenceRef.current
          void evaluateRef.current({
            level: event.level,
            cleared: clearedRef.current,
            combo: state.combo,
          }).then((next) => {
            if (!mounted || sequence !== ruleSequenceRef.current || !stateRef.current) return
            contractRef.current = next
            stateRef.current = tuneBreaker(stateRef.current, next, true)
            paintRequestedRef.current = true
          }).catch(() => undefined)
        }
      }
    }

    const canvas = canvasRef.current
    const observer = typeof IntersectionObserver === 'undefined' || !canvas
      ? null
      : new IntersectionObserver(([entry]) => {
          visibleRef.current = entry?.isIntersecting ?? true
          if (visibleRef.current) paintRequestedRef.current = true
          else {
            inputRef.current.left = false
            inputRef.current.right = false
            inputRef.current.targetX = null
          }
        }, { rootMargin: '160px' })
    if (canvas && observer) observer.observe(canvas)
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') paintRequestedRef.current = true
      else {
        inputRef.current.left = false
        inputRef.current.right = false
        inputRef.current.targetX = null
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    animationFrame = requestAnimationFrame(frame)
    return () => {
      mounted = false
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      cancelAnimationFrame(animationFrame)
    }
  }, [])

  const begin = () => {
    startedRef.current = true
    setStarted(true)
    inputRef.current.launch = true
    paintRequestedRef.current = true
    focusGame()
  }

  const togglePause = () => {
    const state = stateRef.current
    if (!state) return
    if (!startedRef.current) {
      begin()
      return
    }
    stateRef.current = stepBreakerGame(state, { togglePause: true })
    setHud(stateRef.current)
    paintRequestedRef.current = true
    if (stateRef.current.phase !== 'paused') focusGame()
  }

  const restart = (play = startedRef.current) => {
    effectsRef.current = []
    trailsRef.current = []
    clearedRef.current = 0
    startedRef.current = play
    setStarted(play)
    stateRef.current = tuneBreaker(createBreakerGame({ seed: 0xb451_2026 }), contractRef.current, true)
    if (play) inputRef.current.launch = true
    setHud(stateRef.current)
    paintRequestedRef.current = true
    if (play) focusGame()
  }

  const nextLevel = () => {
    inputRef.current.launch = true
    paintRequestedRef.current = true
    focusGame()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase()
    if (key === 'arrowleft' || key === 'a') { event.preventDefault(); inputRef.current.left = true }
    else if (key === 'arrowright' || key === 'd') { event.preventDefault(); inputRef.current.right = true }
    else if (key === ' ' || key === 'spacebar') { event.preventDefault(); inputRef.current.launch = true }
    else if (!event.repeat && key === 'p') { event.preventDefault(); togglePause() }
    else if (!event.repeat && key === 'r') { event.preventDefault(); restart() }
  }

  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase()
    if (key === 'arrowleft' || key === 'a') { event.preventDefault(); inputRef.current.left = false }
    else if (key === 'arrowright' || key === 'd') { event.preventDefault(); inputRef.current.right = false }
  }

  const bindDirection = (direction: 'left' | 'right') => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); inputRef.current[direction] = true
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); inputRef.current[direction] = false },
    onPointerCancel: () => { inputRef.current[direction] = false },
    onPointerLeave: () => { inputRef.current[direction] = false },
  })

  const overlay = !started || hud.phase === 'game-over' || hud.phase === 'won' || hud.phase === 'level-clear' || hud.phase === 'paused'

  return (
    <div
      ref={gameRef}
      className="arcade-game arcade-game--breaker"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={(event) => {
        if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)) return
        inputRef.current.left = false
        inputRef.current.right = false
        if (!startedRef.current) return
        if (stateRef.current && stateRef.current.phase !== 'paused' && !isTerminal(stateRef.current.phase)) {
          stateRef.current = stepBreakerGame(stateRef.current, { togglePause: true })
          setHud(stateRef.current)
          paintRequestedRef.current = true
        }
      }}
      aria-label={locale === 'zh' ? '棱镜堡垒游戏区域' : 'Prism Bastion game area'}
    >
      <div className="arcade-game__topline">
        <span><i /> LIVE / {hud.phase.toUpperCase()}</span>
        <div>
          <button type="button" onClick={togglePause} aria-label={!started ? 'Start Prism Bastion' : hud.phase === 'paused' ? 'Resume' : 'Pause'}>
            {!started || hud.phase === 'paused' ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button type="button" onClick={() => restart()} aria-label="Restart Prism Bastion"><RotateCcw size={13} /></button>
        </div>
      </div>
      <div
        className="arcade-game__viewport arcade-game__viewport--landscape"
        onPointerMove={(event) => {
          if (event.pointerType === 'mouse' && event.buttons === 0) return
          const bounds = event.currentTarget.getBoundingClientRect()
          inputRef.current.targetX = Math.max(0, Math.min(BREAKER_RULES.worldWidth, ((event.clientX - bounds.left) / bounds.width) * BREAKER_RULES.worldWidth))
        }}
        onPointerLeave={() => { inputRef.current.targetX = null }}
      >
        <canvas ref={canvasRef} width={1440} height={960} />
        <div className="arcade-hud arcade-hud--breaker">
          <div><small>SCORE</small><strong>{hud.score.toString().padStart(7, '0')}</strong></div>
          <div><small>LEVEL</small><strong>{hud.level} / 3</strong></div>
          <div><small>COMBO</small><strong>×{Math.max(1, hud.combo)}</strong></div>
          <div><small>LIVES</small><strong>{'◆'.repeat(Math.max(0, hud.lives))}</strong></div>
        </div>
        <div className="arcade-sr-only" aria-live="polite" aria-atomic="true">
          {locale === 'zh'
            ? `棱镜堡垒：${breakerPhaseLabel(hud.phase, locale)}，第 ${hud.level} 层，剩余 ${hud.lives} 次。`
            : `Prism Bastion: ${breakerPhaseLabel(hud.phase, locale)}, level ${hud.level}, ${hud.lives} lives.`}
        </div>
        {overlay ? (
          <div className={`arcade-game__overlay ${hud.phase === 'paused' ? 'arcade-game__overlay--compact' : ''}`}>
            {hud.phase === 'won' ? <Sparkles size={34} /> : <Gem size={34} />}
            <span>{hud.phase === 'level-clear' ? 'REACTOR STABLE' : hud.phase === 'won' ? 'PRISM RESTORED' : hud.phase === 'game-over' ? 'CORE OFFLINE' : 'PRISM BASTION'}</span>
            <strong>{hud.phase === 'level-clear' ? hud.levelName : hud.phase === 'won' || hud.phase === 'game-over' ? hud.score.toLocaleString() : hud.phase === 'paused' ? (locale === 'zh' ? '反应堆已暂停' : 'REACTOR PAUSED') : (locale === 'zh' ? '击穿三层棱镜防线' : 'BREAK THE THREE PRISM LAYERS')}</strong>
            <p>{locale === 'zh' ? '方向键 / AD 控制球拍，空格发射，P 暂停。触屏可拖动或使用按键。' : 'Steer with arrows / AD, launch with Space, pause with P. Touch can drag or use the controls.'}</p>
            <button type="button" onClick={hud.phase === 'level-clear' ? nextLevel : hud.phase === 'paused' ? togglePause : hud.phase === 'game-over' || hud.phase === 'won' ? () => restart(true) : begin}>
              <Play size={15} fill="currentColor" />
              {hud.phase === 'level-clear' ? (locale === 'zh' ? '进入下一层' : 'NEXT LAYER') : hud.phase === 'paused' ? (locale === 'zh' ? '继续' : 'RESUME') : hud.phase === 'game-over' || hud.phase === 'won' ? (locale === 'zh' ? '重新校准' : 'RECALIBRATE') : (locale === 'zh' ? '启动反应堆' : 'START REACTOR')}
            </button>
          </div>
        ) : null}
      </div>
      <div className="arcade-controls arcade-controls--breaker" aria-label="Touch controls">
        <button type="button" {...bindDirection('left')} aria-label={locale === 'zh' ? '向左' : 'Move left'}>←</button>
        <button className="arcade-launch" type="button" onClick={() => { inputRef.current.launch = true }} aria-label={locale === 'zh' ? '发射' : 'Launch'}><Gem size={18} /><span>LAUNCH</span></button>
        <button type="button" {...bindDirection('right')} aria-label={locale === 'zh' ? '向右' : 'Move right'}>→</button>
      </div>
      <div className="arcade-contract-strip">
        <span>AXIRUNE / LEVEL {contract.level}</span>
        <strong>{contract.pulse.toUpperCase()}</strong>
        <span>V {Math.round(contract.ballSpeed)}</span>
        <span>PAD {Math.round(contract.paddleWidth)}</span>
        <span>BASE {contract.brickValue}</span>
      </div>
    </div>
  )

  function focusGame() {
    requestAnimationFrame(() => gameRef.current?.focus({ preventScroll: true }))
  }
}

function tuneBreaker(state: BreakerGameState, contract: PrismContract, armor: boolean): BreakerGameState {
  state.paddle.width = contract.paddleWidth
  state.paddle.x = clamp(state.paddle.x, state.paddle.width / 2, BREAKER_RULES.worldWidth - state.paddle.width / 2)
  let destructibleIndex = 0
  for (const brick of state.bricks) {
    if (!brick.destructible) continue
    destructibleIndex += 1
    if (armor && brick.kind === 'lumen' && destructibleIndex % contract.armoredEvery === 0) {
      brick.kind = 'shell'
      brick.maxHp = BREAKER_BRICK_RULES.shell.hp
      brick.hp = brick.maxHp
      brick.destructible = BREAKER_BRICK_RULES.shell.destructible
    }
    const multiplier = brick.kind === 'crown' ? 2.2 : brick.kind === 'nova' ? 1.7 : brick.kind === 'shell' ? 1.4 : 1
    brick.points = Math.max(1, Math.round(contract.brickValue * multiplier))
  }
  for (const ball of state.balls) {
    if (ball.attached) {
      ball.x = state.paddle.x
      continue
    }
    const speed = Math.hypot(ball.velocityX, ball.velocityY)
    if (speed > 0) {
      ball.velocityX = (ball.velocityX / speed) * contract.ballSpeed
      ball.velocityY = (ball.velocityY / speed) * contract.ballSpeed
    }
  }
  return state
}

function drawPrismBastion(
  canvas: HTMLCanvasElement | null,
  background: HTMLImageElement | null,
  state: BreakerGameState,
  particles: readonly PrismParticle[],
  trail: readonly TrailPoint[],
  now: number,
) {
  if (!canvas) return
  const context = canvas.getContext('2d')
  if (!context) return
  const scale = canvas.width / BREAKER_RULES.worldWidth
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.clearRect(0, 0, BREAKER_RULES.worldWidth, BREAKER_RULES.worldHeight)
  if (background?.complete) context.drawImage(background, 0, 0, BREAKER_RULES.worldWidth, BREAKER_RULES.worldHeight)
  else {
    const gradient = context.createRadialGradient(480, 260, 30, 480, 320, 600)
    gradient.addColorStop(0, '#103c45'); gradient.addColorStop(1, '#03080b')
    context.fillStyle = gradient; context.fillRect(0, 0, BREAKER_RULES.worldWidth, BREAKER_RULES.worldHeight)
  }
  context.fillStyle = 'rgba(1, 9, 12, 0.36)'; context.fillRect(0, 0, BREAKER_RULES.worldWidth, BREAKER_RULES.worldHeight)
  drawReactorGrid(context, state.tick, now)
  for (const point of trail) {
    context.save(); context.globalAlpha = Math.max(0, point.life / 0.24) * 0.42; context.fillStyle = '#d9ffff'; context.shadowColor = '#66eaff'; context.shadowBlur = 18
    context.beginPath(); context.arc(point.x, point.y, 5 * (point.life / 0.24), 0, Math.PI * 2); context.fill(); context.restore()
  }
  for (const brick of state.bricks) if (brick.hp > 0 || !brick.destructible) drawPrismBrick(context, brick, now)
  drawPaddle(context, state, now)
  for (const ball of state.balls) drawBall(context, ball.x, ball.y, ball.radius, now)
  drawPrismParticles(context, particles)
  drawBreakerVignette(context)
}

function drawReactorGrid(context: CanvasRenderingContext2D, tick: number, now: number) {
  context.save(); context.globalAlpha = 0.16; context.strokeStyle = '#67e9ee'; context.lineWidth = 1
  for (let x = 0; x <= 960; x += 80) { context.beginPath(); context.moveTo(x, 0); context.lineTo(480 + (x - 480) * 0.45, 640); context.stroke() }
  for (let y = 40; y < 640; y += 60) { context.globalAlpha = 0.05 + ((y + tick) % 120) / 1_800; context.beginPath(); context.moveTo(0, y); context.lineTo(960, y); context.stroke() }
  const pulse = 34 + Math.sin(now * 0.002) * 6
  context.globalAlpha = 0.12; context.strokeStyle = '#bdf765'; context.lineWidth = 2; context.beginPath(); context.arc(480, 320, pulse * 5, 0, Math.PI * 2); context.stroke(); context.restore()
}

function drawPrismBrick(context: CanvasRenderingContext2D, brick: BreakerBrick, now: number) {
  const color = colorForBrick(brick.kind)
  context.save(); context.shadowColor = color; context.shadowBlur = brick.kind === 'nova' ? 18 + Math.sin(now * 0.008) * 5 : 8
  const gradient = context.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height)
  gradient.addColorStop(0, '#f1ffff'); gradient.addColorStop(0.16, color); gradient.addColorStop(0.7, `${color}99`); gradient.addColorStop(1, '#07151c')
  context.fillStyle = brick.kind === 'voidstone' ? '#101b22' : gradient
  context.strokeStyle = brick.kind === 'voidstone' ? '#6c7c83' : color
  context.lineWidth = brick.kind === 'crown' ? 2 : 1
  roundedRect(context, brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2, 5); context.fill(); context.stroke()
  context.globalAlpha = 0.55; context.fillStyle = '#ffffff'; roundedRect(context, brick.x + 6, brick.y + 4, brick.width - 12, 3, 1.5); context.fill()
  if (brick.kind === 'nova') {
    context.translate(brick.x + brick.width / 2, brick.y + brick.height / 2); context.rotate(now * 0.0015)
    context.strokeStyle = '#ffffff'; context.globalAlpha = 0.8; context.beginPath(); context.moveTo(-8, 0); context.lineTo(8, 0); context.moveTo(0, -8); context.lineTo(0, 8); context.stroke()
  } else if (brick.kind === 'voidstone') {
    context.strokeStyle = '#5f737c'; context.globalAlpha = 0.65
    for (let offset = -brick.height; offset < brick.width; offset += 10) { context.beginPath(); context.moveTo(brick.x + offset, brick.y + brick.height); context.lineTo(brick.x + offset + brick.height, brick.y); context.stroke() }
  } else if (brick.maxHp > 1) {
    context.globalAlpha = 0.8; context.fillStyle = '#041014'
    for (let hp = 0; hp < brick.maxHp; hp += 1) context.fillRect(brick.x + brick.width - 7 - hp * 6, brick.y + brick.height - 6, 4, 2)
  }
  context.restore()
}

function drawPaddle(context: CanvasRenderingContext2D, state: BreakerGameState, now: number) {
  const paddle = state.paddle
  const left = paddle.x - paddle.width / 2
  context.save(); context.shadowColor = '#bdf765'; context.shadowBlur = 18 + Math.sin(now * 0.006) * 3
  const gradient = context.createLinearGradient(left, paddle.y, left + paddle.width, paddle.y)
  gradient.addColorStop(0, '#16313a'); gradient.addColorStop(0.18, '#bdf765'); gradient.addColorStop(0.5, '#f4ffff'); gradient.addColorStop(0.82, '#bdf765'); gradient.addColorStop(1, '#16313a')
  context.fillStyle = gradient; context.strokeStyle = '#dfffff'; context.lineWidth = 1.5
  roundedRect(context, left, paddle.y, paddle.width, paddle.height, 9); context.fill(); context.stroke()
  context.fillStyle = '#071218'; roundedRect(context, paddle.x - 18, paddle.y + 4, 36, paddle.height - 8, 5); context.fill(); context.restore()
}

function drawBall(context: CanvasRenderingContext2D, x: number, y: number, radius: number, now: number) {
  context.save(); context.shadowColor = '#69f2ff'; context.shadowBlur = 24
  const gradient = context.createRadialGradient(x - radius * 0.35, y - radius * 0.45, 1, x, y, radius)
  gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.35, '#bffcff'); gradient.addColorStop(0.78, '#4bdbe9'); gradient.addColorStop(1, '#0b5965')
  context.fillStyle = gradient; context.beginPath(); context.arc(x, y, radius + Math.sin(now * 0.012) * 0.4, 0, Math.PI * 2); context.fill(); context.restore()
}

function colorForBrick(kind: BreakerBrick['kind']): string {
  switch (kind) {
    case 'lumen': return '#5ee9f5'
    case 'shell': return '#bdf765'
    case 'crown': return '#ff8b79'
    case 'nova': return '#f5e86b'
    case 'voidstone': return '#71848c'
  }
}

function addPrismBurst(particles: PrismParticle[], x: number, y: number, color: string, seed: number, count = 18) {
  for (let index = 0; index < count; index += 1) {
    const angle = ((index * 137.5 + seed * 17) * Math.PI) / 180
    const speed = 65 + ((index * 31 + seed) % 150)
    const life = 0.38 + (index % 7) * 0.06
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, size: 2 + index % 4, color })
  }
}

function updatePrismParticles(particles: PrismParticle[], delta: number) {
  for (const particle of particles) { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 75 * delta; particle.life -= delta }
  for (let index = particles.length - 1; index >= 0; index -= 1) if (particles[index]!.life <= 0) particles.splice(index, 1)
}

function drawPrismParticles(context: CanvasRenderingContext2D, particles: readonly PrismParticle[]) {
  context.save(); context.globalCompositeOperation = 'screen'
  for (const particle of particles) {
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife); context.fillStyle = particle.color; context.shadowColor = particle.color; context.shadowBlur = 10
    context.save(); context.translate(particle.x, particle.y); context.rotate(Math.atan2(particle.vy, particle.vx)); context.fillRect(-particle.size / 2, -1, particle.size * 2.4, 2); context.restore()
  }
  context.restore()
}

function updateTrail(trail: TrailPoint[], state: BreakerGameState, delta: number) {
  for (const point of trail) point.life -= delta
  for (let index = trail.length - 1; index >= 0; index -= 1) if (trail[index]!.life <= 0) trail.splice(index, 1)
  for (const ball of state.balls) if (!ball.attached) trail.push({ x: ball.x, y: ball.y, life: 0.24 })
  if (trail.length > 72) trail.splice(0, trail.length - 72)
}

function drawBreakerVignette(context: CanvasRenderingContext2D) {
  const gradient = context.createRadialGradient(480, 320, 160, 480, 320, 590)
  gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,5,8,0.7)')
  context.fillStyle = gradient; context.fillRect(0, 0, 960, 640)
  context.globalAlpha = 0.06; context.fillStyle = '#021015'; for (let y = 0; y < 640; y += 4) context.fillRect(0, y, 960, 1); context.globalAlpha = 1
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath(); context.moveTo(x + safeRadius, y); context.lineTo(x + width - safeRadius, y); context.quadraticCurveTo(x + width, y, x + width, y + safeRadius); context.lineTo(x + width, y + height - safeRadius); context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height); context.lineTo(x + safeRadius, y + height); context.quadraticCurveTo(x, y + height, x, y + height - safeRadius); context.lineTo(x, y + safeRadius); context.quadraticCurveTo(x, y, x + safeRadius, y); context.closePath()
}

function isTerminal(phase: BreakerGameState['phase']) {
  return phase === 'won' || phase === 'game-over'
}

function breakerPhaseLabel(phase: BreakerGameState['phase'], locale: Locale) {
  if (locale === 'zh') {
    if (phase === 'ready') return '待发射'
    if (phase === 'playing') return '运行中'
    if (phase === 'paused') return '已暂停'
    if (phase === 'level-clear') return '本层完成'
    if (phase === 'won') return '任务完成'
    return '任务结束'
  }
  if (phase === 'ready') return 'ready'
  if (phase === 'playing') return 'playing'
  if (phase === 'paused') return 'paused'
  if (phase === 'level-clear') return 'level clear'
  if (phase === 'won') return 'campaign complete'
  return 'game over'
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
