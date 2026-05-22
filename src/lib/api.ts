import { useState, useCallback } from 'react'
import type { LatestResponse, HistoryBucket, TrafficSamplePoint, HeatmapResponse, HeatmapBucket, Incident, CorridorDirection } from './types'

const API_BASE = import.meta.env.VITE_API_URL || ''

export async function fetchLatest(): Promise<LatestResponse> {
  const res = await fetch(`${API_BASE}/api/traffic/latest`)
  if (!res.ok) throw new Error('Failed to fetch traffic data')
  return res.json()
}

export async function fetchHistory(hours = 24): Promise<HistoryBucket[]> {
  const res = await fetch(`${API_BASE}/api/traffic/history?hours=${hours}`)
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

export async function fetchSamples(hours = 3): Promise<TrafficSamplePoint[]> {
  const res = await fetch(`${API_BASE}/api/traffic/samples?hours=${hours}`)
  if (!res.ok) throw new Error('Failed to fetch samples')
  return res.json()
}

export async function fetchHeatmap(days = 14): Promise<HeatmapResponse> {
  const res = await fetch(`${API_BASE}/api/traffic/heatmap?days=${days}`)
  if (!res.ok) throw new Error('Failed to fetch heatmap')
  return res.json()
}

// ─── Traffic data hook ────────────────────────────────────────────

export type TrendRange = '3h' | '12h' | '24h'

export function useTrafficData() {
  const [data, setData] = useState<LatestResponse | null>(null)
  const [history, setHistory] = useState<HistoryBucket[]>([])
  const [samples, setSamples] = useState<TrafficSamplePoint[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (trendRange: TrendRange, initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)

    try {
      const trendRequest = trendRange === '3h'
        ? fetchSamples(3)
        : fetchHistory(trendRange === '12h' ? 12 : 24)
      const [latest, hist, heat] = await Promise.all([
        fetchLatest(),
        trendRequest,
        fetchHeatmap(14),
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
  }, [])

  const corridors = data?.corridors ?? {}
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

  return {
    data,
    history,
    samples,
    heatmap,
    loading,
    refreshing,
    error,
    corridors,
    incidents,
    load,
  }
}
