import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type {
  CongestionLevel,
  Incident,
  IncidentProbability,
  IncidentSeverity,
  IncidentTimeValidity,
  TomTomIncident,
  TomTomIncidentsResponse,
  TomTomRouteLeg,
  TomTomRouteResponse,
} from '../src/lib/types'

// ─── Types ───────────────────────────────────────────────────────

interface Env {
  DB: D1Database
  TOMTOM_API_KEY: string
}

interface RouteResult {
  duration_seconds: number
  no_traffic_seconds: number
  historic_seconds: number | null
  delay_seconds: number
  congestion_ratio: number
  distance_meters: number
  traffic_delay_seconds: number
  route_polyline: string | null
}

// D1 row types — snake_case, matching DB columns

interface HealthRow {
  total_samples: number
  last_collection: string | null
  last_successful_collection: string | null
  error_count: number
  last_error_message: string | null
}

interface LatestSampleRow {
  id: number
  direction: string
  duration_seconds: number
  no_traffic_seconds: number
  historic_seconds: number | null
  delay_seconds: number
  congestion_ratio: number
  distance_meters: number
  route_polyline: string | null
  incidents: string | null
  api_status: string
  created_at: string
}

interface HistoryRow {
  direction: string
  hour: string
  avg_duration: number
  avg_no_traffic: number
  avg_ratio: number
  avg_delay: number
  sample_count: number
}

interface SampleRow {
  direction: string
  time: string
  duration_seconds: number
  no_traffic_seconds: number
  congestion_ratio: number
  delay_seconds: number
}

// ─── Corridors ───────────────────────────────────────────────────

interface Corridor {
  id: string
  label: string
  a: { lat: number; lng: number }
  b: { lat: number; lng: number }
  waypoints?: { lat: number; lng: number }[]  // intermediate points to constrain route
}

// 4 corridors across Los Baños, each stored as {id}_f (a→b) and {id}_r (b→a)
const CORRIDORS: Corridor[] = [
  {
    id: 'pansol',
    label: 'Bucal Bypass → Municipal Hall',
    a: { lat: 14.1877993, lng: 121.1705503 },  // Bucal Bypass
    b: { lat: 14.1773136, lng: 121.2216712 },   // LB Municipal Hall
    waypoints: [
      { lat: 14.185526, lng: 121.172035 },
      { lat: 14.1803876, lng: 121.1797679 },
      { lat: 14.1768233, lng: 121.1864909 },
    ],
  },
  {
    id: 'municipal',
    label: 'Municipal Hall → Crossing LB',
    a: { lat: 14.1773136, lng: 121.2216712 },   // LB Municipal Hall
    b: { lat: 14.1783995, lng: 121.2422448 },   // Crossing Los Baños
    waypoints: [
      { lat: 14.1782707, lng: 121.2238945 },
    ],
  },
  {
    id: 'uplb',
    label: 'Crossing LB → UPLB Gate',
    a: { lat: 14.1783995, lng: 121.2422448 },   // Crossing Los Baños
    b: { lat: 14.1674438, lng: 121.2433791 },   // UPLB Gate
  },
  {
    id: 'bay',
    label: 'Crossing LB → Bay Arch',
    a: { lat: 14.1783995, lng: 121.2422448 },   // Crossing Los Baños
    b: { lat: 14.1759658, lng: 121.2656562 },   // Bay Welcome Arch
  },
]

// Bounding box for incidents: all corridor endpoints with padding
const ALL_POINTS = CORRIDORS.flatMap(c => [c.a, c.b])
const INCIDENTS_BBOX = (() => {
  const lats = ALL_POINTS.map(p => p.lat)
  const lngs = ALL_POINTS.map(p => p.lng)
  const pad = 0.003
  return `${Math.min(...lngs) - pad},${Math.min(...lats) - pad},${Math.max(...lngs) + pad},${Math.max(...lats) + pad}`
})()

// How old before data is considered stale (ms) — 30 minutes
const STALE_THRESHOLD_MS = 30 * 60 * 1000

function getCongestionLevel(ratio: number): CongestionLevel {
  if (ratio < 1.25) return 'light'
  if (ratio < 1.75) return 'moderate'
  if (ratio < 2.5) return 'heavy'
  return 'severe'
}

// D1's datetime('now') returns UTC as 'YYYY-MM-DD HH:MM:SS' (no T, no Z).
// Normalize to proper ISO 8601 UTC for the frontend.
function toISO(raw: string | null): string | null {
  if (!raw) return null
  // Already ISO? Return as-is.
  if (raw.includes('T') && raw.endsWith('Z')) return raw
  // D1 format: space separator, no Z. Also handles strftime output like '2025-05-18T07:00:00'.
  return raw.replace(' ', 'T') + 'Z'
}

function isLocalRequest(url: string): boolean {
  const { hostname } = new URL(url)
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function parseHistoryHours(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '24', 10)
  if (!Number.isFinite(parsed)) return 24
  return Math.min(Math.max(parsed, 1), 168)
}



// ─── TomTom API Calls ────────────────────────────────────────────

// Encode coordinate pairs as a simple comma-separated string for frontend decoding.
// Format: "lat,lng,lat,lng,..." — compact and avoids depending on a polyline lib.
function encodeFlexiblePolyline(points: { latitude: number; longitude: number }[]): string {
  return points.map(p => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`).join(';')
}

async function fetchRoute(env: Env, origin: { lat: number; lng: number }, dest: { lat: number; lng: number }, waypoints?: { lat: number; lng: number }[]): Promise<RouteResult> {
  const allPoints = [origin, ...(waypoints ?? []), dest]
  const locations = allPoints.map(p => `${p.lat},${p.lng}`).join(':')
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?key=${env.TOMTOM_API_KEY}&traffic=true&travelMode=car&computeTravelTimeFor=all&sectionType=traffic&routeRepresentation=polyline`

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Routing API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as TomTomRouteResponse
  const route = data.routes?.[0]
  const summary = route?.summary
  if (!summary) throw new Error(`No route in TomTom response for ${origin.lat},${origin.lng} → ${dest.lat},${dest.lng}`)

  const duration = summary.travelTimeInSeconds
  const noTraffic = summary.noTrafficTravelTimeInSeconds ?? duration
  const points = route?.legs?.flatMap((l: TomTomRouteLeg) => l.points ?? []) ?? []
  const encodedPolyline = points.length > 0 ? encodeFlexiblePolyline(points) : null

  return {
    duration_seconds: duration,
    no_traffic_seconds: noTraffic,
    historic_seconds: summary.historicTrafficTravelTimeInSeconds ?? null,
    delay_seconds: duration - noTraffic,
    congestion_ratio: Math.round((duration / noTraffic) * 100) / 100,
    distance_meters: summary.lengthInMeters,
    traffic_delay_seconds: summary.trafficDelayInSeconds ?? 0,
    route_polyline: encodedPolyline,
  }
}

async function fetchIncidents(env: Env): Promise<Incident[]> {
  // v5 API: fields nested under properties{}, descriptions in events[], categoryFilter uses PascalCase
  const fields = encodeURIComponent('{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,iconCategory},startTime,endTime,from,to,roadNumbers,delay,length,timeValidity,probabilityOfOccurrence,numberOfReports,lastReportTime}}}')
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${env.TOMTOM_API_KEY}&bbox=${INCIDENTS_BBOX}&fields=${fields}&language=en-US&timeValidityFilter=present`

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Incidents API ${res.status}: ${body.slice(0, 200)}`)
  }

  const MAGNITUDE_LABEL: Record<number, IncidentSeverity> = {
    0: 'unknown',
    1: 'minor',
    2: 'moderate',
    3: 'major',
    4: 'severe',
  }

  const ICON_CATEGORY_LABEL: Record<number, string> = {
    0: 'Unknown', 1: 'Accident', 2: 'Fog', 3: 'Dangerous Conditions',
    4: 'Rain', 5: 'Ice', 6: 'Jam', 7: 'Lane Closed',
    8: 'Road Closed', 9: 'Road Works', 10: 'Wind', 11: 'Flooding',
    14: 'Broken Down Vehicle',
  }

  const data = (await res.json()) as TomTomIncidentsResponse
  const incidents = data?.incidents ?? []
  const cleanString = (v: unknown) => (typeof v === 'string' && v !== 'null' && v !== '') ? v : undefined
  const cleanNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v)) ? v : undefined
  const cleanTimeValidity = (v: unknown): IncidentTimeValidity | undefined => (
    v === 'present' || v === 'future' ? v : undefined
  )
  const cleanProbability = (v: unknown): IncidentProbability | undefined => (
    v === 'certain' || v === 'probable' || v === 'risk_of' || v === 'improbable' ? v : undefined
  )

  return incidents.map((inc: TomTomIncident) => {
    const props = inc.properties ?? {}
    const geom = inc.geometry?.coordinates // Point: [lng,lat] or LineString: [[lng,lat],...]
    const events = props.events ?? []
    const roadNums = props.roadNumbers ?? []

    let lat: number | undefined
    let lng: number | undefined
    if (geom) {
      const coord = Array.isArray(geom[0]) ? geom[0] : geom  // LineString or Point
      lng = (coord as number[])[0]
      lat = (coord as number[])[1]
    }

    const startedAt = cleanString(props.startTime)
    const endsAt = cleanString(props.endTime)
    const lastReportedAt = cleanString(props.lastReportTime)
    const endMs = typeof endsAt === 'string' ? new Date(endsAt).getTime() : NaN

    return {
      id: cleanString(props.id),
      type: ICON_CATEGORY_LABEL[props.magnitudeOfDelay ?? 0] ?? 'Unknown',
      severity: MAGNITUDE_LABEL[props.magnitudeOfDelay ?? 0] ?? 'unknown',
      description: events[0]?.description ?? '',
      roadName: roadNums[0] ?? '',
      from: props.from ?? '',
      to: props.to ?? '',
      started_at: startedAt,
      ends_at: endsAt,
      last_reported_at: lastReportedAt,
      time_validity: cleanTimeValidity(props.timeValidity),
      probability: cleanProbability(props.probabilityOfOccurrence),
      report_count: cleanNumber(props.numberOfReports),
      has_expired_end_time: Number.isFinite(endMs) && endMs < Date.now(),
      ...(lat != null && lng != null ? { lat, lng } : {}),
    }
  })
}

// ─── Cron: Collect Traffic Data ──────────────────────────────────

const RETENTION_DAYS = 14

async function collectTraffic(env: Env): Promise<void> {
  // Purge stale data before collecting new samples
  await env.DB.prepare(
    `DELETE FROM traffic_samples WHERE created_at < datetime('now', ?)`,
  ).bind(`-${RETENTION_DAYS} days`).run()

  let incidents: Incident[] = []
  try {
    incidents = await fetchIncidents(env)
  } catch (error) {
    console.error('[collectTraffic] incidents fetch failed:', error)
    // Continue without incidents — don't block route data collection
  }

  for (const corridor of CORRIDORS) {
    for (const direction of ['f', 'r'] as const) {
      const dirKey = `${corridor.id}_${direction}`
      const origin = direction === 'f' ? corridor.a : corridor.b
      const dest = direction === 'f' ? corridor.b : corridor.a
      const wps = corridor.waypoints
        ? (direction === 'f' ? corridor.waypoints : [...corridor.waypoints].reverse())
        : undefined

      let apiStatus: 'ok' | 'error' = 'ok'
      let errorMessage: string | null = null
      let route: RouteResult | null = null

      try {
        route = await fetchRoute(env, origin, dest, wps)
      } catch (err) {
        apiStatus = 'error'
        errorMessage = err instanceof Error ? err.message : String(err)
        console.error(`Routing failed for ${dirKey}:`, errorMessage)
      }

      await env.DB.prepare(`
        INSERT INTO traffic_samples (
          direction, duration_seconds, no_traffic_seconds, historic_seconds,
          delay_seconds, congestion_ratio, distance_meters, traffic_delay_seconds,
          current_speed_kph, free_flow_speed_kph,
          route_polyline,
          incidents, provider, api_status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        dirKey,
        route?.duration_seconds ?? 0,
        route?.no_traffic_seconds ?? 0,
        route?.historic_seconds ?? null,
        route?.delay_seconds ?? 0,
        route?.congestion_ratio ?? 1,
        route?.distance_meters ?? 0,
        route?.traffic_delay_seconds ?? 0,
        null,
        null,
        route?.route_polyline ?? null,
        JSON.stringify(incidents),
        'tomtom',
        apiStatus,
        errorMessage,
      ).run()
    }
  }
}

// ─── API Routes ──────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>()
app.use('/api/*', cors())

// Health check
app.get('/api/health', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total_samples,
      MAX(created_at) as last_collection,
      MAX(CASE WHEN api_status != 'error' THEN created_at END) as last_successful_collection,
      COUNT(CASE WHEN api_status = 'error' THEN 1 END) as error_count,
      (
        SELECT error_message
        FROM traffic_samples
        WHERE api_status = 'error' AND error_message IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      ) as last_error_message
    FROM traffic_samples
  `).all()

  const row = results[0] as unknown as HealthRow
  return c.json({
    status: 'ok',
    total_samples: row.total_samples ?? 0,
    last_collection: toISO(row.last_collection),
    last_successful_collection: toISO(row.last_successful_collection),
    error_count: row.error_count ?? 0,
    last_error_message: row.last_error_message ?? null,
  })
})

// Latest traffic data for all corridors
app.get('/api/traffic/latest', async (c) => {
  // Get latest sample per direction
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM traffic_samples
    WHERE id IN (
      SELECT MAX(id) FROM traffic_samples GROUP BY direction
    )
    ORDER BY direction
  `).all()

  if (results.length === 0) {
    return c.json({ status: 'no_data', corridors: {}, last_updated: null })
  }

  const corridors: Record<string, {
    direction: string
    duration_seconds: number
    no_traffic_seconds: number
    historic_seconds: number | null
    delay_seconds: number
    congestion_ratio: number
    congestion_level: CongestionLevel
    distance_meters: number
    route_polyline: string | null
    incidents: Incident[]
    api_status: string
    collected_at: string
    is_stale: boolean
  }> = {}

  for (const rawRow of results) {
    const row = rawRow as unknown as LatestSampleRow
    const dirKey = row.direction
    const ratio = row.congestion_ratio
    const level = getCongestionLevel(ratio)
    const parsedIncidents = row.incidents ? JSON.parse(row.incidents) as Incident[] : []
    const ageMs = Date.now() - new Date(row.created_at + 'Z').getTime()
    const isStale = ageMs > STALE_THRESHOLD_MS

    corridors[dirKey] = {
      direction: dirKey,
      duration_seconds: row.duration_seconds,
      no_traffic_seconds: row.no_traffic_seconds,
      historic_seconds: row.historic_seconds,
      delay_seconds: row.delay_seconds,
      congestion_ratio: ratio,
      congestion_level: level,
      distance_meters: row.distance_meters,
      route_polyline: row.route_polyline ?? null,
      incidents: parsedIncidents,
      api_status: row.api_status,
      collected_at: toISO(row.created_at) ?? '',
      is_stale: isStale,
    }
  }

  const lastUpdated = (results as unknown as LatestSampleRow[])
    .map((r) => r.created_at)
    .filter(Boolean)
    .sort()
    .pop() ?? null

  return c.json({
    status: 'ok',
    corridors,
    last_updated: toISO(lastUpdated),
  })
})

// History: hourly averages for the trend chart
app.get('/api/traffic/history', async (c) => {
  const hours = parseHistoryHours(c.req.query('hours'))

  const { results } = await c.env.DB.prepare(`
    SELECT
      direction,
      strftime('%Y-%m-%dT%H:00:00', created_at) as hour,
      AVG(duration_seconds) as avg_duration,
      AVG(no_traffic_seconds) as avg_no_traffic,
      AVG(congestion_ratio) as avg_ratio,
      AVG(delay_seconds) as avg_delay,
      COUNT(*) as sample_count
    FROM traffic_samples
    WHERE created_at > datetime('now', ?)
      AND api_status != 'error'
    GROUP BY direction, hour
    ORDER BY hour
  `).bind(`-${hours} hours`).all()

  // Group by hour
  const buckets: Record<string, { hour: string; [dirKey: string]: string | number | unknown }> = {}
  for (const rawRow of results) {
    const row = rawRow as unknown as HistoryRow
    const h = toISO(row.hour) as string
    if (!buckets[h]) {
      buckets[h] = { hour: h }
    }
    buckets[h][row.direction] = {
      avg_duration: Math.round(row.avg_duration),
      avg_no_traffic: Math.round(row.avg_no_traffic),
      avg_ratio: Math.round(row.avg_ratio * 100) / 100,
      avg_delay: Math.round(row.avg_delay),
      sample_count: row.sample_count,
    }
  }

  return c.json(Object.values(buckets))
})

// Raw samples for short-range trend views
app.get('/api/traffic/samples', async (c) => {
  const hours = parseHistoryHours(c.req.query('hours'))

  const { results } = await c.env.DB.prepare(`
    SELECT
      direction,
      strftime('%Y-%m-%dT%H:%M:00', created_at) as time,
      duration_seconds,
      no_traffic_seconds,
      congestion_ratio,
      delay_seconds
    FROM traffic_samples
    WHERE created_at > datetime('now', ?)
      AND api_status != 'error'
    ORDER BY time, direction
  `).bind(`-${hours} hours`).all()

  const buckets: Record<string, { time: string; [dirKey: string]: string | number | unknown }> = {}
  for (const rawRow of results) {
    const row = rawRow as unknown as SampleRow
    const time = toISO(row.time) as string
    if (!buckets[time]) {
      buckets[time] = { time }
    }
    buckets[time][row.direction] = {
      duration_seconds: row.duration_seconds,
      no_traffic_seconds: row.no_traffic_seconds,
      congestion_ratio: row.congestion_ratio,
      delay_seconds: row.delay_seconds,
    }
  }

  return c.json(Object.values(buckets))
})

// Seed endpoint: manually insert a sample for testing
app.post('/api/traffic/seed', async (c) => {
  if (!isLocalRequest(c.req.url)) {
    return c.json({ error: 'Seed is only available on localhost' }, 403)
  }

  const body = await c.req.json<{
    direction: string
    duration_seconds: number
    no_traffic_seconds: number
    historic_seconds?: number
    delay_seconds: number
    congestion_ratio: number
    distance_meters?: number
    incidents?: Incident[]
  }>()

  if (!body.direction) {
    return c.json({ error: 'direction is required' }, 400)
  }

  await c.env.DB.prepare(`
    INSERT INTO traffic_samples (
      direction, duration_seconds, no_traffic_seconds, historic_seconds,
      delay_seconds, congestion_ratio, distance_meters,
      incidents, api_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seeded')
  `).bind(
    body.direction,
    body.duration_seconds,
    body.no_traffic_seconds,
    body.historic_seconds ?? null,
    body.delay_seconds,
    body.congestion_ratio,
    body.distance_meters ?? 0,
    JSON.stringify(body.incidents ?? []),
  ).run()

  return c.json({ ok: true, direction: body.direction })
})

// Debug: manual cron trigger for local development only
app.get('/api/debug/collect', async (c) => {
  if (!isLocalRequest(c.req.url)) {
    return c.json({ error: 'Debug collection is only available on localhost' }, 403)
  }

  try {
    await collectTraffic(c.env)
    return c.json({ ok: true, message: 'Collection complete' })
  } catch (err) {
    return c.json({
      error: true,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }, 500)
  }
})

// ─── Exports ─────────────────────────────────────────────────────

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(collectTraffic(env))
  },
}
