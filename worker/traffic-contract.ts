import type {
  ApiStatus,
  CongestionLevel,
  CorridorDirection,
  Incident,
  IncidentProbability,
  IncidentTimeValidity,
} from '../src/lib/types'

export interface LatestSampleRow {
  id: number
  direction: string
  duration_seconds: number
  no_traffic_seconds: number
  historic_seconds: number | null
  delay_seconds: number
  congestion_ratio: number
  distance_meters: number
  current_speed_kph: number
  free_flow_speed_kph: number
  route_polyline: string | null
  incidents: string | null
  api_status: string
  created_at: string
}

const STALE_THRESHOLD_MS = 30 * 60 * 1000

export function getCongestionLevel(ratio: number): CongestionLevel {
  if (ratio < 1.25) return 'light'
  if (ratio < 1.75) return 'moderate'
  if (ratio < 2.5) return 'heavy'
  return 'severe'
}

export function toISO(raw: string | null): string | null {
  if (!raw) return null
  if (raw.includes('T') && raw.endsWith('Z')) return raw
  return raw.replace(' ', 'T') + 'Z'
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100
}

function ratio(duration: number, baseline: number | null | undefined): number {
  return baseline != null && baseline > 0 ? roundRatio(duration / baseline) : 1
}

function normalizeIncident(raw: Record<string, unknown>): Incident {
  return {
    id: (raw.id ?? raw.incidentId) as string,
    type: raw.type as string,
    severity: raw.severity as string,
    description: raw.description as string,
    events: raw.events as Incident['events'],
    roadName: raw.roadName as string,
    from: raw.from as string,
    to: raw.to as string,
    delaySeconds: (raw.delaySeconds ?? raw.delay_seconds) as number | undefined,
    lengthMeters: (raw.lengthMeters ?? raw.length_meters) as number | undefined,
    startedAt: (raw.startedAt ?? raw.started_at) as string | undefined,
    endsAt: (raw.endsAt ?? raw.ends_at) as string | undefined,
    lastReportedAt: (raw.lastReportedAt ?? raw.last_reported_at) as string | undefined,
    timeValidity: (raw.timeValidity ?? raw.time_validity) as IncidentTimeValidity | undefined,
    probability: raw.probability as IncidentProbability | undefined,
    reportCount: (raw.reportCount ?? raw.report_count) as number | undefined,
    hasExpiredEndTime: (raw.hasExpiredEndTime ?? raw.has_expired_end_time) as boolean | undefined,
    lat: raw.lat as number | undefined,
    lng: raw.lng as number | undefined,
    tmc: raw.tmc as Incident['tmc'],
  }
}

function parseIncidents(raw: string | null): Incident[] {
  if (!raw) return []
  const parsed = JSON.parse(raw) as Record<string, unknown>[]
  return parsed.map(normalizeIncident)
}

function normalizeApiStatus(value: string): ApiStatus {
  return value === 'ok' || value === 'error' || value === 'seeded' ? value : 'error'
}

export function toCorridorDirection(row: LatestSampleRow): CorridorDirection {
  const usualBaseline = row.historic_seconds ?? row.no_traffic_seconds
  const usualRatio = ratio(row.duration_seconds, usualBaseline)
  const freeFlowRatio = ratio(row.duration_seconds, row.no_traffic_seconds)
  const ageMs = Date.now() - new Date(row.created_at + 'Z').getTime()

  return {
    direction: row.direction,
    durationSeconds: row.duration_seconds,
    noTrafficSeconds: row.no_traffic_seconds,
    historicSeconds: row.historic_seconds,
    usualDelaySeconds: Math.round(row.duration_seconds - usualBaseline),
    freeFlowDelaySeconds: Math.round(row.duration_seconds - row.no_traffic_seconds),
    usualRatio,
    freeFlowRatio,
    usualCongestionLevel: getCongestionLevel(usualRatio),
    freeFlowCongestionLevel: getCongestionLevel(freeFlowRatio),
    distanceMeters: row.distance_meters,
    currentSpeedKph: Math.round(row.current_speed_kph * 10) / 10,
    freeFlowSpeedKph: Math.round(row.free_flow_speed_kph * 10) / 10,
    routePolyline: row.route_polyline ?? null,
    incidents: parseIncidents(row.incidents),
    apiStatus: normalizeApiStatus(row.api_status),
    collectedAt: toISO(row.created_at) ?? '',
    isStale: ageMs > STALE_THRESHOLD_MS,
  }
}
