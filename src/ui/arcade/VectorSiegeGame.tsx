import { Crosshair, HeartPulse, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  ShooterEngine,
  createShooterEngine,
  type EnemyState,
  type ShooterEvent,
  type ShooterInput,
  type ShooterSnapshot,
} from '../../arcade/shooter-engine'
import type { RuntimeValue } from '../../language'
import type { Locale } from '../../content/site'
import type { VectorContract } from '../ArcadePage'

type VectorSiegeGameProps = {
  locale: Locale
  contract: VectorContract
  art: string
  evaluateRules(input: Readonly<Record<string, RuntimeValue>>): Promise<VectorContract>
}

type Burst = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

const EMPTY_INPUT: Required<ShooterInput> = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
}

export function VectorSiegeGame({ locale, contract, art, evaluateRules }: VectorSiegeGameProps) {
  const gameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const engineRef = useRef<ShooterEngine | null>(null)
  const inputRef = useRef({ ...EMPTY_INPUT })
  const effectsRef = useRef<Burst[]>([])
  const contractRef = useRef(contract)
  const evaluateRef = useRef(evaluateRules)
  const destroyedRef = useRef(0)
  const ruleSequenceRef = useRef(0)
  const startedRef = useRef(false)
  const visibleRef = useRef(true)
  const paintRequestedRef = useRef(true)
  const [started, setStarted] = useState(false)
  const [hud, setHud] = useState<ShooterSnapshot>(() => createTunedShooter(contract).snapshot())

  if (!engineRef.current) {
    engineRef.current = createTunedShooter(contract)
    engineRef.current.pause()
  }

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
    if (engineRef.current) {
      engineRef.current = tuneShooter(engineRef.current, contract)
      setHud(engineRef.current.snapshot())
      paintRequestedRef.current = true
    }
  }, [contract, evaluateRules])

  useEffect(() => {
    let animationFrame = 0
    let lastTime = performance.now()
    let lastHud = 0
    let mounted = true

    const frame = (now: number) => {
      const elapsed = Math.min(50, Math.max(0, now - lastTime))
      lastTime = now
      const engine = engineRef.current
      const renderable = visibleRef.current && document.visibilityState !== 'hidden'
      const active = Boolean(engine && renderable && startedRef.current && engine.status === 'running')
      if (engine && active) {
        const result = engine.advance(elapsed, inputRef.current)
        if (result.events.length > 0) handleEvents(result.events, engine)
        updateBursts(effectsRef.current, elapsed / 1_000)
      }
      if (engine && renderable && (active || paintRequestedRef.current)) {
        const snapshot = engine.snapshot()
        drawVectorSiege(canvasRef.current, imageRef.current, snapshot, effectsRef.current, now)
        paintRequestedRef.current = false
        if (now - lastHud > 80 || snapshot.status === 'game-over') {
          lastHud = now
          setHud(snapshot)
        }
      }
      animationFrame = requestAnimationFrame(frame)
    }

    const handleEvents = (events: ShooterEvent[], engine: ShooterEngine) => {
      for (const event of events) {
        if (event.type === 'enemy-destroyed') {
          destroyedRef.current += 1
          addBurst(effectsRef.current, event.x, event.y, '#bdf765', event.enemyId)
        }
        if (event.type === 'player-hit') {
          const player = engine.snapshot().player
          addBurst(effectsRef.current, player.x + player.width / 2, player.y, '#ff7c6b', event.sourceId)
        }
        if (event.type === 'wave-cleared') {
          const sequence = ++ruleSequenceRef.current
          const snapshot = engine.snapshot()
          void evaluateRef.current({
            wave: event.nextWave,
            destroyed: destroyedRef.current,
            combo: snapshot.combo,
          }).then((next) => {
            if (!mounted || sequence !== ruleSequenceRef.current || !engineRef.current) return
            contractRef.current = next
            // The between-wave gap is the configuration boundary. Updating the
            // engine now means the next formation is born from its own contract.
            engineRef.current = tuneShooter(engineRef.current, next)
            paintRequestedRef.current = true
          }).catch(() => undefined)
        }
        if (event.type === 'wave-started') {
          const current = contractRef.current
          if (current.wave === event.wave) {
            engineRef.current = tuneShooter(engine, current, true)
            continue
          }
          const sequence = ++ruleSequenceRef.current
          const snapshot = engine.snapshot()
          void evaluateRef.current({
            wave: event.wave,
            destroyed: destroyedRef.current,
            combo: snapshot.combo,
          }).then((next) => {
            if (!mounted || sequence !== ruleSequenceRef.current || !engineRef.current) return
            contractRef.current = next
            engineRef.current = tuneShooter(engineRef.current, next, true)
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
          else inputRef.current = { ...EMPTY_INPUT }
        }, { rootMargin: '160px' })
    if (canvas && observer) observer.observe(canvas)
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') paintRequestedRef.current = true
      else inputRef.current = { ...EMPTY_INPUT }
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
    const engine = engineRef.current
    if (!engine) return
    startedRef.current = true
    setStarted(true)
    engine.resume()
    paintRequestedRef.current = true
    focusGame()
  }

  const togglePause = () => {
    const engine = engineRef.current
    if (!engine) return
    if (!startedRef.current) {
      begin()
      return
    }
    engine.togglePause()
    setHud(engine.snapshot())
    paintRequestedRef.current = true
    if (engine.status === 'running') focusGame()
  }

  const restart = () => {
    effectsRef.current = []
    destroyedRef.current = 0
    const engine = createTunedShooter(contractRef.current)
    if (!startedRef.current) engine.pause()
    engineRef.current = engine
    setHud(engine.snapshot())
    paintRequestedRef.current = true
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const control = inputControl(event.key)
    if (control) {
      event.preventDefault()
      inputRef.current[control] = true
      return
    }
    if (event.repeat) return
    if (event.key.toLowerCase() === 'p') {
      event.preventDefault()
      togglePause()
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      restart()
    }
  }

  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    const control = inputControl(event.key)
    if (!control) return
    event.preventDefault()
    inputRef.current[control] = false
  }

  const bindPointer = (control: keyof Required<ShooterInput>) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      inputRef.current[control] = true
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      inputRef.current[control] = false
    },
    onPointerCancel: () => { inputRef.current[control] = false },
    onPointerLeave: () => { inputRef.current[control] = false },
  })

  return (
    <div
      ref={gameRef}
      className="arcade-game arcade-game--shooter"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={(event) => {
        if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)) return
        inputRef.current = { ...EMPTY_INPUT }
        if (engineRef.current?.status === 'running') {
          engineRef.current.pause()
          setHud(engineRef.current.snapshot())
          paintRequestedRef.current = true
        }
      }}
      aria-label={locale === 'zh' ? '矢量防线游戏区域' : 'Vector Siege game area'}
    >
      <div className="arcade-game__topline">
        <span><i /> LIVE / {hud.status.toUpperCase()}</span>
        <div>
          <button type="button" onClick={togglePause} aria-label={!started ? 'Start Vector Siege' : hud.status === 'paused' ? 'Resume' : 'Pause'}>
            {!started || hud.status === 'paused' ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button type="button" onClick={restart} aria-label="Restart Vector Siege"><RotateCcw size={13} /></button>
        </div>
      </div>
      <div className="arcade-game__viewport arcade-game__viewport--portrait">
        <canvas ref={canvasRef} width={720} height={1280} />
        <div className="arcade-hud arcade-hud--shooter">
          <div><small>SCORE</small><strong>{hud.score.toString().padStart(6, '0')}</strong></div>
          <div><small>WAVE</small><strong>{String(hud.wave).padStart(2, '0')}</strong></div>
          <div><small>COMBO</small><strong>×{Math.max(1, hud.combo)}</strong></div>
          <div className="arcade-health"><HeartPulse size={13} /><span>{Array.from({ length: hud.player.maxHealth }, (_, index) => <i className={index < hud.player.health ? 'is-live' : ''} key={index} />)}</span></div>
        </div>
        <div className="arcade-sr-only" aria-live="polite" aria-atomic="true">
          {locale === 'zh'
            ? `矢量防线：${shooterStatusLabel(hud.status, locale)}，第 ${hud.wave} 波。`
            : `Vector Siege: ${shooterStatusLabel(hud.status, locale)}, wave ${hud.wave}.`}
        </div>
        {!started || hud.status === 'game-over' ? (
          <div className="arcade-game__overlay">
            <Crosshair size={34} />
            <span>{hud.status === 'game-over' ? 'SIGNAL LOST' : 'VECTOR SIEGE'}</span>
            <strong>{hud.status === 'game-over' ? hud.score.toLocaleString() : locale === 'zh' ? '守住矢量航道' : 'DEFEND THE VECTOR LANE'}</strong>
            <p>{locale === 'zh' ? '方向键 / WASD 移动，空格射击，P 暂停。' : 'Move with arrows / WASD, fire with Space, pause with P.'}</p>
            <button type="button" onClick={hud.status === 'game-over' ? restartAndBegin : begin}>
              <Play size={15} fill="currentColor" /> {hud.status === 'game-over' ? (locale === 'zh' ? '再次出击' : 'REDEPLOY') : (locale === 'zh' ? '开始任务' : 'START MISSION')}
            </button>
          </div>
        ) : hud.status === 'paused' ? (
          <div className="arcade-game__overlay arcade-game__overlay--compact">
            <Pause size={28} />
            <strong>{locale === 'zh' ? '任务已暂停' : 'MISSION PAUSED'}</strong>
            <button type="button" onClick={togglePause}><Play size={14} /> {locale === 'zh' ? '继续' : 'RESUME'}</button>
          </div>
        ) : null}
      </div>
      <div className="arcade-controls arcade-controls--shooter" aria-label="Touch controls">
        <div className="arcade-dpad">
          <button type="button" {...bindPointer('up')} aria-label={locale === 'zh' ? '向上' : 'Move up'}>↑</button>
          <button type="button" {...bindPointer('left')} aria-label={locale === 'zh' ? '向左' : 'Move left'}>←</button>
          <button type="button" {...bindPointer('down')} aria-label={locale === 'zh' ? '向下' : 'Move down'}>↓</button>
          <button type="button" {...bindPointer('right')} aria-label={locale === 'zh' ? '向右' : 'Move right'}>→</button>
        </div>
        <button className="arcade-fire" type="button" {...bindPointer('fire')} aria-label={locale === 'zh' ? '射击' : 'Fire'}>
          <Crosshair size={22} />
          <span>FIRE</span>
        </button>
      </div>
      <div className="arcade-contract-strip">
        <span>AXIRUNE / WAVE {contract.wave}</span>
        <strong>{contract.threat.toUpperCase()}</strong>
        <span>V {Math.round(contract.enemySpeed)}</span>
        <span>HP {contract.enemyHealth}</span>
        <span>BASE {contract.scorePerHit}</span>
      </div>
    </div>
  )

  function restartAndBegin() {
    startedRef.current = true
    setStarted(true)
    effectsRef.current = []
    destroyedRef.current = 0
    engineRef.current = createTunedShooter(contractRef.current)
    setHud(engineRef.current.snapshot())
    paintRequestedRef.current = true
    focusGame()
  }

  function focusGame() {
    requestAnimationFrame(() => gameRef.current?.focus({ preventScroll: true }))
  }
}

function createTunedShooter(contract: VectorContract): ShooterEngine {
  return createShooterEngine({
    seed: 0xa817_2026,
    config: shooterConfig(contract),
  })
}

function shooterConfig(contract: VectorContract) {
  return {
    enemyHorizontalSpeed: contract.enemySpeed,
    enemyFireIntervalTicks: Math.max(36, Math.round((contract.spawnIntervalMs / 1_000) * 120)),
    betweenWaveTicks: Math.max(30, Math.round((contract.spawnIntervalMs / 1_000) * 60)),
    baseEnemiesPerWave: Math.min(7, 3 + contract.wingmen),
    maxEnemiesPerWave: Math.min(12, 8 + contract.wingmen),
  }
}

function tuneShooter(engine: ShooterEngine, contract: VectorContract, tuneEnemies = false): ShooterEngine {
  const snapshot = engine.snapshot()
  const previousEnemySpeed = snapshot.config.enemyHorizontalSpeed
  Object.assign(snapshot.config, shooterConfig(contract))
  if (tuneEnemies) {
    const multipliers: Record<EnemyState['kind'], number> = { scout: 1, striker: 1.6, bulwark: 2.5 }
    const speedRatio = contract.enemySpeed / Math.max(1, previousEnemySpeed)
    for (const enemy of snapshot.enemies) {
      enemy.velocityX *= speedRatio
      const targetHealth = Math.max(enemy.maxHealth, contract.enemyHealth + (enemy.kind === 'bulwark' ? 1 : 0))
      enemy.health += targetHealth - enemy.maxHealth
      enemy.maxHealth = targetHealth
      enemy.scoreValue = Math.round(contract.scorePerHit * multipliers[enemy.kind])
    }
  }
  return ShooterEngine.fromSnapshot(snapshot)
}

function inputControl(key: string): keyof Required<ShooterInput> | null {
  switch (key.toLowerCase()) {
    case 'arrowleft': case 'a': return 'left'
    case 'arrowright': case 'd': return 'right'
    case 'arrowup': case 'w': return 'up'
    case 'arrowdown': case 's': return 'down'
    case ' ': case 'spacebar': return 'fire'
    default: return null
  }
}

function shooterStatusLabel(status: ShooterSnapshot['status'], locale: Locale) {
  if (locale === 'zh') return status === 'running' ? '运行中' : status === 'paused' ? '已暂停' : '任务结束'
  return status === 'running' ? 'running' : status === 'paused' ? 'paused' : 'mission over'
}

function drawVectorSiege(
  canvas: HTMLCanvasElement | null,
  background: HTMLImageElement | null,
  snapshot: ShooterSnapshot,
  bursts: readonly Burst[],
  now: number,
) {
  if (!canvas) return
  const context = canvas.getContext('2d')
  if (!context) return
  const scale = canvas.width / snapshot.config.worldWidth
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.clearRect(0, 0, snapshot.config.worldWidth, snapshot.config.worldHeight)

  if (background?.complete) drawCover(context, background, snapshot.config.worldWidth, snapshot.config.worldHeight)
  else {
    const fallback = context.createLinearGradient(0, 0, 0, snapshot.config.worldHeight)
    fallback.addColorStop(0, '#071d2c')
    fallback.addColorStop(1, '#040a0e')
    context.fillStyle = fallback
    context.fillRect(0, 0, snapshot.config.worldWidth, snapshot.config.worldHeight)
  }
  context.fillStyle = 'rgba(1, 8, 12, 0.3)'
  context.fillRect(0, 0, snapshot.config.worldWidth, snapshot.config.worldHeight)

  drawStarLattice(context, snapshot.tick, snapshot.config.worldWidth, snapshot.config.worldHeight)
  for (const bullet of snapshot.bullets) drawBullet(context, bullet)
  for (const enemy of snapshot.enemies) drawEnemy(context, enemy, now)
  drawPlayer(context, snapshot.player.x, snapshot.player.y, snapshot.player.width, snapshot.player.height, now)
  drawBursts(context, bursts)
  drawScanlines(context, snapshot.config.worldWidth, snapshot.config.worldHeight)
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const targetRatio = width / height
  const sourceRatio = image.naturalWidth / image.naturalHeight
  if (sourceRatio > targetRatio) {
    const sourceWidth = image.naturalHeight * targetRatio
    context.drawImage(image, (image.naturalWidth - sourceWidth) / 2, 0, sourceWidth, image.naturalHeight, 0, 0, width, height)
  } else {
    const sourceHeight = image.naturalWidth / targetRatio
    context.drawImage(image, 0, (image.naturalHeight - sourceHeight) / 2, image.naturalWidth, sourceHeight, 0, 0, width, height)
  }
}

function drawStarLattice(context: CanvasRenderingContext2D, tick: number, width: number, height: number) {
  context.save()
  context.globalCompositeOperation = 'screen'
  for (let index = 0; index < 36; index += 1) {
    const x = ((index * 97 + 31) % 359) / 359 * width
    const y = ((index * 53 + tick * (1 + index % 3) * 0.16) % 640) / 640 * height
    const alpha = 0.16 + (index % 5) * 0.06
    context.fillStyle = `rgba(120, 236, 255, ${alpha})`
    context.fillRect(x, y, index % 4 === 0 ? 1.4 : 0.7, index % 4 === 0 ? 5 : 2)
  }
  context.restore()
}

function drawPlayer(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, now: number) {
  const cx = x + width / 2
  const pulse = 0.75 + Math.sin(now * 0.012) * 0.2
  context.save()
  context.translate(cx, y + height / 2)
  context.shadowColor = '#bdf765'
  context.shadowBlur = 13
  context.fillStyle = `rgba(189, 247, 101, ${pulse})`
  context.beginPath(); context.moveTo(-8, height / 2 - 2); context.lineTo(-3, height / 2 + 15); context.lineTo(0, height / 2 - 1); context.fill()
  context.beginPath(); context.moveTo(8, height / 2 - 2); context.lineTo(3, height / 2 + 15); context.lineTo(0, height / 2 - 1); context.fill()
  context.shadowBlur = 8
  const hull = context.createLinearGradient(0, -height / 2, 0, height / 2)
  hull.addColorStop(0, '#e9fbff'); hull.addColorStop(0.48, '#51d7eb'); hull.addColorStop(1, '#132c38')
  context.fillStyle = hull
  context.strokeStyle = '#bdf765'
  context.lineWidth = 1
  context.beginPath(); context.moveTo(0, -height / 2); context.lineTo(7, -7); context.lineTo(width / 2, 7); context.lineTo(11, height / 2 - 4); context.lineTo(0, 11); context.lineTo(-11, height / 2 - 4); context.lineTo(-width / 2, 7); context.lineTo(-7, -7); context.closePath(); context.fill(); context.stroke()
  context.fillStyle = '#071b28'; context.beginPath(); context.moveTo(0, -11); context.lineTo(5, 1); context.lineTo(0, 8); context.lineTo(-5, 1); context.closePath(); context.fill()
  context.fillStyle = '#ff7c6b'; context.fillRect(-1, -8, 2, 8)
  context.restore()
}

function drawEnemy(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  const cx = enemy.x + enemy.width / 2
  const cy = enemy.y + enemy.height / 2
  const color = enemy.kind === 'scout' ? '#66eaff' : enemy.kind === 'striker' ? '#ff8b79' : '#c9ff6d'
  context.save(); context.translate(cx, cy); context.shadowColor = color; context.shadowBlur = 8
  const gradient = context.createLinearGradient(0, -enemy.height / 2, 0, enemy.height / 2)
  gradient.addColorStop(0, color); gradient.addColorStop(0.52, '#183b49'); gradient.addColorStop(1, '#071218')
  context.fillStyle = gradient; context.strokeStyle = color; context.lineWidth = enemy.kind === 'bulwark' ? 1.5 : 1
  if (enemy.kind === 'scout') {
    context.beginPath(); context.moveTo(0, enemy.height / 2); context.lineTo(enemy.width / 2, -enemy.height / 2); context.lineTo(0, -4); context.lineTo(-enemy.width / 2, -enemy.height / 2); context.closePath()
  } else if (enemy.kind === 'striker') {
    context.beginPath(); context.moveTo(0, enemy.height / 2); context.lineTo(enemy.width / 2, 2); context.lineTo(enemy.width * 0.35, -enemy.height / 2); context.lineTo(0, -7); context.lineTo(-enemy.width * 0.35, -enemy.height / 2); context.lineTo(-enemy.width / 2, 2); context.closePath()
  } else {
    context.beginPath(); context.moveTo(0, enemy.height / 2); context.lineTo(enemy.width / 2, enemy.height * 0.2); context.lineTo(enemy.width * 0.42, -enemy.height * 0.42); context.lineTo(0, -enemy.height / 2); context.lineTo(-enemy.width * 0.42, -enemy.height * 0.42); context.lineTo(-enemy.width / 2, enemy.height * 0.2); context.closePath()
  }
  context.fill(); context.stroke()
  context.rotate(now * 0.001 + enemy.id)
  context.fillStyle = '#061117'; context.fillRect(-4, -4, 8, 8)
  context.fillStyle = color; context.fillRect(-1.5, -1.5, 3, 3)
  context.restore()
}

function drawBullet(context: CanvasRenderingContext2D, bullet: ShooterSnapshot['bullets'][number]) {
  const color = bullet.owner === 'player' ? '#bdf765' : '#ff7c6b'
  context.save(); context.shadowColor = color; context.shadowBlur = 9; context.fillStyle = color
  context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)
  context.fillStyle = '#ffffff'; context.fillRect(bullet.x + bullet.width * 0.35, bullet.y, bullet.width * 0.3, bullet.height)
  context.restore()
}

function addBurst(bursts: Burst[], x: number, y: number, color: string, seed: number) {
  for (let index = 0; index < 20; index += 1) {
    const angle = ((index * 137.5 + seed * 19) * Math.PI) / 180
    const speed = 34 + ((index * 23 + seed) % 58)
    const life = 0.34 + (index % 6) * 0.055
    bursts.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: 1 + index % 3 })
  }
}

function updateBursts(bursts: Burst[], delta: number) {
  for (const burst of bursts) {
    burst.x += burst.vx * delta
    burst.y += burst.vy * delta
    burst.vy += 32 * delta
    burst.life -= delta
  }
  for (let index = bursts.length - 1; index >= 0; index -= 1) if (bursts[index]!.life <= 0) bursts.splice(index, 1)
}

function drawBursts(context: CanvasRenderingContext2D, bursts: readonly Burst[]) {
  context.save(); context.globalCompositeOperation = 'screen'
  for (const burst of bursts) {
    context.globalAlpha = Math.max(0, burst.life / burst.maxLife)
    context.shadowColor = burst.color; context.shadowBlur = 8; context.fillStyle = burst.color
    context.fillRect(burst.x, burst.y, burst.size, burst.size * 2.3)
  }
  context.restore()
}

function drawScanlines(context: CanvasRenderingContext2D, width: number, height: number) {
  context.save(); context.globalAlpha = 0.08; context.fillStyle = '#031016'
  for (let y = 0; y < height; y += 4) context.fillRect(0, y, width, 1)
  const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.1, width / 2, height / 2, height * 0.7)
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,5,8,0.62)')
  context.globalAlpha = 1; context.fillStyle = vignette; context.fillRect(0, 0, width, height); context.restore()
}
