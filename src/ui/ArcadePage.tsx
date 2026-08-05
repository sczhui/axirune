import {
  Box,
  Check,
  Code2,
  Cpu,
  Gamepad2,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import prismRules from '../../apps/arcade/prism-break.axi?raw'
import vectorRules from '../../apps/arcade/vector-siege.axi?raw'
import {
  createAxiruneRuleModule,
  type AxiruneRuleModule,
} from '../arcade/axirune-rule-module'
import type { RuntimeValue } from '../language'
import type { Locale } from '../content/site'
import { CodeEditor } from './CodeEditor'
import { ClassicVault } from './arcade/ClassicVault'
import { PrismBastionGame } from './arcade/PrismBastionGame'
import { RiverOathShowcase } from './arcade/RiverOathShowcase'
import { VectorSiegeGame } from './arcade/VectorSiegeGame'
import './arcade.css'

type ArcadeGameId = 'vector-siege' | 'prism-bastion'

export type VectorContract = {
  schema: 'axirune-arcade/vector-siege/1'
  wave: number
  destroyed: number
  enemySpeed: number
  spawnIntervalMs: number
  enemyHealth: number
  scorePerHit: number
  wingmen: number
  threat: 'stable' | 'elevated' | 'critical'
}

export type PrismContract = {
  schema: 'axirune-arcade/prism-break/1'
  level: number
  cleared: number
  ballSpeed: number
  paddleWidth: number
  brickValue: number
  armoredEvery: number
  pulse: 'nominal' | 'charged' | 'overdrive'
}

type GameContract = VectorContract | PrismContract

type RuntimeEvidence = {
  contentId: string
  semanticDigest: string
  capsuleBytes: number
  traceLength: number
}

class SupersededRuleEvaluation extends Error {}

type ArcadeGameDefinition = {
  id: ArcadeGameId
  index: string
  title: string
  subtitle: Record<Locale, string>
  description: Record<Locale, string>
  source: string
  sourceName: string
  art: string
  cadence: string
  tags: string[]
}

const games: ArcadeGameDefinition[] = [
  {
    id: 'vector-siege',
    index: '01',
    title: 'VECTOR SIEGE',
    subtitle: { zh: '矢量防线', en: 'Vector defense' },
    description: {
      zh: '原创纵向射击。Axirune 计算波次、敌速、装甲、编队与计分合同；确定性 60Hz 引擎执行物理和碰撞。',
      en: 'An original vertical shooter. Axirune computes wave, speed, armor, formation, and scoring contracts; a deterministic 60 Hz engine executes physics and collisions.',
    },
    source: vectorRules,
    sourceName: 'vector-siege.axi',
    art: '/arcade/vector-siege-bg.jpg',
    cadence: '60 HZ FIXED STEP',
    tags: ['WAVES', 'COMBO', 'SEEDED RNG'],
  },
  {
    id: 'prism-bastion',
    index: '02',
    title: 'PRISM BASTION',
    subtitle: { zh: '棱镜堡垒', en: 'Prismatic breaker' },
    description: {
      zh: '原创棱镜破坏游戏。Axirune 决定球速、球拍宽度、砖块价值与装甲密度；120Hz 子步处理高速碰撞和连锁爆破。',
      en: 'An original prismatic breaker. Axirune decides ball speed, paddle width, brick value, and armor density; 120 Hz substeps handle fast collisions and chain bursts.',
    },
    source: prismRules,
    sourceName: 'prism-break.axi',
    art: '/arcade/prism-break-bg.jpg',
    cadence: '120 HZ FIXED STEP',
    tags: ['3 LEVELS', 'NOVA CHAIN', 'REPLAY'],
  },
]

export function ArcadePage({ locale }: { locale: Locale }) {
  const [activeId, setActiveId] = useState<ArcadeGameId>('vector-siege')
  const selected = games.find((game) => game.id === activeId) ?? games[0]!

  const openFlagship = (id: ArcadeGameId) => {
    setActiveId(id)
    window.requestAnimationFrame(() => {
      document.getElementById('flagship-cabinets')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="arcade-page">
      <section className="arcade-hero">
        <img src="/arcade/river-oath/river-oath-key-art.jpg" alt="" aria-hidden="true" />
        <div className="arcade-hero__scrim" />
        <div className="arcade-hero__copy">
          <span className="arcade-kicker">
            <Gamepad2 size={14} /> AXIRUNE ARCADE / 0.6 ALPHA 1
          </span>
          <h1>
            {locale === 'zh' ? '二十一款原创作品。' : 'TWENTY-ONE ORIGINAL WORLDS.'}
            <strong>{locale === 'zh' ? '一部四幕动作战役。' : 'ONE FOUR-ACT ACTION CAMPAIGN.'}</strong>
            {locale === 'zh' ? '规则可编译。' : 'RULES COMPILE.'}
          </h1>
          <p>
            {locale === 'zh'
              ? 'River Oath 带来三英雄、十二场遭遇与四位独立 Boss；Classic Vault 保留二十款短篇作品。全部采用原创美术、确定性状态和真正参与战斗调度的 Axirune 程序。'
              : 'River Oath brings three heroes, twelve encounters, and four distinct bosses; Classic Vault retains twenty compact worlds. Every work uses original art, deterministic state, and Axirune programs that genuinely schedule combat.'}
          </p>
          <div className="arcade-hero__facts">
            <span><strong>21</strong>{locale === 'zh' ? '可玩作品' : 'PLAYABLE WORKS'}</span>
            <span><strong>.AXC</strong>{locale === 'zh' ? '规则胶囊' : 'RULE CAPSULES'}</span>
            <span><strong>∅</strong>{locale === 'zh' ? '外部权限' : 'EXTERNAL AUTHORITY'}</span>
          </div>
        </div>
        <div className="arcade-hero__seal" aria-hidden="true">
          <ShieldCheck size={24} />
          <span>ORIGINAL IP</span>
          <small>NO ROM · NO MODEL</small>
        </div>
      </section>

      <RiverOathShowcase locale={locale} />

      <ClassicVault locale={locale} onOpenFlagship={openFlagship} />

      <div id="flagship-cabinets" className="arcade-featured">
        <div className="arcade-featured__head">
          <span className="arcade-kicker"><Sparkles size={14} /> 03 / SPECIALIST CABINETS</span>
          <h2>{locale === 'zh' ? '两台专门机制引擎' : 'TWO SPECIALIST ENGINES'}</h2>
          <p>{locale === 'zh' ? '在主线战役之外，继续体验波次射击与 120Hz 棱镜物理；两者保留独立状态机、关卡和源码实验台。' : 'Beyond the story campaign, play wave combat and 120 Hz prism physics, each retaining its own state machine, stages, and source laboratory.'}</p>
        </div>
        <section className="arcade-selector" aria-label={locale === 'zh' ? '选择旗舰游戏' : 'Choose a flagship game'}>
          {games.map((game) => (
            <button
              key={game.id}
              type="button"
              className={activeId === game.id ? 'is-active' : ''}
              onClick={() => setActiveId(game.id)}
              aria-pressed={activeId === game.id}
            >
              <span>{game.index}</span>
              <div>
                <strong>{game.title}</strong>
                <small>{game.subtitle[locale]}</small>
              </div>
              <i>{game.cadence}</i>
            </button>
          ))}
        </section>

        <ArcadeExperience key={selected.id} game={selected} locale={locale} />
      </div>

      <section className="arcade-principles">
        <article>
          <Cpu size={22} />
          <span>01 / LANGUAGE</span>
          <h2>{locale === 'zh' ? 'Axirune 决定规则合同' : 'Axirune decides the rule contract'}</h2>
          <p>{locale === 'zh' ? '难度参数来自受检 IR，而不是藏在组件常量里。编辑源码后必须重新生成并验证胶囊。' : 'Difficulty parameters come from checked IR, not hidden component constants. Edited source must produce and verify a new capsule.'}</p>
        </article>
        <article>
          <Box size={22} />
          <span>02 / HOST</span>
          <h2>{locale === 'zh' ? '浏览器执行确定性物理' : 'The browser executes deterministic physics'}</h2>
          <p>{locale === 'zh' ? '固定步进、Seed RNG、快照与回放保证相同输入得到相同状态；Canvas 只呈现结果。' : 'Fixed steps, seeded RNG, snapshots, and replay keep identical inputs deterministic; Canvas only presents the result.'}</p>
        </article>
        <article>
          <ShieldCheck size={22} />
          <span>03 / AUTHORITY</span>
          <h2>{locale === 'zh' ? '游戏不能偷偷获得能力' : 'Games cannot acquire hidden authority'}</h2>
          <p>{locale === 'zh' ? '启动前检查 capabilities、tools、permissions 与 sandbox 清单均为空；无网络、文件、MCP 或模型调用。' : 'Startup requires empty capability, tool, permission, and sandbox manifests—no network, files, MCP, or model calls.'}</p>
        </article>
      </section>
    </div>
  )
}

function ArcadeExperience({ game, locale }: { game: ArcadeGameDefinition; locale: Locale }) {
  const [source, setSource] = useState(game.source)
  const [contract, setContract] = useState<GameContract | null>(null)
  const [evidence, setEvidence] = useState<RuntimeEvidence | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [revision, setRevision] = useState(0)
  const moduleRef = useRef<AxiruneRuleModule | null>(null)
  const buildSequence = useRef(0)

  const validate = useCallback(
    (value: RuntimeValue): GameContract =>
      game.id === 'vector-siege' ? validateVectorContract(value) : validatePrismContract(value),
    [game.id],
  )

  const buildRules = useCallback(async (nextSource: string) => {
    const sequence = ++buildSequence.current
    setBuilding(true)
    setError(null)
    try {
      const module = await createAxiruneRuleModule(nextSource)
      const firstInput: Readonly<Record<string, RuntimeValue>> = game.id === 'vector-siege'
        ? { wave: 1, destroyed: 0, combo: 0 }
        : { level: 1, cleared: 0, combo: 0 }
      const result = await module.run(firstInput)
      const nextContract = validate(result.value)
      if (sequence !== buildSequence.current) return
      moduleRef.current = module
      setContract(nextContract)
      setEvidence({
        contentId: module.contentId,
        semanticDigest: module.semanticDigest,
        capsuleBytes: module.capsuleBytes,
        traceLength: result.traceLength,
      })
      setDirty(false)
      setRevision((value) => value + 1)
    } catch (buildError) {
      if (sequence !== buildSequence.current) return
      setError(buildError instanceof Error ? buildError.message : String(buildError))
    } finally {
      if (sequence === buildSequence.current) setBuilding(false)
    }
  }, [game.id, validate])

  useEffect(() => {
    void buildRules(game.source)
  }, [buildRules, game.source])

  const evaluate = useCallback(async (input: Readonly<Record<string, RuntimeValue>>) => {
    const generation = buildSequence.current
    try {
      const module = moduleRef.current
      if (!module) throw new Error('Rule capsule is not ready.')
      const result = await module.run(input)
      if (generation !== buildSequence.current || module !== moduleRef.current) {
        throw new SupersededRuleEvaluation()
      }
      const nextContract = validate(result.value)
      setContract(nextContract)
      setEvidence((current) => current ? { ...current, traceLength: result.traceLength } : current)
      setError(null)
      return nextContract
    } catch (runError) {
      if (!(runError instanceof SupersededRuleEvaluation)) {
        setError(runError instanceof Error ? runError.message : String(runError))
      }
      throw runError
    }
  }, [validate])

  const resetSource = () => {
    setSource(game.source)
    setDirty(false)
    void buildRules(game.source)
  }

  return (
    <section className="arcade-experience">
      <div className="arcade-experience__head">
        <div>
          <span className="arcade-kicker">{game.index} / PLAYABLE DEMO</span>
          <h2>{game.title}</h2>
          <strong>{game.subtitle[locale]}</strong>
        </div>
        <p>{game.description[locale]}</p>
        <div className="arcade-tag-row">
          {game.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </div>

      <div className="arcade-machine">
        <div className="arcade-machine__stage">
          {contract ? (
            game.id === 'vector-siege' ? (
              <VectorSiegeGame
                key={revision}
                locale={locale}
                contract={contract as VectorContract}
                art={game.art}
                evaluateRules={evaluate as (input: Readonly<Record<string, RuntimeValue>>) => Promise<VectorContract>}
              />
            ) : (
              <PrismBastionGame
                key={revision}
                locale={locale}
                contract={contract as PrismContract}
                art={game.art}
                evaluateRules={evaluate as (input: Readonly<Record<string, RuntimeValue>>) => Promise<PrismContract>}
              />
            )
          ) : (
            <div className="arcade-machine__loading">
              <LoaderCircle className="spin" size={28} />
              <strong>{locale === 'zh' ? '正在验证规则胶囊' : 'VERIFYING RULE CAPSULE'}</strong>
              <span>CREATE → VERIFY → AUTHORITY CHECK</span>
            </div>
          )}
        </div>

        <aside className="arcade-rule-studio" aria-label="Axirune rule studio">
          <div className="arcade-rule-studio__bar">
            <div>
              <Code2 size={14} />
              <strong>{game.sourceName}</strong>
            </div>
            <span className={error ? 'is-error' : dirty ? 'is-dirty' : 'is-verified'}>
              {building ? <LoaderCircle className="spin" size={11} /> : error ? '!' : dirty ? '●' : <Check size={11} />}
              {building ? 'BUILDING' : error ? 'REJECTED' : dirty ? 'UNBUILT EDIT' : 'AXC VERIFIED'}
            </span>
          </div>
          <CodeEditor
            value={source}
            onChange={(value) => {
              setSource(value)
              setDirty(true)
            }}
            minHeight={470}
          />
          <div className="arcade-rule-studio__actions">
            <button type="button" onClick={() => void buildRules(source)} disabled={building || !dirty}>
              {building ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />}
              {locale === 'zh' ? '生成并应用 .axc' : 'Build & apply .axc'}
            </button>
            <button type="button" onClick={resetSource} disabled={building} aria-label={locale === 'zh' ? '重置规则源码' : 'Reset rule source'}>
              <RotateCcw size={14} />
            </button>
          </div>
          {error ? <p className="arcade-rule-studio__error">{error}</p> : null}
          <div className="arcade-evidence">
            <div className="arcade-evidence__title">
              <Sparkles size={14} />
              <span>VERIFICATION EVIDENCE</span>
            </div>
            <dl>
              <div><dt>CONTENT ID</dt><dd>{shortHash(evidence?.contentId)}</dd></div>
              <div><dt>SEMANTIC</dt><dd>{shortHash(evidence?.semanticDigest)}</dd></div>
              <div><dt>CAPSULE</dt><dd>{evidence ? `${evidence.capsuleBytes.toLocaleString()} B` : '—'}</dd></div>
              <div><dt>AUTHORITY</dt><dd className="is-empty">∅</dd></div>
              <div><dt>TRACE</dt><dd>{evidence ? `${evidence.traceLength} EVENTS` : '—'}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  )
}

function validateVectorContract(value: RuntimeValue): VectorContract {
  const record = asRecord(value, 'Vector Siege rules')
  const threat = enumValue(record.threat, ['stable', 'elevated', 'critical'] as const, 'threat')
  if (record.schema !== 'axirune-arcade/vector-siege/1') throw new Error('Vector Siege rule schema is invalid.')
  return {
    schema: record.schema,
    wave: integer(record.wave, 1, 99, 'wave'),
    destroyed: integer(record.destroyed, 0, 1_000_000, 'destroyed'),
    enemySpeed: finiteNumber(record.enemy_speed, 20, 300, 'enemy_speed'),
    spawnIntervalMs: integer(record.spawn_interval_ms, 200, 5_000, 'spawn_interval_ms'),
    enemyHealth: integer(record.enemy_health, 1, 12, 'enemy_health'),
    scorePerHit: integer(record.score_per_hit, 1, 1_000_000, 'score_per_hit'),
    wingmen: integer(record.wingmen, 0, 6, 'wingmen'),
    threat,
  }
}

function validatePrismContract(value: RuntimeValue): PrismContract {
  const record = asRecord(value, 'Prism Bastion rules')
  const pulse = enumValue(record.pulse, ['nominal', 'charged', 'overdrive'] as const, 'pulse')
  if (record.schema !== 'axirune-arcade/prism-break/1') throw new Error('Prism Bastion rule schema is invalid.')
  return {
    schema: record.schema,
    level: integer(record.level, 1, 20, 'level'),
    cleared: integer(record.cleared, 0, 10_000, 'cleared'),
    ballSpeed: finiteNumber(record.ball_speed, 180, 720, 'ball_speed'),
    paddleWidth: finiteNumber(record.paddle_width, 72, 220, 'paddle_width'),
    brickValue: integer(record.brick_value, 1, 1_000_000, 'brick_value'),
    armoredEvery: integer(record.armored_every, 2, 20, 'armored_every'),
    pulse,
  }
}

function asRecord(value: RuntimeValue, label: string): Record<string, RuntimeValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must yield a Record.`)
  }
  return value as Record<string, RuntimeValue>
}

function finiteNumber(value: RuntimeValue | undefined, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be a finite Number between ${min} and ${max}.`)
  }
  return value
}

function integer(value: RuntimeValue | undefined, min: number, max: number, label: string): number {
  const number = finiteNumber(value, min, max, label)
  if (!Number.isSafeInteger(number)) throw new Error(`${label} must be an integer.`)
  return number
}

function enumValue<const Values extends readonly string[]>(
  value: RuntimeValue | undefined,
  allowed: Values,
  label: string,
): Values[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`${label} must be one of ${allowed.join(', ')}.`)
  }
  return value
}

function shortHash(value: string | undefined): string {
  if (!value) return '—'
  return value.length > 28 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value
}
