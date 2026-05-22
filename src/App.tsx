import { useState, useEffect, useCallback, useRef } from 'react'
import { Car, RefreshCw, TrendingUp } from 'lucide-react'
import { TrafficCard } from './components/TrafficCard'
import { TrendChart } from './components/TrendChart'
import { RouteMap } from './components/RouteMap'
import { IncidentSummary } from './components/IncidentSummary'
import { ThemeToggle } from './components/ThemeToggle'
import { HeatmapChart } from './components/HeatmapChart'
import { StatusBadge } from './components/StatusBadge'
import { useTrafficData, type TrendRange } from './lib/api'
import { CORRIDORS } from './lib/types'
import { ageText } from './lib/time'
import type { CorridorDirection } from './lib/types'

// ─── Dynamic hero summary ───────────────────────────────────────

function heroSummary(corridors: Record<string, CorridorDirection>): string {
  const all = Object.values(corridors) as CorridorDirection[]
  if (all.length === 0) return 'No live traffic data yet'

  const stale = all.filter(d => d.isStale)
  if (stale.length === all.length) return 'Traffic data may be outdated'

  const active = all.filter(d => !d.isStale)

  const withDelay = active.map(d => ({
    ...d,
    delay: d.freeFlowDelaySeconds,
    severity: d.freeFlowCongestionLevel,
  }))

  const worst = withDelay.sort((a, b) => b.delay - a.delay)[0]

  if (!worst) return 'Traffic data may be outdated'

  const delayMin = Math.round(worst.delay / 60)
  const dirLabel = corridorLabel(worst.direction)

  if (delayMin <= 0 || worst.severity === 'light') return 'Roads moving well'
  if (worst.severity === 'moderate') return `+${delayMin} min delay ${dirLabel}`
  if (worst.severity === 'heavy') return `Heavy delay ${dirLabel}`
  return `Severe delay ${dirLabel}`
}

function corridorLabel(directionKey: string): string {
  for (const c of CORRIDORS) {
    if (directionKey === `${c.id}_f`) return `to ${c.forwardLabel.replace('To ', '').toLowerCase()}`
    if (directionKey === `${c.id}_r`) return `to ${c.reverseLabel.replace('To ', '').toLowerCase()}`
  }
  return ''
}

// ─── App ────────────────────────────────────────────────────────

export default function App() {
  const {
    data, history, samples, heatmap,
    loading, refreshing, error,
    corridors, incidents, load,
  } = useTrafficData()

  const [trendRange, setTrendRange] = useState<TrendRange>('3h')
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null)
  const [detailMode, setDetailMode] = useState(false)
  const [trendExpanded, setTrendExpanded] = useState(false)
  const [heatmapExpanded, setHeatmapExpanded] = useState(false)
  const hasLoaded = useRef(false)

  const handleLoad = useCallback((initial = false) => {
    load(trendRange, initial)
  }, [load, trendRange])

  useEffect(() => {
    handleLoad(!hasLoaded.current)
    hasLoaded.current = true
    const interval = setInterval(handleLoad, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [handleLoad])

  useEffect(() => {
    if (detailMode) {
      setTrendExpanded(true)
      setHeatmapExpanded(true)
    }
  }, [detailMode])

  const isNoData = data?.status === 'no_data'
  const hasData = data?.status === 'ok' && Object.keys(corridors).length > 0
  const isStale = hasData && Object.values(corridors).some((d: CorridorDirection) => d.isStale)
  const summary = hasData ? heroSummary(corridors) : ''

  return (
    <div className="min-h-screen textured" style={{ backgroundColor: 'var(--color-surface)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ backgroundColor: 'color-mix(in srgb, var(--color-surface) 85%, transparent)', borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Car size={18} strokeWidth={2.5} style={{ color: 'var(--color-congestion-light)' }} />
            <span>Traffic Ba Sa LB?</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDetailMode(!detailMode)}
              className="text-xs font-medium rounded-md px-3 py-2 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all"
              style={{
                backgroundColor: detailMode ? 'var(--color-surface-overlay)' : 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                '--tw-ring-color': 'var(--color-focus)',
                '--tw-ring-offset-color': 'var(--color-surface)',
              } as React.CSSProperties}
              aria-pressed={detailMode}
            >
              <TrendingUp size={12} aria-hidden="true" />
              {detailMode ? 'Detailed' : 'Simple'}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl sm:text-5xl mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Traffic Ba Sa LB<span className="font-display italic" style={{ color: 'var(--color-text-muted)' }}>?</span>
          </h1>
          <p className="text-sm sm:text-base" style={{ color: 'var(--color-text-muted)' }}>
            {loading ? 'Loading…' : summary}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div role="status" aria-live="polite" className="text-center py-16">
            <div className="inline-block w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-congestion-moderate)' }} aria-hidden="true" />
            <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>Loading traffic data…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div role="alert" className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-congestion-severe)' }}>{error}</p>
            <button onClick={() => handleLoad(!hasData)} className="mt-2 min-h-11 px-3 text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--color-focus)' }}>
              Try again
            </button>
          </div>
        )}

        {/* No data */}
        {isNoData && !loading && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4" role="img" aria-label="Construction sign">🚧</div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              No data yet
            </h2>
            <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--color-text-muted)' }}>
              Traffic data collection hasn't started yet. Check back in a few minutes.
            </p>
          </div>
        )}

        {/* Data available */}
        {hasData && !loading && (
          <>
            {/* 1. Traffic cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {CORRIDORS.map(({ id, label, forwardLabel, reverseLabel, a, b }) => {
                const fwd = corridors[`${id}_f`]
                const rev = corridors[`${id}_r`]
                if (!fwd && !rev) return null

                return (
                  <TrafficCard
                    key={id}
                    corridorId={id}
                    label={label}
                    forward={fwd}
                    reverse={rev}
                    forwardLabel={forwardLabel}
                    reverseLabel={reverseLabel}
                    detailMode={detailMode}
                    onDirectionZoom={(dirKey) => {
                      const isForward = dirKey.endsWith('_f')
                      setFlyTo(isForward ? b : a)
                    }}
                  />
                )
              })}
            </div>

            {/* 2. Compact trust strip */}
            <div className="flex items-center justify-center gap-3 text-xs mb-8">
              <StatusBadge type={isStale ? 'warning' : 'success'} size="sm">
                {isStale ? 'Stale' : 'Fresh'}
              </StatusBadge>
              <span style={{ color: 'var(--color-text-muted)' }}>Updated {ageText(data!.lastUpdated)}</span>
              <button
                onClick={() => handleLoad()}
                disabled={refreshing}
                className="flex items-center gap-1.5 min-h-7 px-2 rounded-md font-medium transition-colors disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 hover:bg-black/4:hover:bg-white/[0.06]"
                style={{
                  color: 'var(--color-text-secondary)',
                  '--tw-ring-color': 'var(--color-focus)',
                  '--tw-ring-offset-color': 'var(--color-surface)',
                } as React.CSSProperties}
              >
                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                Refresh
              </button>
            </div>

            {/* 3. Reported issues */}
            <IncidentSummary
              incidents={incidents}
              detailMode={detailMode}
              onIncidentClick={(inc) => inc.lat != null && setFlyTo({ lat: inc.lat!, lng: inc.lng! })}
            />

            {/* 4. Route map */}
            <div className="mb-4">
              <RouteMap corridors={corridors} flyTo={flyTo} />
            </div>

            {/* 5. Traffic trend - collapsible */}
            <div className="mb-4">
              <TrendChart
                history={history}
                samples={samples}
                range={trendRange}
                onRangeChange={setTrendRange}
                expanded={trendExpanded}
                onToggle={() => setTrendExpanded(!trendExpanded)}
              />
            </div>

            {/* 6. Weekly pattern heatmap - collapsible */}
            {heatmap.length > 0 && (
              <div className="mb-4">
                <HeatmapChart
                  data={heatmap}
                  expanded={heatmapExpanded}
                  onToggle={() => setHeatmapExpanded(!heatmapExpanded)}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
