import {
  Bot,
  Check,
  CircleDot,
  GitBranch,
  KeyRound,
  ShieldCheck,
  Terminal,
  Wrench,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { TraceView } from './languageBridge'

function iconFor(kind: string): ComponentType<{ size?: number; strokeWidth?: number }> {
  const normalized = kind.toLowerCase()
  if (normalized.includes('tool') || normalized.includes('call')) return Wrench
  if (normalized.includes('permit') || normalized.includes('capab')) return KeyRound
  if (normalized.includes('agent') || normalized.includes('model')) return Bot
  if (normalized.includes('branch') || normalized.includes('workflow')) return GitBranch
  if (normalized.includes('sandbox') || normalized.includes('guard')) return ShieldCheck
  if (normalized.includes('emit') || normalized.includes('output')) return Terminal
  if (normalized.includes('done') || normalized.includes('complete')) return Check
  return CircleDot
}

type TraceRailProps = {
  entries: TraceView[]
  compact?: boolean
  emptyLabel?: string
}

export function TraceRail({
  entries,
  compact = false,
  emptyLabel = 'Run the program to inspect its trace.',
}: TraceRailProps) {
  if (entries.length === 0) {
    return (
      <div className="trace-empty">
        <span className="trace-empty__pulse" />
        <p>{emptyLabel}</p>
      </div>
    )
  }

  return (
    <ol className={`trace-rail ${compact ? 'trace-rail--compact' : ''}`}>
      {entries.map((entry, index) => {
        const Icon = iconFor(entry.kind)
        return (
          <li className={`trace-event trace-event--${entry.status}`} key={`${entry.id}-${index}`}>
            <div className="trace-event__axis">
              <span className="trace-event__node">
                <Icon size={compact ? 12 : 14} strokeWidth={1.8} />
              </span>
            </div>
            <div className="trace-event__body">
              <div className="trace-event__meta">
                <span>{entry.kind}</span>
                {entry.elapsed ? <time>{entry.elapsed}</time> : null}
              </div>
              <strong>{entry.label}</strong>
              {entry.detail ? <p>{entry.detail}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

