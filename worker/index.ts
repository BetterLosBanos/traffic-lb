     1|import { Hono } from 'hono'
     2|import { cors } from 'hono/cors'
     3|import type {
     4|  CongestionLevel,
     5|  Incident,
     6|  IncidentProbability,
     7|  IncidentSeverity,
     8|  IncidentTimeValidity,
     9|  TomTomIncident,
    10|  TomTomIncidentsResponse,
    11|  TomTomRouteLeg,
    12|  TomTomRouteResponse,
    13|} from '../src/lib/types'
    14|
    15|// ─── Types ───────────────────────────────────────────────────────
    16|
    17|interface Env {
    18|  DB: D1Database
    19|  TOMTOM_API_KEY: string
    20|}
    21|
    22|interface RouteResult {
    23|  duration_seconds: number
    24|  no_traffic_seconds: number
    25|  historic_seconds: number | null
    26|  delay_seconds: number
    27|  congestion_ratio: number
    28|  distance_meters: number
    29|  traffic_delay_seconds: number
    30|  route_polyline: string | null
    31|}
    32|
    33|// D1 row types — snake_case, matching DB columns
    34|
    35|interface HealthRow {
    36|  total_samples: number
    37|  last_collection: string | null
    38|  last_successful_collection: string | null
    39|  error_count: number
    40|  last_error_message: string | null
    41|}
    42|
    43|interface LatestSampleRow {
    44|  id: number
    45|  direction: string
    46|  duration_seconds: number
    47|  no_traffic_seconds: number
    48|  historic_seconds: number | null
    49|  delay_seconds: number
    50|  congestion_ratio: number
    51|  distance_meters: number
    52|  route_polyline: string | null
    53|  incidents: string | null
    54|  api_status: string
    55|  created_at: string
    56|}
    57|
    58|interface HistoryRow {
    59|  direction: string
    60|  hour: string
    61|  avg_duration: number
    62|  avg_no_traffic: number
    63|  avg_ratio: number
    64|  avg_delay: number
    65|  sample_count: number
    66|}
    67|
    68|interface SampleRow {
    69|  direction: string
    70|  time: string
    71|  duration_seconds: number
    72|  no_traffic_seconds: number
    73|  congestion_ratio: number
    74|  delay_seconds: number
    75|}
    76|
    77|// ─── Corridors ───────────────────────────────────────────────────
    78|
    79|interface Corridor {
    80|  id: string
    81|  label: string
    82|  a: { lat: number; lng: number }
    83|  b: { lat: number; lng: number }
    84|  waypoints?: { lat: number; lng: number }[]  // intermediate points to constrain route
    85|}
    86|
    87|// 4 corridors across Los Baños, each stored as {id}_f (a→b) and {id}_r (b→a)
    88|const CORRIDORS: Corridor[] = [
    89|  {
    90|    id: 'pansol',
    91|    label: 'Bucal Bypass → Municipal Hall',
    92|    a: { lat: 14.1877993, lng: 121.1705503 },  // Bucal Bypass
    93|    b: { lat: 14.1773136, lng: 121.2216712 },   // LB Municipal Hall
    94|    waypoints: [
    95|      { lat: 14.185526, lng: 121.172035 },
    96|      { lat: 14.1803876, lng: 121.1797679 },
    97|      { lat: 14.1768233, lng: 121.1864909 },
    98|    ],
    99|  },
   100|  {
   101|    id: 'municipal',
   102|    label: 'Municipal Hall → Crossing LB',
   103|    a: { lat: 14.1773136, lng: 121.2216712 },   // LB Municipal Hall
   104|    b: { lat: 14.1783995, lng: 121.2422448 },   // Crossing Los Baños
   105|    waypoints: [
   106|      { lat: 14.1782707, lng: 121.2238945 },
   107|    ],
   108|  },
   109|  {
   110|    id: 'uplb',
   111|    label: 'Crossing LB → UPLB Gate',
   112|    a: { lat: 14.1783995, lng: 121.2422448 },   // Crossing Los Baños
   113|    b: { lat: 14.1674438, lng: 121.2433791 },   // UPLB Gate
   114|  },
   115|  {
   116|    id: 'bay',
   117|    label: 'Crossing LB → Bay Arch',
   118|    a: { lat: 14.1783995, lng: 121.2422448 },   // Crossing Los Baños
   119|    b: { lat: 14.1759658, lng: 121.2656562 },   // Bay Welcome Arch
   120|  },
   121|]
   122|
   123|// Bounding box for incidents: all corridor endpoints with padding
   124|const ALL_POINTS = CORRIDORS.flatMap(c => [c.a, c.b])
   125|const INCIDENTS_BBOX = (() => {
   126|  const lats = ALL_POINTS.map(p => p.lat)
   127|  const lngs = ALL_POINTS.map(p => p.lng)
   128|  const pad = 0.003
   129|  return `${Math.min(...lngs) - pad},${Math.min(...lats) - pad},${Math.max(...lngs) + pad},${Math.max(...lats) + pad}`
   130|})()
   131|
   132|// How old before data is considered stale (ms) — 30 minutes
   133|const STALE_THRESHOLD_MS = 30 * 60 * 1000
   134|
   135|function getCongestionLevel(ratio: number): CongestionLevel {
   136|  if (ratio < 1.25) return 'light'
   137|  if (ratio < 1.75) return 'moderate'
   138|  if (ratio < 2.5) return 'heavy'
   139|  return 'severe'
   140|}
   141|
   142|// D1's datetime('now') returns UTC as 'YYYY-MM-DD HH:MM:SS' (no T, no Z).
   143|// Normalize to proper ISO 8601 UTC for the frontend.
   144|function toISO(raw: string | null): string | null {
   145|  if (!raw) return null
   146|  // Already ISO? Return as-is.
   147|  if (raw.includes('T') && raw.endsWith('Z')) return raw
   148|  // D1 format: space separator, no Z. Also handles strftime output like '2025-05-18T07:00:00'.
   149|  return raw.replace(' ', 'T') + 'Z'
   150|}
   151|
   152|function isLocalRequest(url: string): boolean {
   153|  const { hostname } = new URL(url)
   154|  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
   155|}
   156|
   157|function parseHistoryHours(value: string | undefined): number {
   158|  const parsed = Number.parseInt(value ?? '24', 10)
   159|  if (!Number.isFinite(parsed)) return 24
   160|  return Math.min(Math.max(parsed, 1), 168)
   161|}
   162|
   163|
   164|
   165|// ─── TomTom API Calls ────────────────────────────────────────────
   166|
   167|// Encode coordinate pairs as a simple comma-separated string for frontend decoding.
   168|// Format: "lat,lng,lat,lng,..." — compact and avoids depending on a polyline lib.
   169|function encodeFlexiblePolyline(points: { latitude: number; longitude: number }[]): string {
   170|  return points.map(p => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`).join(';')
   171|}
   172|
   173|async function fetchRoute(env: Env, origin: { lat: number; lng: number }, dest: { lat: number; lng: number }, waypoints?: { lat: number; lng: number }[]): Promise<RouteResult> {
   174|  const allPoints = [origin, ...(waypoints ?? []), dest]
   175|  const locations = allPoints.map(p => `${p.lat},${p.lng}`).join(':')
   176|  const url = `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?key=${env.TOMTOM_API_KEY}&traffic=true&travelMode=car&computeTravelTimeFor=all&sectionType=traffic&routeRepresentation=polyline`
   177|
   178|  const res = await fetch(url)
   179|  if (!res.ok) {
   180|    const body = await res.text()
   181|    throw new Error(`Routing API ${res.status}: ${body.slice(0, 200)}`)
   182|  }
   183|
   184|  const data = (await res.json()) as TomTomRouteResponse
   185|  const route = data.routes?.[0]
   186|  const summary = route?.summary
   187|  if (!summary) throw new Error(`No route in TomTom response for ${origin.lat},${origin.lng} → ${dest.lat},${dest.lng}`)
   188|
   189|  const duration = summary.travelTimeInSeconds
   190|  const noTraffic = summary.noTrafficTravelTimeInSeconds ?? duration
   191|  const points = route?.legs?.flatMap((l: TomTomRouteLeg) => l.points ?? []) ?? []
   192|  const encodedPolyline = points.length > 0 ? encodeFlexiblePolyline(points) : null
   193|
   194|  return {
   195|    duration_seconds: duration,
   196|    no_traffic_seconds: noTraffic,
   197|    historic_seconds: summary.historicTrafficTravelTimeInSeconds ?? null,
   198|    delay_seconds: duration - noTraffic,
   199|    congestion_ratio: Math.round((duration / noTraffic) * 100) / 100,
   200|    distance_meters: summary.lengthInMeters,
   201|    traffic_delay_seconds: summary.trafficDelayInSeconds ?? 0,
   202|    route_polyline: encodedPolyline,
   203|  }
   204|}
   205|
   206|async function fetchIncidents(env: Env): Promise<Incident[]> {
   207|  // v5 API: fields nested under properties{}, descriptions in events[], categoryFilter uses PascalCase
   208|  const fields = encodeURIComponent('{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,iconCategory},startTime,endTime,from,to,roadNumbers,delay,length,timeValidity,probabilityOfOccurrence,numberOfReports,lastReportTime}}}')
   209|  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${env.TOMTOM_API_KEY}&bbox=${INCIDENTS_BBOX}&fields=${fields}&language=en-US&timeValidityFilter=present`
   210|
   211|  const res = await fetch(url)
   212|  if (!res.ok) {
   213|    const body = await res.text()
   214|    throw new Error(`Incidents API ${res.status}: ${body.slice(0, 200)}`)
   215|  }
   216|
   217|  const MAGNITUDE_LABEL: Record<number, IncidentSeverity> = {
   218|    0: 'unknown',
   219|    1: 'minor',
   220|    2: 'moderate',
   221|    3: 'major',
   222|    4: 'severe',
   223|  }
   224|
   225|  const ICON_CATEGORY_LABEL: Record<number, string> = {
   226|    0: 'Unknown', 1: 'Accident', 2: 'Fog', 3: 'Dangerous Conditions',
   227|    4: 'Rain', 5: 'Ice', 6: 'Jam', 7: 'Lane Closed',
   228|    8: 'Road Closed', 9: 'Road Works', 10: 'Wind', 11: 'Flooding',
   229|    14: 'Broken Down Vehicle',
   230|  }
   231|
   232|  const data = (await res.json()) as TomTomIncidentsResponse
   233|  const incidents = data?.incidents ?? []
   234|  const cleanString = (v: unknown) => (typeof v === 'string' && v !== 'null' && v !== '') ? v : undefined
   235|  const cleanNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v)) ? v : undefined
   236|  const cleanTimeValidity = (v: unknown): IncidentTimeValidity | undefined => (
   237|    v === 'present' || v === 'future' ? v : undefined
   238|  )
   239|  const cleanProbability = (v: unknown): IncidentProbability | undefined => (
   240|    v === 'certain' || v === 'probable' || v === 'risk_of' || v === 'improbable' ? v : undefined
   241|  )
   242|
   243|  return incidents.map((inc: TomTomIncident) => {
   244|    const props = inc.properties ?? {}
   245|    const geom = inc.geometry?.coordinates // Point: [lng,lat] or LineString: [[lng,lat],...]
   246|    const events = props.events ?? []
   247|    const roadNums = props.roadNumbers ?? []
   248|
   249|    let lat: number | undefined
   250|    let lng: number | undefined
   251|    if (geom) {
   252|      const coord = Array.isArray(geom[0]) ? geom[0] : geom  // LineString or Point
   253|      lng = (coord as number[])[0]
   254|      lat = (coord as number[])[1]
   255|    }
   256|
   257|    const startedAt = cleanString(props.startTime)
   258|    const endsAt = cleanString(props.endTime)
   259|    const lastReportedAt = cleanString(props.lastReportTime)
   260|    const endMs = typeof endsAt === 'string' ? new Date(endsAt).getTime() : NaN
   261|
   262|    return {
   263|      id: cleanString(props.id),
   264|      type: ICON_CATEGORY_LABEL[props.magnitudeOfDelay ?? 0] ?? 'Unknown',
   265|      severity: MAGNITUDE_LABEL[props.magnitudeOfDelay ?? 0] ?? 'unknown',
   266|      description: events[0]?.description ?? '',
   267|      roadName: roadNums[0] ?? '',
   268|      from: props.from ?? '',
   269|      to: props.to ?? '',
      startedAt: startedAt,
      endsAt: endsAt,
      lastReportedAt: lastReportedAt,
      timeValidity: cleanTimeValidity(props.timeValidity),
      probability: cleanProbability(props.probabilityOfOccurrence),
      reportCount: cleanNumber(props.numberOfReports),
      hasExpiredEndTime: Number.isFinite(endMs) && endMs < Date.now(),
   277|      ...(lat != null && lng != null ? { lat, lng } : {}),
   278|    }
   279|  })
   280|}
   281|
   282|// ─── Cron: Collect Traffic Data ──────────────────────────────────
   283|
   284|const RETENTION_DAYS = 14
   285|
   286|async function collectTraffic(env: Env): Promise<void> {
   287|  // Purge stale data before collecting new samples
   288|  await env.DB.prepare(
   289|    `DELETE FROM traffic_samples WHERE created_at < datetime('now', ?)`,
   290|  ).bind(`-${RETENTION_DAYS} days`).run()
   291|
   292|  let incidents: Incident[] = []
   293|  try {
   294|    incidents = await fetchIncidents(env)
   295|  } catch (error) {
   296|    console.error('[collectTraffic] incidents fetch failed:', error)
   297|    // Continue without incidents — don't block route data collection
   298|  }
   299|
   300|  for (const corridor of CORRIDORS) {
   301|    for (const direction of ['f', 'r'] as const) {
   302|      const dirKey = `${corridor.id}_${direction}`
   303|      const origin = direction === 'f' ? corridor.a : corridor.b
   304|      const dest = direction === 'f' ? corridor.b : corridor.a
   305|      const wps = corridor.waypoints
   306|        ? (direction === 'f' ? corridor.waypoints : [...corridor.waypoints].reverse())
   307|        : undefined
   308|
   309|      let apiStatus: 'ok' | 'error' = 'ok'
   310|      let errorMessage: string | null = null
   311|      let route: RouteResult | null = null
   312|
   313|      try {
   314|        route = await fetchRoute(env, origin, dest, wps)
   315|      } catch (err) {
   316|        apiStatus = 'error'
   317|        errorMessage = err instanceof Error ? err.message : String(err)
   318|        console.error(`Routing failed for ${dirKey}:`, errorMessage)
   319|      }
   320|
   321|      await env.DB.prepare(`
   322|        INSERT INTO traffic_samples (
   323|          direction, duration_seconds, no_traffic_seconds, historic_seconds,
   324|          delay_seconds, congestion_ratio, distance_meters, traffic_delay_seconds,
   325|          current_speed_kph, free_flow_speed_kph,
   326|          route_polyline,
   327|          incidents, provider, api_status, error_message
   328|        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   329|      `).bind(
   330|        dirKey,
   331|        route?.duration_seconds ?? 0,
   332|        route?.no_traffic_seconds ?? 0,
   333|        route?.historic_seconds ?? null,
   334|        route?.delay_seconds ?? 0,
   335|        route?.congestion_ratio ?? 1,
   336|        route?.distance_meters ?? 0,
   337|        route?.traffic_delay_seconds ?? 0,
   338|        null,
   339|        null,
   340|        route?.route_polyline ?? null,
   341|        JSON.stringify(incidents),
   342|        'tomtom',
   343|        apiStatus,
   344|        errorMessage,
   345|      ).run()
   346|    }
   347|  }
   348|}
   349|
   350|// ─── API Routes ──────────────────────────────────────────────────
   351|
   352|const app = new Hono<{ Bindings: Env }>()
   353|app.use('/api/*', cors())
   354|
   355|// Health check
   356|app.get('/api/health', async (c) => {
   357|  const { results } = await c.env.DB.prepare(`
   358|    SELECT
   359|      COUNT(*) as total_samples,
   360|      MAX(created_at) as last_collection,
   361|      MAX(CASE WHEN api_status != 'error' THEN created_at END) as last_successful_collection,
   362|      COUNT(CASE WHEN api_status = 'error' THEN 1 END) as error_count,
   363|      (
   364|        SELECT error_message
   365|        FROM traffic_samples
   366|        WHERE api_status = 'error' AND error_message IS NOT NULL
   367|        ORDER BY created_at DESC
   368|        LIMIT 1
   369|      ) as last_error_message
   370|    FROM traffic_samples
   371|  `).all()
   372|
   373|  const row = results[0] as unknown as HealthRow
   374|  return c.json({
   375|    status: 'ok',
    totalSamples: row.total_samples ?? 0,
    lastCollection: toISO(row.last_collection),
    lastSuccessfulCollection: toISO(row.last_successful_collection),
    errorCount: row.error_count ?? 0,
    lastErrorMessage: row.last_error_message ?? null,
   381|  })
   382|})
   383|
   384|// Latest traffic data for all corridors
   385|app.get('/api/traffic/latest', async (c) => {
   386|  // Get latest sample per direction
   387|  const { results } = await c.env.DB.prepare(`
   388|    SELECT * FROM traffic_samples
   389|    WHERE id IN (
   390|      SELECT MAX(id) FROM traffic_samples GROUP BY direction
   391|    )
   392|    ORDER BY direction
   393|  `).all()
   394|
   395|  if (results.length === 0) {
   396|    return c.json({ status: 'no_data', corridors: {}, lastUpdated: null })
   397|  }
   398|
  const corridors: Record<string, {
    direction: string
    durationSeconds: number
    noTrafficSeconds: number
    historicSeconds: number | null
    delaySeconds: number
    congestionRatio: number
    congestionLevel: CongestionLevel
    distanceMeters: number
    routePolyline: string | null
    incidents: Incident[]
    apiStatus: string
    collectedAt: string
    isStale: boolean
  }> = {}
   414|
   415|  for (const rawRow of results) {
   416|    const row = rawRow as unknown as LatestSampleRow
   417|    const dirKey = row.direction
   418|    const ratio = row.congestion_ratio
   419|    const level = getCongestionLevel(ratio)
   420|    const parsedIncidents = row.incidents ? JSON.parse(row.incidents) as Incident[] : []
   421|    const ageMs = Date.now() - new Date(row.created_at + 'Z').getTime()
   422|    const isStale = ageMs > STALE_THRESHOLD_MS
   423|
    corridors[dirKey] = {
      direction: dirKey,
      durationSeconds: row.duration_seconds,
      noTrafficSeconds: row.no_traffic_seconds,
      historicSeconds: row.historic_seconds,
      delaySeconds: row.delay_seconds,
      congestionRatio: ratio,
      congestionLevel: level,
      distanceMeters: row.distance_meters,
      routePolyline: row.route_polyline ?? null,
      incidents: parsedIncidents,
      apiStatus: row.api_status,
      collectedAt: toISO(row.created_at) ?? '',
      isStale: isStale,
    }
   439|  }
   440|
   441|  const lastUpdated = (results as unknown as LatestSampleRow[])
   442|    .map((r) => r.created_at)
   443|    .filter(Boolean)
   444|    .sort()
   445|    .pop() ?? null
   446|
   447|  return c.json({
   448|    status: 'ok',
   449|    corridors,
   450|    lastUpdated: toISO(lastUpdated),
   451|  })
   452|})
   453|
   454|// History: hourly averages for the trend chart
   455|app.get('/api/traffic/history', async (c) => {
   456|  const hours = parseHistoryHours(c.req.query('hours'))
   457|
   458|  const { results } = await c.env.DB.prepare(`
   459|    SELECT
   460|      direction,
   461|      strftime('%Y-%m-%dT%H:00:00', created_at) as hour,
   462|      AVG(duration_seconds) as avg_duration,
   463|      AVG(no_traffic_seconds) as avg_no_traffic,
   464|      AVG(congestion_ratio) as avg_ratio,
   465|      AVG(delay_seconds) as avg_delay,
   466|      COUNT(*) as sample_count
   467|    FROM traffic_samples
   468|    WHERE created_at > datetime('now', ?)
   469|      AND api_status != 'error'
   470|    GROUP BY direction, hour
   471|    ORDER BY hour
   472|  `).bind(`-${hours} hours`).all()
   473|
   474|  // Group by hour
   475|  const buckets: Record<string, { hour: string; [dirKey: string]: string | number | unknown }> = {}
   476|  for (const rawRow of results) {
   477|    const row = rawRow as unknown as HistoryRow
   478|    const h = toISO(row.hour) as string
   479|    if (!buckets[h]) {
   480|      buckets[h] = { hour: h }
   481|    }
    buckets[h][row.direction] = {
      avgDuration: Math.round(row.avg_duration),
      avgNoTraffic: Math.round(row.avg_no_traffic),
      avgRatio: Math.round(row.avg_ratio * 100) / 100,
      avgDelay: Math.round(row.avg_delay),
      sampleCount: row.sample_count,
    }
   489|  }
   490|
   491|  return c.json(Object.values(buckets))
   492|})
   493|
   494|// Raw samples for short-range trend views
   495|app.get('/api/traffic/samples', async (c) => {
   496|  const hours = parseHistoryHours(c.req.query('hours'))
   497|
   498|  const { results } = await c.env.DB.prepare(`
   499|    SELECT
   500|      direction,
   501|      strftime('%Y-%m-%dT%H:%M:00', created_at) as time,
   502|      duration_seconds,
   503|      no_traffic_seconds,
   504|      congestion_ratio,
   505|      delay_seconds
   506|    FROM traffic_samples
   507|    WHERE created_at > datetime('now', ?)
   508|      AND api_status != 'error'
   509|    ORDER BY time, direction
   510|  `).bind(`-${hours} hours`).all()
   511|
   512|  const buckets: Record<string, { time: string; [dirKey: string]: string | number | unknown }> = {}
   513|  for (const rawRow of results) {
   514|    const row = rawRow as unknown as SampleRow
    const time = toISO(row.time) as string
    if (!buckets[time]) {
      buckets[time] = { time }
    }
    buckets[time][row.direction] = {
      durationSeconds: row.duration_seconds,
      noTrafficSeconds: row.no_traffic_seconds,
      congestionRatio: row.congestion_ratio,
      delaySeconds: row.delay_seconds,
    }
   525|  }
   526|
   527|  return c.json(Object.values(buckets))
   528|})
   529|
   530|// Seed endpoint: manually insert a sample for testing
   531|app.post('/api/traffic/seed', async (c) => {
   532|  if (!isLocalRequest(c.req.url)) {
   533|    return c.json({ error: 'Seed is only available on localhost' }, 403)
   534|  }
   535|
  const body = await c.req.json<{
    direction: string
    durationSeconds: number
    noTrafficSeconds: number
    historicSeconds?: number
    delaySeconds: number
    congestionRatio: number
    distanceMeters?: number
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
    body.durationSeconds,
    body.noTrafficSeconds,
    body.historicSeconds ?? null,
    body.delaySeconds,
    body.congestionRatio,
    body.distanceMeters ?? 0,
    JSON.stringify(body.incidents ?? []),
  ).run()
   567|
   568|  return c.json({ ok: true, direction: body.direction })
   569|})
   570|
   571|// Debug: manual cron trigger for local development only
   572|app.get('/api/debug/collect', async (c) => {
   573|  if (!isLocalRequest(c.req.url)) {
   574|    return c.json({ error: 'Debug collection is only available on localhost' }, 403)
   575|  }
   576|
   577|  try {
   578|    await collectTraffic(c.env)
   579|    return c.json({ ok: true, message: 'Collection complete' })
   580|  } catch (err) {
   581|    return c.json({
   582|      error: true,
   583|      message: err instanceof Error ? err.message : String(err),
   584|      stack: err instanceof Error ? err.stack : undefined,
   585|    }, 500)
   586|  }
   587|})
   588|
   589|// ─── Exports ─────────────────────────────────────────────────────
   590|
   591|export default {
   592|  fetch: app.fetch,
   593|  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
   594|    ctx.waitUntil(collectTraffic(env))
   595|  },
   596|}
   597|