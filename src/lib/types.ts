// ─── Union Types ────────────────────────────────────────────────

export type CongestionLevel = 'light' | 'moderate' | 'heavy' | 'severe'

export type IncidentType =
  | 'Unknown' | 'Accident' | 'Fog' | 'Dangerous Conditions'
  | 'Rain' | 'Ice' | 'Jam' | 'Lane Closed' | 'Road Closed'
  | 'Road Works' | 'Wind' | 'Flooding' | 'Broken Down Vehicle'

export type IncidentSeverity = 'unknown' | 'minor' | 'moderate' | 'major' | 'severe'
export type ApiStatus = 'ok' | 'error' | 'seeded'
export type IncidentProbability = 'certain' | 'probable' | 'risk_of' | 'improbable'
export type IncidentTimeValidity = 'present' | 'future'
export type IncidentTmcDirection = 'positive' | 'negative'
export type TrafficBaseline = 'usual' | 'freeFlow'

// ─── Corridor Config (matches worker) ────────────────────────────

export interface CorridorDef {
  id: string
  label: string
  tabLabel: string
  forwardLabel: string
  reverseLabel: string
  a: { lat: number; lng: number }
  b: { lat: number; lng: number }
}

export const CORRIDORS: CorridorDef[] = [
  { id: 'pansol', label: 'Bucal Bypass ↔ Municipal Hall', tabLabel: 'Lalakay', forwardLabel: 'To Municipal Hall', reverseLabel: 'To Bucal Bypass', a: { lat: 14.1877993, lng: 121.1705503 }, b: { lat: 14.1773136, lng: 121.2216712 } },
  { id: 'municipal', label: 'Municipal Hall ↔ Crossing', tabLabel: 'Anos', forwardLabel: 'To Crossing', reverseLabel: 'To Municipal Hall', a: { lat: 14.1773136, lng: 121.2216712 }, b: { lat: 14.1783995, lng: 121.2422448 } },
  { id: 'uplb', label: 'Crossing ↔ UPLB Gate', tabLabel: 'Lopez Ave', forwardLabel: 'To UPLB', reverseLabel: 'To Crossing', a: { lat: 14.1783995, lng: 121.2422448 }, b: { lat: 14.1674438, lng: 121.2433791 } },
  { id: 'bay', label: 'Crossing ↔ Bay Arch', tabLabel: 'Maahas', forwardLabel: 'To Bay', reverseLabel: 'To Crossing', a: { lat: 14.1783995, lng: 121.2422448 }, b: { lat: 14.1759658, lng: 121.2656562 } },
]

export const CORRIDOR_COLORS: Record<string, string> = {
  pansol: '#2563eb',      // blue-600
  municipal: '#e11d48',   // rose-600
  uplb: '#0f766e',        // teal-700
  bay: '#9333ea',         // purple-600
}

// ─── Direction Data (from /api/traffic/latest) ───────────────────

export interface Incident {
  id?: string
  type: IncidentType | string
  severity: IncidentSeverity | string
  description: string
  events?: IncidentEvent[]
  roadName: string
  from: string
  to: string
  delaySeconds?: number
  lengthMeters?: number
  startedAt?: string
  endsAt?: string
  lastReportedAt?: string
  timeValidity?: IncidentTimeValidity
  probability?: IncidentProbability
  reportCount?: number
  hasExpiredEndTime?: boolean
  lat?: number
  lng?: number
  tmc?: IncidentTmc
}

export interface IncidentEvent {
  description: string
  code?: number
  iconCategory?: number
}

export interface IncidentTmc {
  countryCode: string
  tableNumber: string
  tableVersion: string
  direction: IncidentTmcDirection
  points: IncidentTmcPoint[]
}

export interface IncidentTmcPoint {
  location: number
  offset?: number
}

export interface CorridorDirection {
  direction: string
  durationSeconds: number
  noTrafficSeconds: number
  historicSeconds: number | null
  usualDelaySeconds: number
  freeFlowDelaySeconds: number
  usualRatio: number
  freeFlowRatio: number
  usualCongestionLevel: CongestionLevel
  freeFlowCongestionLevel: CongestionLevel
  distanceMeters: number
  currentSpeedKph: number
  freeFlowSpeedKph: number
  routePolyline: string | null
  incidents: Incident[]
  apiStatus: ApiStatus
  collectedAt: string
  isStale: boolean
}

// ─── API Responses ───────────────────────────────────────────────

export interface LatestResponse {
  status: 'ok' | 'no_data'
  corridors: Record<string, CorridorDirection>
  lastUpdated: string | null
}

export interface DirectionHistoryData {
  avgDuration: number
  avgNoTraffic: number
  avgHistoric: number | null
  avgUsualDelaySeconds: number
  avgFreeFlowDelaySeconds: number
  avgUsualRatio: number
  avgFreeFlowRatio: number
  avgCurrentSpeedKph: number
  avgFreeFlowSpeedKph: number
  sampleCount: number
}

export interface HistoryBucket {
  hour: string
  [dirKey: string]: string | DirectionHistoryData | undefined
}

export interface DirectionSampleData {
  durationSeconds: number
  noTrafficSeconds: number
  historicSeconds: number | null
  usualDelaySeconds: number
  freeFlowDelaySeconds: number
  usualRatio: number
  freeFlowRatio: number
  currentSpeedKph: number
  freeFlowSpeedKph: number
}

export interface TrafficSamplePoint {
  time: string
  [dirKey: string]: string | DirectionSampleData | undefined
}

export interface HealthResponse {
  status: 'ok'
  totalSamples: number
  lastCollection: string | null
  lastSuccessfulCollection: string | null
  errorCount: number
  lastErrorMessage: string | null
}

// ─── Heatmap (P50/P90 per hour-of-week) ──────────────────────────

export interface HeatmapBucket {
  direction: string       // 'pansol_f', 'pansol_r', etc.
  dow: number             // 0=Sun, 1=Mon, ..., 6=Sat (Manila local)
  hr: number              // 0–23 (Manila local)
  sampleCount: number
  avgUsualDelaySeconds: number
  avgFreeFlowDelaySeconds: number
  p50UsualDelaySeconds: number | null
  p50FreeFlowDelaySeconds: number | null
  p90UsualDelaySeconds: number | null
  p90FreeFlowDelaySeconds: number | null
  incidentCount: number
}

export interface HeatmapResponse {
  data: HeatmapBucket[]
}

// ─── TomTom API Response Types ───────────────────────────────────

export interface TomTomRouteResponse {
  routes?: TomTomRoute[]
  formatVersion?: string
}

export interface TomTomRoute {
  summary: TomTomRouteSummary
  legs?: TomTomRouteLeg[]
}

export interface TomTomRouteSummary {
  travelTimeInSeconds: number
  noTrafficTravelTimeInSeconds?: number
  historicTrafficTravelTimeInSeconds?: number
  lengthInMeters: number
  trafficDelayInSeconds?: number
}

export interface TomTomRouteLeg {
  points?: { latitude: number; longitude: number }[]
}

export interface TomTomIncidentsResponse {
  incidents?: TomTomIncident[]
}

export interface TomTomIncident {
  type?: string
  geometry?: { type: string; coordinates: number[] | number[][] }
  properties?: TomTomIncidentProperties
}

export interface TomTomIncidentProperties {
  id?: string
  iconCategory?: number
  magnitudeOfDelay?: number
  events?: { description?: string; code?: number; iconCategory?: number }[]
  startTime?: string
  endTime?: string
  from?: string
  to?: string
  roadNumbers?: string[]
  delay?: number
  length?: number
  timeValidity?: string
  probabilityOfOccurrence?: string
  numberOfReports?: number
  lastReportTime?: string
  tmc?: {
    countryCode?: string
    tableNumber?: string
    tableVersion?: string
    direction?: string
    points?: { location?: number; offset?: number }[]
  } | null
}
