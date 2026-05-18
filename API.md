# API Reference — Traffic Ba Sa LB

Base URL: `https://traffic-lb.<your-subdomain>.workers.dev`

All responses are JSON. All timestamps are ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`).

---

## `GET /api/health`

Collection health and freshness check.

**Response:**

```json
{
  "status": "ok",
  "total_samples": 1420,
  "last_collection": "2026-05-18T06:30:00Z",
  "last_successful_collection": "2026-05-18T06:30:00Z",
  "error_count": 2,
  "last_error_message": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Always `"ok"` |
| `total_samples` | `number` | Total rows in `traffic_samples` |
| `last_collection` | `string\|null` | ISO timestamp of most recent sample (includes errors) |
| `last_successful_collection` | `string\|null` | ISO timestamp of most recent non-error sample |
| `error_count` | `number` | Total rows with `api_status = 'error'` |
| `last_error_message` | `string\|null` | Most recent error message, if any |

---

## `GET /api/traffic/latest`

Current traffic status for all corridors. Returns the most recent sample per direction.

**Query params:** none

**Response:**

```json
{
  "status": "ok",
  "last_updated": "2026-05-18T06:30:00Z",
  "corridors": {
    "pansol_f": {
      "direction": "pansol_f",
      "duration_seconds": 480,
      "no_traffic_seconds": 360,
      "historic_seconds": 400,
      "delay_seconds": 120,
      "congestion_ratio": 1.33,
      "congestion_level": "moderate",
      "distance_meters": 5200,
      "route_polyline": "14.187799,121.170550;14.185526,121.172035;...",
      "incidents": [],
      "api_status": "ok",
      "collected_at": "2026-05-18T06:30:00Z",
      "is_stale": false
    },
    "pansol_r": { "..." },
    "municipal_f": { "..." },
    "municipal_r": { "..." },
    "uplb_f": { "..." },
    "uplb_r": { "..." },
    "bay_f": { "..." },
    "bay_r": { "..." }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | `"ok"` or `"no_data"` |
| `last_updated` | `string\|null` | ISO timestamp of newest sample across all directions |
| `corridors` | `object` | Keyed by direction ID (`{corridor}_{f\|r}`) |

**Direction object:**

| Field | Type | Description |
|-------|------|-------------|
| `direction` | `string` | `{corridor}_{f\|r}` — see corridor table below |
| `duration_seconds` | `number` | Current travel time with traffic |
| `no_traffic_seconds` | `number` | Free-flow travel time (no traffic) |
| `historic_seconds` | `number\|null` | TomTom's historic average for this time/day |
| `delay_seconds` | `number` | `duration - no_traffic` (can be negative if roads are clear) |
| `congestion_ratio` | `number` | `duration / no_traffic`, rounded to 2 decimals |
| `congestion_level` | `string` | `"light"` / `"moderate"` / `"heavy"` / `"severe"` |
| `distance_meters` | `number` | Route distance |
| `route_polyline` | `string\|null` | Semicolon-separated `lat,lng` pairs for map overlay |
| `incidents` | `array` | Active TomTom incidents in corridor bbox |
| `api_status` | `string` | `"ok"` / `"error"` / `"seeded"` |
| `collected_at` | `string` | ISO timestamp when sample was stored |
| `is_stale` | `boolean` | `true` if sample is older than 30 minutes |

**Congestion level thresholds:**

| Ratio | Level |
|-------|-------|
| < 1.25 | light |
| < 1.75 | moderate |
| < 2.5 | heavy |
| ≥ 2.5 | severe |

---

## `GET /api/traffic/history`

Hourly averaged samples for trend charts. Groups by hour and direction, only includes non-error samples.

**Query params:**

| Param | Type | Default | Range | Description |
|-------|------|---------|-------|-------------|
| `hours` | `number` | `24` | 1–168 | Hours of history to return |

**Response:** array of hourly buckets, each containing per-direction averages.

```json
[
  {
    "hour": "2026-05-17T22:00:00Z",
    "pansol_f": {
      "avg_duration": 450,
      "avg_no_traffic": 360,
      "avg_ratio": 1.25,
      "avg_delay": 90,
      "sample_count": 6
    },
    "pansol_r": { "..." },
    "municipal_f": { "..." }
  },
  {
    "hour": "2026-05-17T23:00:00Z",
    "..."
  }
]
```

**Direction average object:**

| Field | Type | Description |
|-------|------|-------------|
| `avg_duration` | `number` | Average `duration_seconds`, rounded |
| `avg_no_traffic` | `number` | Average `no_traffic_seconds`, rounded |
| `avg_ratio` | `number` | Average `congestion_ratio`, 2 decimals |
| `avg_delay` | `number` | Average `delay_seconds`, rounded |
| `sample_count` | `number` | Number of samples in this hour |

Only hours with data are included. Directions without samples in an hour are omitted from that bucket.

---

## `GET /api/traffic/samples`

Raw sample data for granular trend views. Returns individual samples grouped by minute bucket.

**Query params:**

| Param | Type | Default | Range | Description |
|-------|------|---------|-------|-------------|
| `hours` | `number` | `24` | 1–168 | Hours of samples to return |

**Response:** array of minute-bucketed objects.

```json
[
  {
    "time": "2026-05-18T06:00:00Z",
    "pansol_f": {
      "duration_seconds": 480,
      "no_traffic_seconds": 360,
      "congestion_ratio": 1.33,
      "delay_seconds": 120
    },
    "pansol_r": { "..." }
  }
]
```

**Direction sample object:**

| Field | Type | Description |
|-------|------|-------------|
| `duration_seconds` | `number` | Raw travel time |
| `no_traffic_seconds` | `number` | Raw free-flow time |
| `congestion_ratio` | `number` | Raw ratio |
| `delay_seconds` | `number` | Raw delay |

---

## `POST /api/traffic/seed`

Insert a test sample. **Localhost only** — returns 403 from any other host.

**Request body:**

```json
{
  "direction": "pansol_f",
  "duration_seconds": 480,
  "no_traffic_seconds": 360,
  "historic_seconds": 400,
  "delay_seconds": 120,
  "congestion_ratio": 1.33,
  "distance_meters": 5200,
  "incidents": []
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `direction` | yes | Direction key |
| `duration_seconds` | yes | Travel time with traffic |
| `no_traffic_seconds` | yes | Free-flow travel time |
| `historic_seconds` | no | Historic average |
| `delay_seconds` | yes | Duration minus free-flow |
| `congestion_ratio` | yes | Duration divided by free-flow |
| `distance_meters` | no | Route distance |
| `incidents` | no | Incident array |

**Response (200):**

```json
{ "ok": true, "direction": "pansol_f" }
```

---

## `GET /api/debug/collect`

Manually trigger a collection cycle. **Localhost only.**

**Response (200):**

```json
{ "ok": true, "message": "Collection complete" }
```

**Response (500):**

```json
{
  "error": true,
  "message": "Routing API 429: rate limited",
  "stack": "Error: Routing API 429..."
}
```

---

## Corridors

| ID | Forward (`_f`) | Reverse (`_r`) |
|----|---------------|----------------|
| `pansol` | Bucal Bypass → Municipal Hall | Municipal Hall → Bucal Bypass |
| `municipal` | Municipal Hall → Crossing | Crossing → Municipal Hall |
| `uplb` | Crossing → UPLB Gate | UPLB Gate → Crossing |
| `bay` | Crossing → Bay Welcome Arch | Bay Welcome Arch → Crossing |

Direction keys: `{id}_f` (forward, A→B) and `{id}_r` (reverse, B→A). 8 total.

---

## Timestamp Convention

- **Storage:** D1 uses `datetime('now')` → `YYYY-MM-DD HH:MM:SS` (UTC, no suffix)
- **API boundary:** Worker normalizes all timestamps to ISO 8601 UTC with `Z` suffix via `toISO()`
- **Frontend:** Formats to `Asia/Manila` via `Intl.DateTimeFormat`

No raw D1 datetime strings reach the frontend.

---

## Cron Collection

- **Schedule:** `*/10 * * * *` (every 10 minutes)
- **Hours gate:** Only collects during 5 AM–11 PM Manila time (`shouldCollectNow()`)
- **Per tick:** 8 TomTom Routing API calls (4 corridors × 2 directions) + 1 Incidents API call
- **Staleness threshold:** 30 minutes — samples older than this are flagged `is_stale: true`

### External APIs

| API | Purpose | Calls/tick |
|-----|---------|-----------|
| TomTom Routing | Travel time, distance, route polyline | 8 |
| TomTom Incidents | Active accidents, congestion, road work in bbox | 1 |

API key stored as Cloudflare Worker secret (`TOMTOM_API_KEY`).

---

## Database Schema

### `traffic_samples`

Primary table. One row per direction per cron tick.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `INTEGER PK` | Auto-increment |
| `direction` | `TEXT` | `{corridor}_{f\|r}` |
| `duration_seconds` | `INTEGER` | Travel time with traffic |
| `no_traffic_seconds` | `INTEGER` | Free-flow travel time |
| `historic_seconds` | `INTEGER` | TomTom historic average |
| `delay_seconds` | `INTEGER` | `duration - no_traffic` |
| `congestion_ratio` | `REAL` | `duration / no_traffic` |
| `distance_meters` | `INTEGER` | Route distance |
| `traffic_delay_seconds` | `INTEGER` | Live incident delay |
| `current_speed_kph` | `REAL` | Reserved (unused) |
| `free_flow_speed_kph` | `REAL` | Reserved (unused) |
| `route_polyline` | `TEXT` | Semicolon-separated `lat,lng` pairs |
| `incidents` | `TEXT` | JSON array of incidents |
| `provider` | `TEXT` | Always `"tomtom"` |
| `api_status` | `TEXT` | `"ok"` / `"error"` / `"seeded"` |
| `error_message` | `TEXT` | Error detail if `api_status = 'error'` |
| `created_at` | `TEXT` | UTC timestamp (D1 `datetime('now')`) |

**Indexes:** `idx_samples_direction`, `idx_samples_created`

### `flow_segments`

Reserved for per-segment speed data. Not currently populated by the cron job.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `INTEGER PK` | Auto-increment |
| `sample_id` | `INTEGER FK` | References `traffic_samples.id` |
| `direction` | `TEXT` | Direction key |
| `point_index` | `INTEGER` | 0-based index along route |
| `lat` | `REAL` | Segment latitude |
| `lng` | `REAL` | Segment longitude |
| `current_speed_kph` | `REAL` | Current speed |
| `free_flow_speed_kph` | `REAL` | Free-flow speed |
| `jam_factor` | `REAL` | TomTom jam factor |
| `confidence` | `REAL` | Data confidence |
| `coordinates` | `TEXT` | JSON geometry |
| `created_at` | `TEXT` | UTC timestamp |

**Indexes:** `idx_segments_sample`, `idx_segments_created`

### Migrations

| # | File | Description |
|---|------|-------------|
| 0001 | `traffic_samples.sql` | Creates `traffic_samples` and `flow_segments` tables + indexes |
| 0002 | `flow_coordinates.sql` | Adds `coordinates` column to `flow_segments` |
| 0003 | `route_polyline.sql` | Adds `route_polyline` column to `traffic_samples` |
