import { TrendingUp } from 'lucide-react'
import { useState, useMemo } from 'react'
import type { HistoryBucket, TrafficBaseline, TrafficSamplePoint } from '../lib/types'
import { CORRIDORS, CORRIDOR_COLORS } from '../lib/types'

type TrendRange = '3h' | '12h' | '24h'
type TrendMetric = 'multiplier' | 'delay'

interface TrendChartProps {
  history: HistoryBucket[]
  samples: TrafficSamplePoint[]
  range: TrendRange
  onRangeChange: (range: TrendRange) => void
  expanded: boolean
  onToggle: () => void
}

interface ChartSeries {
  key: string
  label: string
  color: string
  values: (number | null)[]
}

const RANGE_LABELS: Record<TrendRange, string> = {
  '3h': '3h',
  '12h': '12h',
  '24h': '24h',
}

const METRIC_LABELS: Record<TrendMetric, string> = {
  multiplier: 'Multiplier',
  delay: 'Delay (min)',
}

function secondsToMinutes(seconds: number) {
  return Math.round(seconds / 60)
}

interface HistoryDirData {
  avgDuration: number
  avgNoTraffic: number
  avgHistoric: number | null
  avgUsualDelaySeconds: number
  avgFreeFlowDelaySeconds: number
  avgUsualRatio: number
  avgFreeFlowRatio: number
}

interface SampleDirData {
  durationSeconds: number
  noTrafficSeconds: number
  historicSeconds: number | null
  usualDelaySeconds: number
  freeFlowDelaySeconds: number
  usualRatio: number
  freeFlowRatio: number
}

function extractValue(entry: HistoryDirData | SampleDirData | undefined, metric: TrendMetric, baseline: TrafficBaseline): number | null {
  if (!entry) return null

  if ('durationSeconds' in entry) {
    if (metric === 'delay') {
      return secondsToMinutes(baseline === 'usual' ? entry.usualDelaySeconds : entry.freeFlowDelaySeconds)
    }
    return baseline === 'usual' ? entry.usualRatio : entry.freeFlowRatio
  }

  if (metric === 'delay') {
    return secondsToMinutes(baseline === 'usual' ? entry.avgUsualDelaySeconds : entry.avgFreeFlowDelaySeconds)
  }
  return baseline === 'usual' ? entry.avgUsualRatio : entry.avgFreeFlowRatio
}

function formatTime(value: string, range: TrendRange) {
  // API returns ISO 8601 UTC. new Date() parses correctly with Z suffix.
  const date = new Date(value)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: range === '3h' ? '2-digit' : undefined,
  })
  return formatter.format(date).toLowerCase().replace(' ', '')
}

function latestPoint(values: (number | null)[]) {
  for (let i = values.length - 1; i >= 0; i--) {
    const value = values[i]
    if (value !== null) return { index: i, value }
  }
  return null
}

function niceCeil(value: number) {
  if (value <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const residual = value / magnitude
  const nice = residual <= 1.5 ? 1.5 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 3 ? 3 : residual <= 4 ? 4 : residual <= 5 ? 5 : residual <= 7.5 ? 7.5 : 10
  return nice * magnitude
}

function formatValue(value: number, metric: TrendMetric) {
  if (metric === 'delay') {
    const rounded = Math.round(value)
    return rounded > 0 ? `+${rounded} min` : rounded < 0 ? `${rounded} min` : '0 min'
  }
  return `${value.toFixed(1)}x`
}

// Get dir keys from data — validate by suffix to avoid matching future non-direction object fields
function getDirKeys(data: Record<string, unknown>[]): string[] {
  const keys = new Set<string>()
  for (const entry of data) {
    for (const key of Object.keys(entry)) {
      if (
        (key.endsWith('_f') || key.endsWith('_r')) &&
        entry[key] !== null &&
        typeof entry[key] === 'object'
      ) {
        keys.add(key)
      }
    }
  }
  return Array.from(keys).sort()
}

function getCorridorId(dirKey: string): string {
  // 'pansol_f' → 'pansol', 'municipal_r' → 'municipal'
  return dirKey.replace(/_[fr]$/, '')
}

function getSeriesLabel(dirKey: string): string {
  const corridorId = getCorridorId(dirKey)
  const corridor = CORRIDORS.find(c => c.id === corridorId)
  const isForward = dirKey.endsWith('_f')
  return corridor ? (isForward ? corridor.forwardLabel : corridor.reverseLabel) : dirKey
}

export function TrendChart({ history, samples, range, onRangeChange, expanded, onToggle }: TrendChartProps) {
  const [metric, setMetric] = useState<TrendMetric>('multiplier')
  const [baseline, setBaseline] = useState<TrafficBaseline>('freeFlow')

  const sourceData = range === '3h' ? samples : history
  const timeKey = range === '3h' ? 'time' : 'hour'

  const dirKeys = useMemo(() => getDirKeys(sourceData), [sourceData])

  const series: ChartSeries[] = useMemo(() =>
    dirKeys.map(key => ({
      key,
      label: getSeriesLabel(key),
      color: CORRIDOR_COLORS[getCorridorId(key)] ?? '#6b7280',
      values: sourceData.map(entry => extractValue(entry[key] as HistoryDirData | SampleDirData | undefined, metric, baseline)),
    })),
    [dirKeys, sourceData, metric, baseline]
  )

  const hasData = series.some(s => s.values.some(v => v !== null))

  const width = 640
  const height = 260
  const pad = { top: 18, right: 36, bottom: 42, left: 46 }
  const chartW = width - pad.left - pad.right
  const chartH = height - pad.top - pad.bottom

  const allValues = series.flatMap(s => s.values).filter((v): v is number => v !== null)
  const dataMin = Math.min(...allValues)
  const dataMax = Math.max(...allValues)

  // Smart y-axis range: include 0 for delay, 1x for multiplier, but don't waste space
  const minValue = metric === 'multiplier'
    ? (baseline === 'usual' ? Math.min(0.8, dataMin) : 1)
    : Math.min(0, dataMin) // Never go below 0 for delay
  const maxValue = niceCeil(Math.max(metric === 'delay' ? 5 : 1.5, dataMax))
  const tickCount = 5

  // Ensure key values (0 for delay, 1x for multiplier) are always visible
  const keyTick = metric === 'multiplier' ? 1 : 0
  const ticks: number[] = []
  ticks.push(minValue)
  ticks.push(maxValue)
  // Insert key tick if not already at boundaries
  if (keyTick > minValue && keyTick < maxValue) {
    ticks.push(keyTick)
  }
  // Fill remaining ticks evenly
  while (ticks.length < tickCount) {
    const range = maxValue - minValue
    const step = range / (tickCount - 1)
    for (let i = 1; i < tickCount - 1; i++) {
      const tick = Math.round((minValue + step * i) * 100) / 100
      if (!ticks.some(t => Math.abs(t - tick) < 0.01)) {
        ticks.push(tick)
      }
    }
    break
  }
  ticks.sort((a, b) => a - b)

  const areaBaseline = metric === 'multiplier' ? 1 : 0

  const data = sourceData
  const x = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * chartW
  const y = (v: number) => pad.top + chartH - ((v - minValue) / (maxValue - minValue)) * chartH

  const buildLine = (values: (number | null)[]) => {
    let open = false
    return values.flatMap((v, i) => {
      if (v === null) { open = false; return [] }
      const cmd = open ? 'L' : 'M'
      open = true
      return [`${cmd}${x(i)},${y(v)}`]
    }).join(' ')
  }

  const buildAreas = (values: (number | null)[]) => {
    const paths: string[] = []
    let run: { i: number; v: number }[] = []
    const closeRun = () => {
      if (run.length < 2) { run = []; return }
      const line = run.map((p, idx) => `${idx ? 'L' : 'M'}${x(p.i)},${y(p.v)}`).join(' ')
      const first = run[0]
      const last = run[run.length - 1]
      paths.push(`${line} L${x(last.i)},${y(areaBaseline)} L${x(first.i)},${y(areaBaseline)} Z`)
      run = []
    }
    values.forEach((v, i) => {
      if (v === null) { closeRun(); return }
      run.push({ i, v })
    })
    closeRun()
    return paths
  }

  const buildGapBridges = (values: (number | null)[]) => {
    const bridges: { x1: number; x2: number; y: number }[] = []
    let previous: { i: number; v: number } | null = null
    let gapStart: number | null = null
    values.forEach((v, i) => {
      if (v === null) { if (previous) gapStart = gapStart ?? i; return }
      if (previous && gapStart !== null) {
        bridges.push({ x1: x(previous.i), x2: x(i), y: y((previous.v + v) / 2) })
      }
      previous = { i, v }
      gapStart = null
    })
    return bridges
  }

  const labelInterval = range === '3h'
    ? Math.max(1, Math.ceil(data.length / 4))
    : Math.max(1, Math.ceil(data.length / 6))

  const gridColor = 'var(--color-border)'
  const mutedColor = 'var(--color-text-muted)'

  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 border-b"
        style={{ outlineColor: 'var(--color-focus)', borderColor: 'var(--color-border)' }}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-1.5">
          <TrendingUp size={13} aria-hidden="true" style={{ color: 'var(--color-text-muted)' }} />
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Traffic Trend
          </h2>
        </div>
        <span aria-hidden="true" style={{ color: 'var(--color-text-muted)' }}>
          {expanded ? '▼' : '▾'}
        </span>
      </button>

      {expanded && (
        <div className="p-4 sm:p-5 pt-4 flex flex-col h-full min-h-[360px]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Is it getting better or worse?
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto_auto]">
              <div className="grid grid-cols-2 rounded-lg p-0.5" style={{ backgroundColor: 'var(--color-surface-overlay)', border: '1px solid var(--color-border)' }}>
                {(Object.keys(METRIC_LABELS) as TrendMetric[]).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMetric(option)}
                    className="min-h-9 rounded-md px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all"
                    style={{
                      color: metric === option ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      backgroundColor: metric === option ? 'var(--color-surface-raised)' : 'transparent',
                      '--tw-ring-color': 'var(--color-focus)',
                      '--tw-ring-offset-color': 'var(--color-surface-raised)',
                    } as React.CSSProperties}
                    aria-pressed={metric === option}
                  >
                    {METRIC_LABELS[option]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 rounded-lg p-0.5" style={{ backgroundColor: 'var(--color-surface-overlay)', border: '1px solid var(--color-border)' }}>
                {(['usual', 'freeFlow'] as const).map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBaseline(b)}
                    className="min-h-9 rounded-md px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all"
                    style={{
                      color: baseline === b ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      backgroundColor: baseline === b ? 'var(--color-surface-raised)' : 'transparent',
                      '--tw-ring-color': 'var(--color-focus)',
                      '--tw-ring-offset-color': 'var(--color-surface-raised)',
                    } as React.CSSProperties}
                    aria-pressed={baseline === b}
                  >
                    {b === 'usual' ? 'Usual' : 'Best'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 rounded-lg p-0.5" style={{ backgroundColor: 'var(--color-surface-overlay)', border: '1px solid var(--color-border)' }}>
                {(Object.keys(RANGE_LABELS) as TrendRange[]).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onRangeChange(option)}
                    className="min-h-9 rounded-md px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all"
                    style={{
                      color: range === option ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      backgroundColor: range === option ? 'var(--color-surface-raised)' : 'transparent',
                      '--tw-ring-color': 'var(--color-focus)',
                      '--tw-ring-offset-color': 'var(--color-surface-raised)',
                    } as React.CSSProperties}
                    aria-pressed={range === option}
                  >
                    {RANGE_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!hasData ? (
            <div className="flex-1 min-h-[240px] flex items-center justify-center">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No trend data yet</p>
            </div>
          ) : (
            <div className="flex-1 min-h-[240px]">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${range} traffic ${metric === 'delay' ? 'delay' : 'multiplier'} trend`}>
            {ticks.map(tick => {
              const isBaseline = metric === 'multiplier' && Math.abs(tick - 1) < 0.01
              return (
                <g key={tick}>
                  <line x1={pad.left} y1={y(tick)} x2={width - pad.right} y2={y(tick)} stroke={gridColor} strokeDasharray={isBaseline ? undefined : '4'} strokeWidth={isBaseline ? 1.2 : 0.7} />
                  <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="13" fontWeight={isBaseline ? 600 : 500} fill={mutedColor}>
                    {metric === 'delay' ? `${Math.round(tick)}` : `${tick.toFixed(1)}x`}
                  </text>
                </g>
              )
            })}

            {series.map((s) => {
              const line = buildLine(s.values)
              const areas = buildAreas(s.values)
              const gaps = buildGapBridges(s.values)
              const latest = latestPoint(s.values)
              // Forward = solid, reverse = dashed (WCAG 1.4.1)
              const isReverse = s.key.endsWith('_r')
              const dash = isReverse ? '8 4' : undefined
              return (
                <g key={s.key}>
                  {areas.map((area, i) => (
                    <path key={`area-${i}`} d={area} fill={s.color} fillOpacity={0.08} />
                  ))}
                  {gaps.map((bridge, i) => (
                    <line key={`gap-${i}`} x1={bridge.x1} y1={bridge.y} x2={bridge.x2} y2={bridge.y} stroke={s.color} strokeWidth={2} strokeDasharray="3 6" strokeLinecap="round" opacity={0.38} />
                  ))}
                  <path d={line} fill="none" stroke={s.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
                  {latest && (
                    <circle cx={x(latest.index)} cy={y(latest.value)} r={4.5} fill={s.color} stroke="var(--color-surface-raised)" strokeWidth={2} />
                  )}
                </g>
              )
            })}

            {data.map((entry, i) => {
              if (i % labelInterval !== 0 && i !== data.length - 1) return null
              const timeVal = entry[timeKey] as string
              return (
                <text key={`${timeVal}-${i}`} x={x(i)} y={height - 12} textAnchor="middle" fontSize="12" fontWeight="500" fill={mutedColor}>
                  {formatTime(timeVal, range)}
                </text>
              )
            })}
          </svg>
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {series.map((s) => {
          const latest = latestPoint(s.values)
          const isReverse = s.key.endsWith('_r')
          const dash = isReverse ? '8 4' : undefined
          return (
            <div key={s.key} className="flex items-center gap-1.5">
              <svg width="16" height="6" aria-hidden="true" className="inline-block">
                <line x1="0" y1="3" x2="16" y2="3" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={dash} />
              </svg>
              <span>{s.label}{latest !== null ? ` · ${formatValue(latest.value, metric)}` : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
      )}
    </div>
  )
}
