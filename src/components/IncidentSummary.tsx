import { AlertTriangle } from 'lucide-react'
import type { Incident } from '../lib/types'

interface Props {
  incidents: Incident[]
}

const SEVERITY_RANK: Record<string, number> = {
  unknown: 1,
  minor: 2,
  low: 2,
  moderate: 3,
  medium: 3,
  major: 4,
  high: 4,
  severe: 5,
  critical: 5,
}

function normalizeText(value: string) {
  const normalized = value.trim().toLowerCase().replace(/_/g, ' ')
  if (!normalized) return ''
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function severityKey(severity: string) {
  return severity.trim().toLowerCase().replace(/_/g, ' ') || 'unknown'
}

function hasKnownSeverity(severity: string) {
  return severityKey(severity) !== 'unknown'
}

function severityColor(severity: string) {
  const key = severityKey(severity)
  const rank = SEVERITY_RANK[key] ?? SEVERITY_RANK.unknown
  if (rank >= 5) return 'var(--color-congestion-severe)'
  if (rank >= 4) return 'var(--color-congestion-heavy)'
  if (rank >= 3) return 'var(--color-congestion-moderate)'
  return 'var(--color-text-muted)'
}

function worstSeverity(incidents: Incident[]) {
  return incidents.reduce((worst, inc) => {
    const rank = SEVERITY_RANK[severityKey(inc.severity)] ?? SEVERITY_RANK.unknown
    return rank > worst.rank ? { rank, color: severityColor(inc.severity) } : worst
  }, { rank: 0, color: 'var(--color-congestion-moderate)' })
}

export default function IncidentSummary({ incidents }: Props) {
  if (incidents.length === 0) return null

  const worst = worstSeverity(incidents)

  return (
    <section
      className="card mb-5 p-4 overflow-hidden"
      aria-label="Reported traffic issues"
      style={{
        borderTop: `2px solid ${worst.color}`,
        backgroundColor: `color-mix(in srgb, ${worst.color} 4%, var(--color-surface-raised))`,
      }}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
        <AlertTriangle size={12} aria-hidden="true" />
        Reported Issues
      </h2>
      <ul className={incidents.length > 1 ? 'space-y-2' : undefined}>
        {incidents.map((inc, i) => (
          <li key={`${inc.type}-${inc.roadName}-${i}`} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {hasKnownSeverity(inc.severity) ? (
              <span
                className="mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none"
                style={{
                  color: severityColor(inc.severity),
                  backgroundColor: `color-mix(in srgb, ${severityColor(inc.severity)} 12%, transparent)`,
                }}
              >
                {normalizeText(inc.severity)}
              </span>
            ) : (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-text-muted)' }} aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="font-medium">
                {normalizeText(inc.type)}
                {inc.from && (
                  <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}> near {inc.from}{inc.to ? ` → ${inc.to}` : ''}</span>
                )}
                {inc.roadName && (
                  <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}> · {inc.roadName}</span>
                )}
              </p>
              {inc.description && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{inc.description}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
