import { AlertTriangle } from 'lucide-react'
import type { CongestionLevel, CorridorDirection } from '../lib/types'
import { CORRIDOR_COLORS } from '../lib/types'
import { StatusBadge } from './StatusBadge'

function congestionColor(level: CongestionLevel) {
  switch (level) {
    case 'light': return 'var(--color-congestion-light)'
    case 'moderate': return 'var(--color-congestion-moderate)'
    case 'heavy': return 'var(--color-congestion-heavy)'
    case 'severe': return 'var(--color-congestion-severe)'
  }
}

interface DirectionRowProps {
  dir: CorridorDirection
  label: string
  detailMode: boolean
  onZoom?: () => void
}

function DirectionRow({ dir, label, detailMode, onZoom }: DirectionRowProps) {
  const minutes = Math.round(dir.durationSeconds / 60)
  const historicMin = dir.historicSeconds ? Math.round(dir.historicSeconds / 60) : null
  const freeFlowMin = dir.noTrafficSeconds ? Math.round(dir.noTrafficSeconds / 60) : null

  const delayMin = Math.round(dir.freeFlowDelaySeconds / 60)
  const typicalDelayMin = Math.round(dir.usualDelaySeconds / 60)
  const cc = congestionColor(dir.freeFlowCongestionLevel)
  const hasDelay = dir.freeFlowDelaySeconds > 0
  const showTypical = dir.usualDelaySeconds > 60
  const ratioText = dir.freeFlowRatio.toFixed(1)

  return (
    <div
      className={`grid grid-cols-[5rem_1fr] gap-3 py-3 border-b last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-md${onZoom ? ' cursor-pointer hover:bg-black/[0.03] active:bg-black/[0.05] dark:hover:bg-white/[0.04] dark:active:bg-white/[0.07]' : ''}`}
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
        </div>
        <div className="text-sm tabular-nums mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {detailMode ? (
            <>
              {minutes} min now · {historicMin !== null ? `${historicMin} typical` : '—'} · {freeFlowMin !== null ? `${freeFlowMin} best time` : '—'} · {dir.currentSpeedKph} km/h
            </>
          ) : (
            <>
              {minutes} min now · <span style={{ color: cc, opacity: 0.65 }}>{ratioText}x</span> · {dir.currentSpeedKph} km/h
            </>
          )}
        </div>
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
  onDirectionZoom?: (dirKey: string) => void
}

export function TrafficCard({ corridorId, label, forward, reverse, forwardLabel, reverseLabel, detailMode, onDirectionZoom }: TrafficCardProps) {
  const corridorColor = CORRIDOR_COLORS[corridorId] ?? 'var(--color-congestion-light)'

  const allStale = (forward?.isStale ?? true) && (reverse?.isStale ?? true)
  const someStale = (forward?.isStale ?? false) || (reverse?.isStale ?? false)

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0 opacity-70" style={{ backgroundColor: corridorColor }} />
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
        {forward && <DirectionRow dir={forward} label={forwardLabel} detailMode={detailMode} onZoom={onDirectionZoom ? () => onDirectionZoom(`${corridorId}_f`) : undefined} />}
        {reverse && <DirectionRow dir={reverse} label={reverseLabel} detailMode={detailMode} onZoom={onDirectionZoom ? () => onDirectionZoom(`${corridorId}_r`) : undefined} />}
      </div>
    </div>
  )
}
