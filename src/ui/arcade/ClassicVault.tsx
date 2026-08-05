import {
  Check,
  Code2,
  Gamepad2,
  Layers3,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RuntimeValue } from '../../language'
import {
  createAxiruneRuleModule,
  type AxiruneRuleModule,
} from '../../arcade/axirune-rule-module'
import {
  ARCADE_CLASSICS_CATALOG,
  type ArcadeClassicGameId,
  type ArcadeGameDefinition,
} from '../../arcade/classics/catalog'
import {
  validateClassicRuleContract,
  type ClassicRuleContract,
} from '../../arcade/classic-rule-contract'
import type { Locale } from '../../content/site'
import { CodeEditor } from '../CodeEditor'
import { ClassicWorldGame } from './ClassicWorldGame'
import './classic-vault.css'

const classicSourceModules = import.meta.glob('../../../apps/arcade/classics/*.axi', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const flagshipIds = new Set<ArcadeClassicGameId>(['vector-siege', 'prism-bastion'])

type RuntimeEvidence = {
  contentId: string
  semanticDigest: string
  capsuleBytes: number
  traceLength: number
}

class SupersededClassicEvaluation extends Error {}

export function ClassicVault({
  locale,
  onOpenFlagship,
}: {
  locale: Locale
  onOpenFlagship: (id: 'vector-siege' | 'prism-bastion') => void
}) {
  const [selectedId, setSelectedId] = useState<ArcadeClassicGameId>('aetherstep-foundry')
  const cabinetRef = useRef<HTMLDivElement>(null)

  const selected = ARCADE_CLASSICS_CATALOG.find(({ id }) => id === selectedId)
    ?? ARCADE_CLASSICS_CATALOG[0]!

  const selectGame = (id: ArcadeClassicGameId) => {
    if (id === 'vector-siege' || id === 'prism-bastion') {
      onOpenFlagship(id)
      return
    }
    setSelectedId(id)
    window.requestAnimationFrame(() => {
      cabinetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <section className="classic-vault" aria-labelledby="classic-vault-title">
      <div className="classic-vault__intro">
        <div>
          <span className="arcade-kicker"><Layers3 size={14} /> 20 / ORIGINAL WORLDS</span>
          <h2 id="classic-vault-title">
            {locale === 'zh' ? '二十种经典机制，' : 'TWENTY CLASSIC MECHANICS.'}
            <strong>{locale === 'zh' ? '没有一份 ROM。' : 'ZERO ROMS.'}</strong>
          </h2>
        </div>
        <div className="classic-vault__statement">
          <p>
            {locale === 'zh'
              ? '汲取早期主机时代清晰规则、即时反馈与难度节奏，角色、关卡、画面和规则程序全部原创。每张卡片都对应可运行作品，而不是概念封面。'
              : 'Inspired by the clear rules, immediate feedback, and difficulty cadence of early home consoles. Every character, level, visual, and rule program is original—and every card launches playable work.'}
          </p>
          <dl>
            <div><dt>PROGRAMS</dt><dd>20 .AXI</dd></div>
            <div><dt>ENGINES</dt><dd>8 FAMILIES</dd></div>
            <div><dt>AUTHORITY</dt><dd>∅</dd></div>
          </dl>
        </div>
      </div>

      <div className="classic-vault__grid" aria-label={locale === 'zh' ? '二十款可玩作品' : 'Twenty playable worlds'}>
        {ARCADE_CLASSICS_CATALOG.map((game) => (
          <ClassicCard
            key={game.id}
            game={game}
            locale={locale}
            selected={game.id === selectedId && !flagshipIds.has(game.id)}
            flagship={flagshipIds.has(game.id)}
            onSelect={() => selectGame(game.id)}
          />
        ))}
      </div>

      {!flagshipIds.has(selected.id) ? (
        <div ref={cabinetRef} className="classic-vault__cabinet-anchor">
          <ClassicCabinet key={selected.id} game={selected} locale={locale} />
        </div>
      ) : null}
    </section>
  )
}

function ClassicCard({
  game,
  locale,
  selected,
  flagship,
  onSelect,
}: {
  game: ArcadeGameDefinition<ArcadeClassicGameId>
  locale: Locale
  selected: boolean
  flagship: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`classic-card ${selected ? 'is-selected' : ''}`}
      data-family={game.engineFamily}
      data-game={game.id}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="classic-card__art" aria-hidden="true">
        <i />
        <i />
        <i />
        <b>{String(game.ordinal).padStart(2, '0')}</b>
      </span>
      <span className="classic-card__meta">
        <small>{game.engineFamily.replace('-field', '').toUpperCase()} / {game.fixedStepHz} HZ</small>
        <strong>{game.title}</strong>
        <span>{game.localTitle[locale]}</span>
      </span>
      <span className="classic-card__footer">
        <i>{game.tags.slice(0, 2).join(' · ')}</i>
        <b>{flagship ? (locale === 'zh' ? '旗舰柜台 ↗' : 'FLAGSHIP ↗') : (locale === 'zh' ? '载入' : 'LOAD')}</b>
      </span>
    </button>
  )
}

function ClassicCabinet({
  game,
  locale,
}: {
  game: ArcadeGameDefinition<ArcadeClassicGameId>
  locale: Locale
}) {
  const canonicalSource = useMemo(() => sourceFor(game.id), [game.id])
  const [source, setSource] = useState(canonicalSource)
  const [contract, setContract] = useState<ClassicRuleContract | null>(null)
  const [evidence, setEvidence] = useState<RuntimeEvidence | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [revision, setRevision] = useState(0)
  const moduleRef = useRef<AxiruneRuleModule | null>(null)
  const buildSequence = useRef(0)

  const buildRules = useCallback(async (nextSource: string) => {
    const sequence = ++buildSequence.current
    setBuilding(true)
    setError(null)
    try {
      const module = await createAxiruneRuleModule(nextSource)
      const result = await module.run({ stage: 1, score: 0, streak: 0 })
      const nextContract = validateClassicRuleContract(result.value, game.id)
      if (sequence !== buildSequence.current) return
      moduleRef.current = module
      setContract(nextContract)
      setEvidence({
        contentId: module.contentId,
        semanticDigest: module.semanticDigest,
        capsuleBytes: module.capsuleBytes,
        traceLength: result.traceLength,
      })
      setRevision((value) => value + 1)
      setDirty(false)
    } catch (buildError) {
      if (sequence !== buildSequence.current) return
      setError(buildError instanceof Error ? buildError.message : String(buildError))
    } finally {
      if (sequence === buildSequence.current) setBuilding(false)
    }
  }, [game.id])

  useEffect(() => {
    void buildRules(canonicalSource)
  }, [buildRules, canonicalSource])

  const evaluateRules = useCallback(async (
    input: Readonly<Record<string, RuntimeValue>>,
  ): Promise<ClassicRuleContract> => {
    const generation = buildSequence.current
    const module = moduleRef.current
    if (!module) throw new Error('Rule capsule is not ready.')
    try {
      const result = await module.run(input)
      if (generation !== buildSequence.current || module !== moduleRef.current) {
        throw new SupersededClassicEvaluation()
      }
      const nextContract = validateClassicRuleContract(result.value, game.id)
      setContract(nextContract)
      setEvidence((current) => current ? { ...current, traceLength: result.traceLength } : current)
      setError(null)
      return nextContract
    } catch (runError) {
      if (!(runError instanceof SupersededClassicEvaluation)) {
        setError(runError instanceof Error ? runError.message : String(runError))
      }
      throw runError
    }
  }, [game.id])

  const resetSource = () => {
    setSource(canonicalSource)
    setDirty(false)
    void buildRules(canonicalSource)
  }

  return (
    <article className="classic-cabinet" data-testid="classic-cabinet" data-game={game.id}>
      <header className="classic-cabinet__head">
        <div>
          <span className="arcade-kicker">{String(game.ordinal).padStart(2, '0')} / VERIFIED PLAYABLE</span>
          <h3>{game.title}</h3>
          <strong>{game.localTitle[locale]}</strong>
        </div>
        <p>{game.summary[locale]}</p>
        <div className="arcade-tag-row">
          {game.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </header>

      <div className="classic-cabinet__machine">
        <div className="classic-cabinet__stage">
          {contract ? (
            <ClassicWorldGame
              key={`${game.id}-${revision}`}
              game={game}
              locale={locale}
              contract={contract}
              revision={revision}
              evaluateRules={evaluateRules}
            />
          ) : (
            <div className="arcade-machine__loading">
              <LoaderCircle className="spin" size={28} />
              <strong>{locale === 'zh' ? '正在验证规则胶囊' : 'VERIFYING RULE CAPSULE'}</strong>
              <span>COMPILE → VERIFY → ZERO AUTHORITY</span>
            </div>
          )}
        </div>

        <aside className="classic-studio" aria-label={`${game.title} Axirune rule studio`}>
          <div className="arcade-rule-studio__bar">
            <div><Code2 size={14} /><strong>{game.id}.axi</strong></div>
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
            minHeight={390}
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
          <div className="arcade-evidence classic-evidence">
            <div className="arcade-evidence__title"><Sparkles size={14} /><span>VERIFICATION EVIDENCE</span></div>
            <dl>
              <div><dt>CONTENT ID</dt><dd>{shortHash(evidence?.contentId)}</dd></div>
              <div><dt>SEMANTIC</dt><dd>{shortHash(evidence?.semanticDigest)}</dd></div>
              <div><dt>CAPSULE</dt><dd>{evidence ? `${evidence.capsuleBytes.toLocaleString()} B` : '—'}</dd></div>
              <div><dt>AUTHORITY</dt><dd className="is-empty">∅</dd></div>
              <div><dt>TRACE</dt><dd>{evidence ? `${evidence.traceLength} EVENTS` : '—'}</dd></div>
            </dl>
            <p><Gamepad2 size={13} /> {locale === 'zh' ? '规则改变会在下个阶段重新求值。' : 'Rules are re-evaluated at the next stage.'}</p>
          </div>
        </aside>
      </div>
    </article>
  )
}

function sourceFor(id: ArcadeClassicGameId): string {
  const match = Object.entries(classicSourceModules).find(([path]) => path.endsWith(`/${id}.axi`))
  if (!match || typeof match[1] !== 'string') {
    throw new Error(`No Axirune rules are bundled for ${id}.`)
  }
  return match[1]
}

function shortHash(value: string | undefined): string {
  if (!value) return '—'
  return value.length > 28 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value
}
