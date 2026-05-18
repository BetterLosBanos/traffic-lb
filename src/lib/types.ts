// ─── Corridor Config (matches worker) ────────────────────────────

export interface CorridorDef {
  id: string
  label: string
  forwardLabel: string
  reverseLabel: string
  a: { lat: number; lng: number }
  b: { lat: number; lng: number }
}

export const CORRIDORS: CorridorDef[] = [
  { id: 'pansol', label: 'Bucal Bypass ↔ Municipal Hall', forwardLabel: 'To Municipal Hall', reverseLabel: 'To Bucal Bypass', a: { lat: 14.1877993, lng: 121.1705503 }, b: { lat: 14.1773136, lng: 121.2216712 } },
  { id: 'municipal', label: 'Municipal Hall ↔ Crossing', forwardLabel: 'To Crossing', reverseLabel: 'To Municipal Hall', a: { lat: 14.1773136, lng: 121.2216712 }, b: { lat: 14.1783995, lng: 121.2422448 } },
  { id: 'uplb', label: 'Crossing ↔ UPLB Gate', forwardLabel: 'To UPLB', reverseLabel: 'To Crossing', a: { lat: 14.1783995, lng: 121.2422448 }, b: { lat: 14.1674438, lng: 121.2433791 } },
  { id: 'bay', label: 'Crossing ↔ Bay Arch', forwardLabel: 'To Bay', reverseLabel: 'To Crossing', a: { lat: 14.1783995, lng: 121.2422448 }, b: { lat: 14.1759658, lng: 121.2656562 } },
]

export const CORRIDOR_COLORS: Record<string, string> = {
  pansol: '#2563eb',      // blue-600
  municipal: '#e11d48',   // rose-600
  uplb: '#0f766e',        // teal-700
  bay: '#9333ea',         // purple-600
}

// ─── Direction Data (from /api/traffic/latest) ───────────────────

export interface Incident {
  type: string
  severity: string
  description: string
  roadName: string
  from: string
  to: string
  lat?: number
  lng?: number
}

export interface CorridorDirection {
  direction: string
  duration_seconds: number
  no_traffic_seconds: number
  historic_seconds: number | null
  delay_seconds: number
  congestion_ratio: number
  congestion_level: 'light' | 'moderate' | 'heavy' | 'severe'
  distance_meters: number
  route_polyline: string | null
  incidents: Incident[]
  api_status: string
  collected_at: string
  is_stale: boolean
}

// ─── API Responses ───────────────────────────────────────────────

export interface LatestResponse {
  status: 'ok' | 'no_data'
  corridors: Record<string, CorridorDirection>
  last_updated: string | null
}

export interface HistoryBucket {
  hour: string
  [dirKey: string]: any
}

export interface TrafficSamplePoint {
  time: string
  [dirKey: string]: any
}

export interface HealthResponse {
  status: 'ok'
  total_samples: number
  last_collection: string | null
  last_successful_collection: string | null
  error_count: number
  last_error_message: string | null
}
