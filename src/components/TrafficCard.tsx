import { AlertTriangle } from 'lucide-react'
import type { CorridorDirection } from '../lib/types'
import { CORRIDOR_COLORS } from '../lib/types'

function congestionColor(level: CorridorDirection['congestionLevel']) {
  switch (level) {
    case 'light': return 'var(--color-congestion-light)'
    case 'moderate': return 'var(--color-congestion-moderate)'
    case 'heavy': return 'var(--color-congestion-heavy)'
    case 'severe': return 'var(--color-congestion-severe)'
  }
}

function tintOpacity(levels: CorridorDirection['congestionLevel'][]): number {
  const rank = (l: CorridorDirection['congestionLevel']) => {
    switch (l) { case 'light': return 1; case 'moderate': return 2; case 'heavy': return 3; case 'severe': return 4 }
  }
  const worst = Math.max(0, ...levels.map(rank))
  return [0, 2, 5, 10, 15][worst] ?? 2
}

interface DirectionRowProps {
  dir: CorridorDirection
  label: string
  onZoom?: () => void
}

function DirectionRow({ dir, label, onZoom }: DirectionRowProps) {
  const minutes = Math.round(dir.durationSeconds / 60)
  const delay = Math.round(dir.delaySeconds / 60)
  const clearMinutes = Math.round(dir.noTrafficSeconds / 60)
  const cc = congestionColor(dir.congestionLevel)
  const hasDelay = delay > 0
  const ratio = dir.congestionRatio.toFixed(1)

  return (
    <div
      className={`grid grid-cols-[5rem_1fr] gap-3 py-3 border-b last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2${onZoom ? ' cursor-pointer hover:bg-black/[0.03] active:bg-black/[0.05] dark:hover:bg-white/[0.04] dark:active:bg-white/[0.07]' : ''}`}
      style={{ borderColor: 'var(--color-border)', opacity: dir.isStale ? 0.75 : 1, outlineColor: 'var(--color-focus)' }}
      role={onZoom ? 'button' : undefined}
      tabIndex={onZoom ? 0 : undefined}
      onClick={onZoom}
      onKeyDown={onZoom ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onZoom() } } : undefined}
    >
      {/* Hero: absolute delay */}
      <div className="self-center min-w-0">
        <div
          className="text-3xl sm:text-4xl font-black tabular-nums leading-none"
          style={{ color: hasDelay ? cc : 'var(--color-congestion-light)' }}
        >
          {hasDelay ? `+${delay}` : 'OK'}
        </div>
        <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {hasDelay ? 'min delay' : 'on time'}
        </div>
      </div>

      {/* Direction details with ratio inline */}
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
          {minutes} min now · <span style={{ color: cc, opacity: 0.65 }}>{ratio}x</span> · {clearMinutes} min clear
        </div>
      </div>
    </div>
  )
}

interface Props {
  corridorId: string
  label: string
  forward: CorridorDirection | undefined
  reverse: CorridorDirection | undefined
  forwardLabel: string
  reverseLabel: string
  onDirectionZoom?: (dirKey: string) => void
}

export default function TrafficCard({ corridorId, label, forward, reverse, forwardLabel, reverseLabel, onDirectionZoom }: Props) {
  const corridorColor = CORRIDOR_COLORS[corridorId] ?? 'var(--color-congestion-light)'

  const levels: CorridorDirection['congestionLevel'][] = [forward, reverse].filter(Boolean).map(d => d!.congestionLevel)
  const tint = tintOpacity(levels)

  const allStale = (forward?.isStale ?? true) && (reverse?.isStale ?? true)
  const someStale = (forward?.isStale ?? false) || (reverse?.isStale ?? false)
  const staleText = allStale ? 'stale' : someStale ? 'partial' : null

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
        {staleText && (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <AlertTriangle size={10} />
            {staleText}
          </span>
        )}
      </div>

      {/* Direction rows */}
      <div className="px-4">
        {forward && <DirectionRow dir={forward} label={forwardLabel} onZoom={onDirectionZoom ? () => onDirectionZoom(`${corridorId}_f`) : undefined} />}
        {reverse && <DirectionRow dir={reverse} label={reverseLabel} onZoom={onDirectionZoom ? () => onDirectionZoom(`${corridorId}_r`) : undefined} />}
      </div>
    </div>
  )
}
