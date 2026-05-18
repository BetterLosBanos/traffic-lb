import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import type { CorridorDirection } from '../lib/types'

interface Props {
  corridors: Record<string, CorridorDirection>
  lastUpdated: string | null
  isStale: boolean
  isRefreshing: boolean
  onRefresh: () => void
}

type Level = CorridorDirection['congestion_level']

const LEVEL_RANK: Record<Level, number> = {
  light: 1,
  moderate: 2,
  heavy: 3,
  severe: 4,
}

const LEVEL_LABEL: Record<Level, string> = {
  light: 'Light',
  moderate: 'Moderate',
  heavy: 'Heavy',
  severe: 'Severe',
}

const LEVEL_COLOR: Record<Level, string> = {
  light: 'var(--color-congestion-light)',
  moderate: 'var(--color-congestion-moderate)',
  heavy: 'var(--color-congestion-heavy)',
  severe: 'var(--color-congestion-severe)',
}

const LEVEL_COPY: Record<Level, string> = {
  light: 'Moving well',
  moderate: 'Some delay',
  heavy: 'Slow traffic',
  severe: 'Severe delay',
}

function formatAge(timestamp: string | null) {
  if (!timestamp) return { minutes: null, text: 'No update yet' }

  // API returns ISO 8601 UTC with Z suffix.
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000))

  if (minutes < 1) return { minutes, text: 'Just now' }
  if (minutes < 60) return { minutes, text: `${minutes} min ago` }
  return { minutes, text: `${Math.floor(minutes / 60)}h ago` }
}

function getWorstLevel(corridors: Record<string, CorridorDirection>): Level {
  const levels = Object.values(corridors).map(d => LEVEL_RANK[d.congestion_level])
  const worst = Math.max(0, ...levels)
  return (Object.entries(LEVEL_RANK).find(([, v]) => v === worst)?.[0] ?? 'light') as Level
}

export default function DataStatusBar({
  corridors,
  lastUpdated,
  isStale,
  isRefreshing,
  onRefresh,
}: Props) {
  const level = getWorstLevel(corridors)
  const levelColor = LEVEL_COLOR[level]
  const age = formatAge(lastUpdated)
  const stale = isStale || (age.minutes !== null && age.minutes >= 30)
  const aging = !stale && age.minutes !== null && age.minutes >= 15

  const freshness = stale
    ? {
        label: 'Stale',
        detail: 'Data may be outdated',
        icon: AlertTriangle,
        color: 'var(--color-congestion-severe)',
        background: 'color-mix(in srgb, var(--color-congestion-severe) 12%, var(--color-surface-raised))',
      }
    : aging
      ? {
          label: 'Updating soon',
          detail: 'Next refresh is near',
          icon: Clock,
          color: 'var(--color-congestion-moderate)',
          background: 'color-mix(in srgb, var(--color-congestion-moderate) 12%, var(--color-surface-raised))',
        }
      : {
          label: 'Fresh',
          detail: 'Recent sample',
          icon: CheckCircle2,
          color: 'var(--color-congestion-light)',
          background: 'color-mix(in srgb, var(--color-congestion-light) 12%, var(--color-surface-raised))',
        }

  const FreshnessIcon = freshness.icon

  return (
    <section
      className="card mb-5"
      aria-label="Traffic data status"
      aria-live="polite"
      style={{
        background: `color-mix(in srgb, ${levelColor} 4%, var(--color-surface-raised))`,
        boxShadow: `0 0 0 1px color-mix(in srgb, ${levelColor} 18%, transparent)`,
      }}
    >
      <div className="p-4 sm:p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Current Status
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-xl sm:text-2xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              {Object.keys(corridors).length > 0 ? `${LEVEL_LABEL[level]} traffic` : 'No traffic status'}
            </h2>
            {Object.keys(corridors).length > 0 && (
              <span className="text-sm font-medium" style={{ color: levelColor }}>
                {LEVEL_COPY[level]}
              </span>
            )}
          </div>
        </div>

        <div
          className="flex flex-col gap-2 rounded-lg p-2 sm:flex-row sm:items-center"
          style={{
            backgroundColor: freshness.background,
            border: `1px solid color-mix(in srgb, ${freshness.color} 30%, var(--color-border))`,
          }}
        >
          <div className="min-w-0 px-1 sm:min-w-[180px]">
            <div className="flex items-center gap-2">
              <FreshnessIcon size={16} style={{ color: freshness.color }} aria-hidden="true" />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{freshness.label}</span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {freshness.detail} · {age.text}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="min-h-11 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              outlineColor: 'var(--color-focus)',
            }}
            aria-label={isRefreshing ? 'Refreshing traffic data' : 'Refresh traffic data'}
            title="Refreshes every 10 min during collection hours"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : undefined} aria-hidden="true" />
            <span>{isRefreshing ? 'Refreshing' : `Updated ${age.text}`}</span>
          </button>
        </div>
      </div>
    </section>
  )
}
