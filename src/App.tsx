import { useState, useEffect, useCallback } from 'react'
import { Car, RefreshCw } from 'lucide-react'
import { TrafficCard } from './components/TrafficCard'
import { TrendChart } from './components/TrendChart'
import { RouteMap } from './components/RouteMap'
import { IncidentSummary } from './components/IncidentSummary'
import { ThemeToggle } from './components/ThemeToggle'
import { HeatmapChart } from './components/HeatmapChart'
import { fetchLatest, fetchHistory, fetchSamples, fetchHeatmap } from './lib/api'
import { CORRIDORS } from './lib/types'
import { ageText } from './lib/time'
import type { LatestResponse, HistoryBucket, Incident, TrafficSamplePoint, CorridorDirection, HeatmapBucket } from './lib/types'

type TrendRange = '3h' | '12h' | '24h'

// ─── Dynamic hero summary ───────────────────────────────────────

function heroSummary(corridors: Record<string, CorridorDirection>, baseline: 'historic' | 'ideal'): string {
  const all = Object.values(corridors) as CorridorDirection[]
  if (all.length === 0) return 'No live traffic data yet'

  const stale = all.filter(d => d.isStale)
  if (stale.length === all.length) return 'Traffic data may be outdated'

  const active = all.filter(d => !d.isStale)

  // Calculate delay based on baseline
  const withDelay = active.map(d => ({
    ...d,
    delayVsBaseline: baseline === 'historic'
      ? d.delaySeconds
      : d.durationSeconds - d.noTrafficSeconds
  }))

  const worst = withDelay.sort((a, b) => b.delayVsBaseline - a.delayVsBaseline)[0]

  if (!worst) return 'Traffic data may be outdated'

  const delayMin = Math.round(worst.delayVsBaseline / 60)
  const dirLabel = corridorLabel(worst.direction)

  if (delayMin <= 0 || worst.congestionLevel === 'light') return 'Roads moving well'
  if (worst.congestionLevel === 'moderate') return `+${delayMin} min delay ${dirLabel}`
  if (worst.congestionLevel === 'heavy') return `Heavy delay ${dirLabel}`
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
  const [data, setData] = useState<LatestResponse | null>(null)
  const [history, setHistory] = useState<HistoryBucket[]>([])
  const [samples, setSamples] = useState<TrafficSamplePoint[]>([])
  const [trendRange, setTrendRange] = useState<TrendRange>('3h')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapBucket[]>([])
  const [detailMode, setDetailMode] = useState(false)
  const [baseline, setBaseline] = useState<'historic' | 'ideal'>('historic')
  const [trendExpanded, setTrendExpanded] = useState(false)
  const [heatmapExpanded, setHeatmapExpanded] = useState(false)

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)

    try {
      const trendRequest = trendRange === '3h'
        ? fetchSamples(3)
        : fetchHistory(trendRange === '12h' ? 12 : 24)
      const [latest, hist, heat] = await Promise.all([
        fetchLatest(),
        trendRequest,
        fetchHeatmap(2),  // 2 days default, will grow over time
      ])
      setData(latest)
      if (trendRange === '3h') {
        setSamples(hist as TrafficSamplePoint[])
        setHistory([])
      } else {
        setHistory(hist as HistoryBucket[])
        setSamples([])
      }
      setHeatmap(heat.data)
      setError(null)
    } catch (err) {
      console.error('[traffic-lb] Failed to fetch traffic data:', err)
      setError('Unable to load traffic data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [trendRange])

  useEffect(() => {
    load(data === null)
    const interval = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (detailMode) {
      setTrendExpanded(true)
      setHeatmapExpanded(true)
    }
  }, [detailMode])

  const isNoData = data?.status === 'no_data'
  const corridors = data?.corridors ?? {}
  const hasData = data?.status === 'ok' && Object.keys(corridors).length > 0
  const isStale = hasData && Object.values(corridors).some((d: CorridorDirection) => d.isStale)
  const summary = hasData ? heroSummary(corridors, baseline) : ''

  // Deduplicate incidents across all corridor directions
  const incidents: Incident[] = []
  const seenIncidents = new Set<string>()
  if (data?.status === 'ok') {
    for (const dir of Object.values(corridors) as CorridorDirection[]) {
      for (const inc of dir.incidents) {
        const key = `${inc.type}|${inc.severity}|${inc.roadName}|${inc.from}|${inc.description}`
        if (!seenIncidents.has(key)) {
          seenIncidents.add(key)
          incidents.push(inc)
        }
      }
    }
  }

  return (
    <div className="min-h-screen textured" style={{ backgroundColor: 'var(--color-surface)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ backgroundColor: 'color-mix(in srgb, var(--color-surface) 85%, transparent)', borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            <Car size={16} strokeWidth={2} />
            Traffic Ba Sa LB?
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBaseline(baseline === 'historic' ? 'ideal' : 'historic')}
              className="text-xs font-medium rounded-md px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                backgroundColor: 'var(--color-surface-overlay)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                outlineColor: 'var(--color-focus)',
              }}
              aria-pressed={baseline === 'ideal'}
            >
              Compare: {baseline === 'historic' ? 'Normal ▾' : 'No traffic ▾'}
            </button>
            <button
              onClick={() => setDetailMode(!detailMode)}
              className="text-xs font-medium rounded-md px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                backgroundColor: detailMode ? 'var(--color-surface-overlay)' : 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                outlineColor: 'var(--color-focus)',
              }}
              aria-pressed={detailMode}
            >
              {detailMode ? 'Detailed ▾' : 'Simple ☰'}
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
            <button onClick={() => load(!hasData)} className="mt-2 min-h-11 px-3 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--color-focus)' }}>
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
                    baseline={baseline}
                    onDirectionZoom={(dirKey) => {
                      const isForward = dirKey.endsWith('_f')
                      setFlyTo(isForward ? b : a)
                    }}
                  />
                )
              })}
            </div>

            {/* 2. Compact trust strip */}
            <div className="flex items-center justify-center gap-3 text-xs mb-8" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isStale ? 'var(--color-congestion-heavy)' : 'var(--color-congestion-light)' }} aria-hidden="true" />
                {isStale ? 'Stale data' : 'Fresh'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Updated {ageText(data!.lastUpdated)}</span>
              <span aria-hidden="true">·</span>
              <button
                onClick={() => load()}
                disabled={refreshing}
                className="flex items-center gap-1 min-h-6 px-1.5 underline underline-offset-2 disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--color-focus)' }}
              >
                <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
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
                baseline={baseline}
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
