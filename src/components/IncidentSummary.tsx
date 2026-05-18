import { AlertTriangle } from 'lucide-react'
import type { Incident } from '../lib/types'
import { ageText, durationSinceText } from '../lib/time'

interface IncidentSummaryProps {
  incidents: Incident[]
  onIncidentClick?: (inc: Incident) => void
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

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/_/g, ' ')
}

function toDisplay(value: string) {
  const normalized = normalizeKey(value)
  if (!normalized) return ''
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function severityRank(severity: string) {
  return SEVERITY_RANK[normalizeKey(severity) || 'unknown'] ?? SEVERITY_RANK.unknown
}

function hasKnownSeverity(severity: string) {
  return normalizeKey(severity) !== 'unknown'
}

function severityColor(severity: string) {
  const rank = severityRank(severity)
  if (rank >= 5) return 'var(--color-congestion-severe)'
  if (rank >= 4) return 'var(--color-congestion-heavy)'
  if (rank >= 3) return 'var(--color-congestion-moderate)'
  return 'var(--color-text-muted)'
}

function severityBadgeStyle(severity: string) {
  const rank = severityRank(severity)

  if (rank >= 5) {
    return {
      color: 'var(--color-incident-severe-text)',
      backgroundColor: 'var(--color-incident-severe-bg)',
    }
  }

  if (rank >= 4) {
    return {
      color: 'var(--color-incident-major-text)',
      backgroundColor: 'var(--color-incident-major-bg)',
    }
  }

  if (rank >= 3) {
    return {
      color: 'var(--color-incident-moderate-text)',
      backgroundColor: 'var(--color-incident-moderate-bg)',
    }
  }

  return {
    color: 'var(--color-text-muted)',
    backgroundColor: 'color-mix(in srgb, var(--color-text-muted) 10%, transparent)',
  }
}

function worstSeverityColor(incidents: Incident[]) {
  return incidents.reduce((worst, inc) => {
    const rank = severityRank(inc.severity)
    return rank > worst.rank ? { rank, color: severityColor(inc.severity) } : worst
  }, { rank: 0, color: 'var(--color-congestion-moderate)' }).color
}

function incidentTiming(inc: Incident) {
  if (inc.timeValidity === 'future') return { label: 'Upcoming', color: 'var(--color-text-muted)' }
  if (inc.hasExpiredEndTime) return { label: 'May have ended', color: 'var(--color-congestion-heavy)' }

  const duration = durationSinceText(inc.startedAt)
  if (duration) return { label: `Ongoing ${duration}`, color: severityColor(inc.severity) }

  return { label: 'Start time unavailable', color: 'var(--color-text-muted)' }
}

export function IncidentSummary({ incidents, onIncidentClick }: IncidentSummaryProps) {
  if (incidents.length === 0) return null

  const worstColor = worstSeverityColor(incidents)

  return (
    <section
      className="card mb-5 p-4 overflow-hidden"
      aria-label="Reported traffic issues"
      style={{
        borderTop: `2px solid ${worstColor}`,
        backgroundColor: `color-mix(in srgb, ${worstColor} 4%, var(--color-surface-raised))`,
      }}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
        <AlertTriangle size={12} aria-hidden="true" />
        Reported Issues
      </h2>
      <ul className={incidents.length > 1 ? 'space-y-2' : undefined}>
        {incidents.map((inc, i) => {
          const timing = incidentTiming(inc)
          const severityStyle = severityBadgeStyle(inc.severity)
          const lastReportedAgo = ageText(inc.lastReportedAt)
          const isClickable = Boolean(onIncidentClick && inc.lat != null)
          const interactiveProps = isClickable ? {
            role: 'button',
            tabIndex: 0,
            onClick: () => onIncidentClick!(inc),
            onKeyDown: (e: React.KeyboardEvent<HTMLLIElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onIncidentClick!(inc)
              }
            },
          } : {}

          return (
            <li
              key={inc.id ?? `${inc.type}-${inc.roadName}-${i}`}
              className={`grid grid-cols-[4.75rem_1fr] gap-x-2 gap-y-1 rounded-md text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2${isClickable ? ' cursor-pointer hover:bg-black/[0.03] active:bg-black/[0.05] dark:hover:bg-white/[0.04] dark:active:bg-white/[0.07]' : ''}`}
              style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--color-focus)' }}
              {...interactiveProps}
            >
              <div className="col-start-1 row-span-2 min-w-0">
                {hasKnownSeverity(inc.severity) ? (
                  <span
                    className="inline-flex max-w-full rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none"
                    style={severityStyle}
                  >
                    {toDisplay(inc.severity)}
                  </span>
                ) : (
                  <span className="mt-1.5 block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-text-muted)' }} aria-hidden="true" />
                )}
              </div>
              <p className="col-start-2 row-start-1 min-w-0 font-medium">
                {toDisplay(inc.type)}
                {inc.from && (
                  <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}> near {inc.from}{inc.to ? ` to ${inc.to}` : ''}</span>
                )}
                {inc.roadName && (
                  <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}> · {inc.roadName}</span>
                )}
              </p>
              <div className="col-start-2 row-start-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {inc.description && normalizeKey(inc.description) !== normalizeKey(inc.type) && (
                  <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{toDisplay(inc.description)}</span>
                )}
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 font-semibold leading-none"
                  style={{
                    color: timing.color,
                    backgroundColor: `color-mix(in srgb, ${timing.color} 12%, transparent)`,
                  }}
                >
                  {timing.label}
                </span>
                {lastReportedAgo && (
                  <span className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>Last report {lastReportedAgo}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
