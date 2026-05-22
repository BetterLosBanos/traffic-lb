import { AlertTriangle } from 'lucide-react'
import type { CongestionLevel, CorridorDirection, TrafficBaseline } from '../lib/types'
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

function tintOpacity(levels: CorridorDirection['usualCongestionLevel'][]): number {
  const rank = (l: CorridorDirection['usualCongestionLevel']) => {
    switch (l) { case 'light': return 1; case 'moderate': return 2; case 'heavy': return 3; case 'severe': return 4 }
  }
  const worst = Math.max(0, ...levels.map(rank))
  return [0, 2, 5, 10, 15][worst] ?? 2
}

interface DirectionRowProps {
  dir: CorridorDirection
  label: string
  detailMode: boolean
  baseline: TrafficBaseline
  onZoom?: () => void
}

function DirectionRow({ dir, label, detailMode, baseline, onZoom }: DirectionRowProps) {
  const minutes = Math.round(dir.durationSeconds / 60)
  const historicMin = dir.historicSeconds ? Math.round(dir.historicSeconds / 60) : null
  const freeFlowMin = dir.noTrafficSeconds ? Math.round(dir.noTrafficSeconds / 60) : null

  const delayVsBaseline = baseline === 'usual' ? dir.usualDelaySeconds : dir.freeFlowDelaySeconds
  const ratioVsBaseline = baseline === 'usual' ? dir.usualRatio : dir.freeFlowRatio
  const congestionLevel = baseline === 'usual' ? dir.usualCongestionLevel : dir.freeFlowCongestionLevel

  const delayMin = Math.round(delayVsBaseline / 60)
  const cc = congestionColor(congestionLevel)
  const hasDelay = delayVsBaseline > 0
  const ratioText = ratioVsBaseline.toFixed(1)

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
      {/* Hero: delay vs baseline */}
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

      {/* Direction details - different based on mode */}
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
              {minutes} min now · {historicMin !== null ? `${historicMin} usual` : '—'} · {freeFlowMin !== null ? `${freeFlowMin} best time` : '—'} · {dir.currentSpeedKph} km/h
            </>
          ) : (
            <>
              {minutes} min now · <span style={{ color: cc, opacity: 0.65 }}>{ratioText}x</span> · {dir.currentSpeedKph} km/h
            </>
          )}
        </div>
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
  baseline: TrafficBaseline
  onDirectionZoom?: (dirKey: string) => void
}

export function TrafficCard({ corridorId, label, forward, reverse, forwardLabel, reverseLabel, detailMode, baseline, onDirectionZoom }: TrafficCardProps) {
  const corridorColor = CORRIDOR_COLORS[corridorId] ?? 'var(--color-congestion-light)'

  const levels: CorridorDirection['usualCongestionLevel'][] = [forward, reverse].filter(Boolean).map(d => baseline === 'usual' ? d!.usualCongestionLevel : d!.freeFlowCongestionLevel)
  const tint = tintOpacity(levels)

  const allStale = (forward?.isStale ?? true) && (reverse?.isStale ?? true)
  const someStale = (forward?.isStale ?? false) || (reverse?.isStale ?? false)

  return (
    <div
      className="card overflow-hidden"
      style={{
        background: `color-mix(in srgb, ${corridorColor} ${tint}%, var(--color-surface-raised))`,
      }}
    >
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
        {forward && <DirectionRow dir={forward} label={forwardLabel} detailMode={detailMode} baseline={baseline} onZoom={onDirectionZoom ? () => onDirectionZoom(`${corridorId}_f`) : undefined} />}
        {reverse && <DirectionRow dir={reverse} label={reverseLabel} detailMode={detailMode} baseline={baseline} onZoom={onDirectionZoom ? () => onDirectionZoom(`${corridorId}_r`) : undefined} />}
      </div>
    </div>
  )
}
