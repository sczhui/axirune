import {
  Check,
  Code2,
  Gamepad2,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Swords,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import riverOathSource from '../../../apps/arcade/river-oath.axi?raw'
import {
  createAxiruneRuleModule,
  type AxiruneRuleModule,
} from '../../arcade/axirune-rule-module'
import type { RuntimeValue } from '../../language'
import type { Locale } from '../../content/site'
import { CodeEditor } from '../CodeEditor'
import {
  RiverOathGame,
  type RiverOathRuleContract,
  type RiverOathRuleQuery,
} from './RiverOathGame'
import './river-oath.css'

type RuntimeEvidence = {
  readonly contentId: string
  readonly semanticDigest: string
  readonly capsuleBytes: number
  readonly traceLength: number
}

class SupersededRiverOathEvaluation extends Error {}

export function RiverOathShowcase({ locale }: { locale: Locale }) {
  const [source, setSource] = useState(riverOathSource)
  const [contract, setContract] = useState<RiverOathRuleContract | null>(null)
  const [evidence, setEvidence] = useState<RuntimeEvidence | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [revision, setRevision] = useState(0)
  const moduleRef = useRef<AxiruneRuleModule | null>(null)
  const buildSequenceRef = useRef(0)

  const buildRules = useCallback(async (nextSource: string) => {
    const sequence = ++buildSequenceRef.current
    setBuilding(true)
    setError(null)
    try {
      const module = await createAxiruneRuleModule(nextSource)
      const result = await module.run({ stage: 1, wave: 1, defeated: 0, combo: 0 })
      const nextContract = validateRiverOathRuleContract(result.value)
      if (sequence !== buildSequenceRef.current) return
      moduleRef.current = module
      setContract(nextContract)
      setEvidence({
        contentId: module.contentId,
        semanticDigest: module.semanticDigest,
        capsuleBytes: module.capsuleBytes,
        traceLength: result.traceLength,
      })
      setRevision((current) => current + 1)
      setDirty(false)
    } catch (buildError) {
      if (sequence !== buildSequenceRef.current) return
      setError(buildError instanceof Error ? buildError.message : String(buildError))
    } finally {
      if (sequence === buildSequenceRef.current) setBuilding(false)
    }
  }, [])

  useEffect(() => {
    void buildRules(riverOathSource)
  }, [buildRules])

  const evaluateRules = useCallback(async (query: RiverOathRuleQuery) => {
    const sequence = buildSequenceRef.current
    const module = moduleRef.current
    if (!module) throw new Error('River Oath rule capsule is not ready.')
    try {
      const result = await module.run(query as unknown as Readonly<Record<string, RuntimeValue>>)
      if (sequence !== buildSequenceRef.current || module !== moduleRef.current) {
        throw new SupersededRiverOathEvaluation()
      }
      const nextContract = validateRiverOathRuleContract(result.value)
      setContract(nextContract)
      setEvidence((current) => current ? { ...current, traceLength: result.traceLength } : current)
      setError(null)
      return nextContract
    } catch (runError) {
      if (!(runError instanceof SupersededRiverOathEvaluation)) {
        setError(runError instanceof Error ? runError.message : String(runError))
      }
      throw runError
    }
  }, [])

  const resetSource = () => {
    setSource(riverOathSource)
    setDirty(false)
    void buildRules(riverOathSource)
  }

  return (
    <section className="river-oath-showcase" aria-labelledby="river-oath-title" data-testid="river-oath-showcase">
      <header className="river-oath-showcase__hero">
        <div className="river-oath-showcase__hero-art" aria-hidden="true" />
        <div className="river-oath-showcase__hero-shade" aria-hidden="true" />
        <div className="river-oath-showcase__hero-copy">
          <span><Swords size={15} /> AXIRUNE ORIGINAL FLAGSHIP / 21</span>
          <h2 id="river-oath-title">RIVER <i>OATH</i></h2>
          <strong>{locale === 'zh' ? '河山之誓：初举义旗' : 'THE FIRST BANNER'}</strong>
          <p>
            {locale === 'zh'
              ? '四幕原创历史幻想战役，三位英雄，十二场遭遇。规则由 Axirune 编译为受检胶囊；浏览器中的确定性 60 Hz 引擎负责碰撞、连击和关卡状态。'
              : 'Four original historical-fantasy acts, three heroes, twelve encounters. Axirune compiles the rules into a verified capsule; a deterministic 60 Hz browser host owns collision, combos, and campaign state.'}
          </p>
          <div className="river-oath-showcase__facts">
            <span><b>04</b>{locale === 'zh' ? '原创场景' : 'ORIGINAL ACTS'}</span>
            <span><b>12</b>{locale === 'zh' ? '战斗波次' : 'ENCOUNTERS'}</span>
            <span><b>03</b>{locale === 'zh' ? '可选英雄' : 'HEROES'}</span>
            <span><b>60</b>{locale === 'zh' ? '固定帧率' : 'FIXED HZ'}</span>
          </div>
        </div>
        <div className="river-oath-showcase__original-mark">
          <ShieldCheck size={18} /><strong>ORIGINAL</strong><span>NO ROM · NO MODEL · NO NETWORK</span>
        </div>
      </header>

      <div className="river-oath-showcase__disclosure">
        <ShieldCheck size={18} />
        <p>
          <strong>{locale === 'zh' ? '这是原创作品，不是商业游戏复刻。' : 'This is an original work, not a commercial-game reproduction.'}</strong>
          {locale === 'zh'
            ? ' 人物、名称、场景、关卡、美术与程序均为 River Oath 原创；不含 ROM、受保护角色、提取素材或外部运行服务。'
            : ' Characters, names, scenes, levels, art, and programs are original to River Oath; it contains no ROM, protected characters, extracted assets, or external runtime service.'}
        </p>
      </div>

      <div className="river-oath-showcase__machine">
        {contract ? (
          <RiverOathGame
            locale={locale}
            contract={contract}
            revision={revision}
            evaluateRules={evaluateRules}
          />
        ) : (
          <div className="river-oath-showcase__loading">
            <LoaderCircle className="spin" size={32} />
            <strong>{locale === 'zh' ? '正在铸造战役规则' : 'FORGING CAMPAIGN RULES'}</strong>
            <span>PARSE → COMPILE → VERIFY → RUN / ZERO AUTHORITY</span>
            {error ? <p role="alert">{error}</p> : null}
          </div>
        )}
      </div>

      <div className="river-oath-lab">
        <div className="river-oath-lab__story">
          <span>RULES AS A REAL PROGRAM</span>
          <h3>{locale === 'zh' ? '战斗规则可读、可编译、可验证。' : 'COMBAT RULES YOU CAN READ, COMPILE, AND VERIFY.'}</h3>
          <p>
            {locale === 'zh'
              ? '源码不是提示词，也不是装饰性配置。它通过真实 Axirune 解析器、编译器和胶囊验证器执行，输出经过合同范围检查后，在下一波敌军入场时映射为引擎参数。'
              : 'This source is neither a prompt nor decorative config. It runs through the real Axirune parser, compiler, and capsule verifier; its range-checked contract maps proportionally onto engine parameters when the next wave enters.'}
          </p>
          <ol>
            <li><i>01</i><div><strong>PURE RULE SPACE</strong><span>{locale === 'zh' ? '零工具、零权限、零网络。' : 'No tools, permissions, or network.'}</span></div></li>
            <li><i>02</i><div><strong>VERIFIED .AXC</strong><span>{locale === 'zh' ? '摘要、ABI 与 authority 独立复核。' : 'Digest, ABI, and authority are independently checked.'}</span></div></li>
            <li><i>03</i><div><strong>WAVE BOUNDARY</strong><span>{locale === 'zh' ? '规则仅在清晰的波次边界应用。' : 'Rules apply only at explicit wave boundaries.'}</span></div></li>
          </ol>
        </div>

        <article className="river-oath-studio" aria-label="River Oath Axirune rule studio">
          <div className="river-oath-studio__bar">
            <div><Code2 size={14} /><strong>river-oath.axi</strong></div>
            <span className={error ? 'is-error' : dirty ? 'is-dirty' : 'is-verified'}>
              {building ? <LoaderCircle className="spin" size={11} /> : error ? '!' : dirty ? '●' : <Check size={11} />}
              {building ? 'BUILDING' : error ? 'REJECTED' : dirty ? 'UNBUILT EDIT' : 'AXC VERIFIED'}
            </span>
          </div>
          <CodeEditor
            value={source}
            onChange={(value) => { setSource(value); setDirty(true) }}
            minHeight={520}
            label={locale === 'zh' ? 'River Oath Axirune 规则源码编辑器' : 'River Oath Axirune rule source editor'}
          />
          <div className="river-oath-studio__actions">
            <button type="button" onClick={() => void buildRules(source)} disabled={building || !dirty}>
              {building ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />}
              {locale === 'zh' ? '生成并排队应用 .axc' : 'BUILD & QUEUE .AXC'}
            </button>
            <button type="button" onClick={resetSource} disabled={building} aria-label={locale === 'zh' ? '重置规则源码' : 'Reset rule source'}><RotateCcw size={14} /></button>
          </div>
          {error ? <p className="river-oath-studio__error" role="alert">{error}</p> : null}
          <div className="river-oath-evidence">
            <div><Sparkles size={14} /><strong>VERIFICATION EVIDENCE</strong></div>
            <dl>
              <div><dt>CONTENT ID</dt><dd>{shortHash(evidence?.contentId)}</dd></div>
              <div><dt>SEMANTIC</dt><dd>{shortHash(evidence?.semanticDigest)}</dd></div>
              <div><dt>CAPSULE</dt><dd>{evidence ? `${evidence.capsuleBytes.toLocaleString()} B` : '—'}</dd></div>
              <div><dt>TRACE</dt><dd>{evidence ? `${evidence.traceLength} EVENTS` : '—'}</dd></div>
              <div><dt>AUTHORITY</dt><dd className="is-empty">∅</dd></div>
            </dl>
            <p><Gamepad2 size={13} />{locale === 'zh' ? '重新构建后的规则将在下一波应用，不会中途改变当前攻击判定。' : 'Rebuilt rules apply on the next wave, never midway through the current attack resolution.'}</p>
          </div>
        </article>
      </div>
    </section>
  )
}

export function validateRiverOathRuleContract(value: RuntimeValue): RiverOathRuleContract {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('River Oath rules must return a record.')
  }
  const record = value as Record<string, unknown>
  exactText(record, 'schema', 'axirune-arcade/river-oath/1')
  exactText(record, 'game', 'river-oath')
  integer(record, 'stage', 1, 4)
  text(record, 'stage_key', 1, 80)
  integer(record, 'wave', 1, 3)
  text(record, 'wave_key', 1, 80)
  integer(record, 'campaign_index', 1, 12)
  integer(record, 'defeated', 0, 9_999)
  finite(record, 'enemy_speed', 30, 320)
  finite(record, 'enemy_health', 20, 500)
  finite(record, 'enemy_damage', 1, 100)
  finite(record, 'enemy_guard', 0, 100)
  finite(record, 'spawn_interval_ms', 300, 3_000)
  integer(record, 'enemy_count', 1, 24)
  boolean(record, 'boss_active')
  text(record, 'boss_phase', 1, 80)
  finite(record, 'boss_health', 0, 4_000)
  finite(record, 'boss_damage', 0, 160)
  finite(record, 'boss_guard', 0, 160)
  finite(record, 'reward_score', 0, 100_000)
  finite(record, 'reward_renown', 0, 10_000)
  text(record, 'drop_kind', 1, 80)
  integer(record, 'drop_count', 0, 12)
  finite(record, 'drop_rate_percent', 0, 100)
  text(record, 'difficulty', 1, 80)
  if (record.boss_active === false && (record.boss_health !== 0 || record.boss_damage !== 0 || record.boss_guard !== 0)) {
    throw new Error('Inactive boss rules must have zero health, damage, and guard.')
  }
  if (record.campaign_index !== (record.stage as number - 1) * 3 + (record.wave as number)) {
    throw new Error('River Oath campaign_index does not match stage and wave.')
  }
  return record as unknown as RiverOathRuleContract
}

function exactText(record: Record<string, unknown>, key: string, expected: string) {
  if (record[key] !== expected) throw new Error(`River Oath ${key} must be ${expected}.`)
}

function text(record: Record<string, unknown>, key: string, minimum: number, maximum: number) {
  const value = record[key]
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum) {
    throw new Error(`River Oath ${key} must be ${minimum}-${maximum} characters.`)
  }
}

function finite(record: Record<string, unknown>, key: string, minimum: number, maximum: number) {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`River Oath ${key} must be between ${minimum} and ${maximum}.`)
  }
}

function integer(record: Record<string, unknown>, key: string, minimum: number, maximum: number) {
  finite(record, key, minimum, maximum)
  if (!Number.isInteger(record[key])) throw new Error(`River Oath ${key} must be an integer.`)
}

function boolean(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== 'boolean') throw new Error(`River Oath ${key} must be a boolean.`)
}

function shortHash(value: string | undefined) {
  if (!value) return '—'
  return value.length > 28 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value
}
