import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { CongestionLevel, CorridorDirection } from '../lib/types'
import { CORRIDOR_COLORS } from '../lib/types'
import { StatusBadge } from './StatusBadge'
import { Sparkline } from './Sparkline'

function congestionColor(level: CongestionLevel) {
  switch (level) {
    case 'light': return 'var(--color-congestion-light)'
    case 'moderate': return 'var(--color-congestion-moderate)'
    case 'heavy': return 'var(--color-congestion-heavy)'
    case 'severe': return 'var(--color-congestion-severe)'
  }
}

type TrendDirection = 'up' | 'down' | 'flat'

function TrendMarker({ direction }: { direction: TrendDirection }) {
  const color = 'var(--color-text-muted)'
  if (direction === 'up') return <TrendingUp size={11} style={{ color, flexShrink: 0 }} aria-label="Getting worse" />
  if (direction === 'down') return <TrendingDown size={11} style={{ color, flexShrink: 0 }} aria-label="Clearing" />
  return <Minus size={11} style={{ color, flexShrink: 0 }} aria-label="Steady" />
}

function inferTrend(values: number[]): TrendDirection {
  if (values.length < 3) return 'flat'
  const recent = values.slice(-3)
  const first = recent[0]
  const last = recent[recent.length - 1]
  const delta = last - first
  // Threshold: 30 seconds to avoid noise
  if (delta > 30) return 'up'
  if (delta < -30) return 'down'
  return 'flat'
}

interface DirectionRowProps {
  dir: CorridorDirection
  label: string
  detailMode: boolean
  trendValues?: number[]
  onZoom?: () => void
}

function DirectionRow({ dir, label, detailMode, trendValues, onZoom }: DirectionRowProps) {
  const minutes = Math.round(dir.durationSeconds / 60)
  const historicMin = dir.historicSeconds ? Math.round(dir.historicSeconds / 60) : null
  const freeFlowMin = dir.noTrafficSeconds ? Math.round(dir.noTrafficSeconds / 60) : null

  const delayMin = Math.round(dir.freeFlowDelaySeconds / 60)
  const typicalDelayMin = Math.round(dir.usualDelaySeconds / 60)
  const cc = congestionColor(dir.freeFlowCongestionLevel)
  const hasDelay = dir.freeFlowDelaySeconds > 0
  const showTypical = dir.usualDelaySeconds > 60
  const ratioText = dir.freeFlowRatio.toFixed(1)
  const trend = trendValues && trendValues.length >= 3 ? inferTrend(trendValues) : null

  return (
    <div
      className={`grid grid-cols-[5rem_1fr] gap-3 py-3 border-b last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-md${onZoom ? ' cursor-pointer hover:bg-black/3 active:bg-black/5 dark:hover:bg-white/4 dark:active:bg-white/[0.07]' : ''}`}
      style={{
        borderColor: 'var(--color-border)',
        opacity: dir.isStale ? 0.75 : 1,
        '--tw-ring-color': 'var(--color-focus)',
        '--tw-ring-offset-color': 'var(--color-surface-raised)',
      } as React.CSSProperties}
      role={onZoom ? 'button' : undefined}
      tabIndex={onZoom ? 0 : undefined}
      onClick={onZoom}
      onKeyDown={onZoom ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onZoom() } } : undefined}
    >
      {/* Hero: delay vs free-flow */}
      <div className="self-center min-w-0">
        <div
          className="text-3xl sm:text-4xl font-black tabular-nums leading-none"
          style={{ color: hasDelay ? cc : 'var(--color-congestion-light)' }}
        >
          {hasDelay ? `+${delayMin}` : 'OK'}
        </div>
        {hasDelay && (
          <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            min delay
          </div>
        )}
      </div>

      {/* Direction details */}
      <div className="min-w-0 self-center">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {label}
          </span>
          {dir.isStale && (
            <AlertTriangle size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          )}
          {trend && <TrendMarker direction={trend} />}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="text-sm tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
            {minutes} min now · <span style={{ color: cc, opacity: 0.65 }}>{ratioText}x</span> · {dir.currentSpeedKph} km/h
          </div>
          {trendValues && trendValues.length >= 3 && (
            <Sparkline values={trendValues} color={cc} />
          )}
        </div>
        {detailMode && (
          <div className="flex items-center gap-2 mt-1 text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            {historicMin !== null && <span>{historicMin} min typical</span>}
            {freeFlowMin !== null && <span>{freeFlowMin} min best</span>}
          </div>
        )}
        {showTypical && !detailMode && (
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Typically +{typicalDelayMin} min at this time
          </div>
        )}
      </div>
    </div>
  )
}

interface TrafficCardProps {
  corridorId: string
  label: string
  forward: CorridorDirection | undefined
  reverse: CorridorDirection | undefined
  forwardLabel: string
  reverseLabel: string
  detailMode: boolean
  forwardTrend?: number[]
  reverseTrend?: number[]
  onDirectionZoom?: (dirKey: string) => void
}

export function TrafficCard({ corridorId, label, forward, reverse, forwardLabel, reverseLabel, detailMode, forwardTrend, reverseTrend, onDirectionZoom }: TrafficCardProps) {
  const corridorColor = CORRIDOR_COLORS[corridorId] ?? 'var(--color-congestion-light)'

  const allStale = (forward?.isStale ?? true) && (reverse?.isStale ?? true)
  const someStale = (forward?.isStale ?? false) || (reverse?.isStale ?? false)

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0 opacity-70" style={{ backgroundColor: corridorColor }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
        </div>
        {allStale && (
          <StatusBadge type="warning" size="sm">
            Stale
          </StatusBadge>
        )}
        {someStale && !allStale && (
          <StatusBadge type="info" size="sm">
            Partial
          </StatusBadge>
        )}
      </div>

      {/* Direction rows */}
      <div className="px-4">
        {forward && <DirectionRow dir={forward} label={forwardLabel} detailMode={detailMode} trendValues={forwardTrend} onZoom={onDirectionZoom ? () => onDirectionZoom(`${corridorId}_f`) : undefined} />}
        {reverse && <DirectionRow dir={reverse} label={reverseLabel} detailMode={detailMode} trendValues={reverseTrend} onZoom={onDirectionZoom ? () => onDirectionZoom(`${corridorId}_r`) : undefined} />}
      </div>
    </div>
  )
}
