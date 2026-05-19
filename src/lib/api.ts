import type { LatestResponse, HistoryBucket, TrafficSamplePoint, HeatmapResponse } from './types'

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
