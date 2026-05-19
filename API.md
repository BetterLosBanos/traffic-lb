# API Reference - Traffic Ba Sa LB

Base URL: `https://traffic-lb.<your-subdomain>.workers.dev`

All API responses are JSON. Worker responses use `camelCase`. D1 storage uses
`snake_case`. All public timestamps are ISO 8601 UTC with a `Z` suffix.

---

## Data Sources

### TomTom Routing API

Used once per corridor direction on each collection tick.

Endpoint shape:
`/routing/1/calculateRoute/{locations}/json?traffic=true&travelMode=car&computeTravelTimeFor=all&sectionType=traffic&routeRepresentation=polyline`

Normalized route fields:

| Field | Source | Description |
|-------|--------|-------------|
| `durationSeconds` | `summary.travelTimeInSeconds` | Travel time with traffic |
| `noTrafficSeconds` | `summary.noTrafficTravelTimeInSeconds` | Free-flow travel time |
| `historicSeconds` | `summary.historicTrafficTravelTimeInSeconds` | Historic average, when present |
| `delaySeconds` | Derived | `durationSeconds - historicSeconds` (delay vs normal) |
| `congestionRatio` | Derived | `durationSeconds / historicSeconds` (ratio vs normal) |
| `congestionLevel` | Derived | `light`, `moderate`, `heavy`, or `severe` |
| `distanceMeters` | `summary.lengthInMeters` | Route distance |
| `trafficDelaySeconds` | `summary.trafficDelayInSeconds` | TomTom's traffic delay value, stored internally |
| `currentSpeedKph` | Derived | Distance divided by traffic duration |
| `freeFlowSpeedKph` | Derived | Distance divided by free-flow duration |
| `routePolyline` | `route.legs[].points` | Semicolon-separated `lat,lng` points for map overlays |

Congestion thresholds:

| Ratio | Level |
|-------|-------|
| `< 1.25` | `light` |
| `< 1.75` | `moderate` |
| `< 2.5` | `heavy` |
| `>= 2.5` | `severe` |

### TomTom Incident Details API

Used once per collection tick for the corridor bounding box.

Endpoint shape:
`/traffic/services/5/incidentDetails?bbox=...&fields=...&language=en-US&timeValidityFilter=present`

Requested incident fields:
`type`, `geometry.type`, `geometry.coordinates`, `id`, `iconCategory`,
`magnitudeOfDelay`, `events.description`, `events.code`,
`events.iconCategory`, `startTime`, `endTime`, `from`, `to`, `roadNumbers`,
`delay`, `length`, `timeValidity`, `probabilityOfOccurrence`,
`numberOfReports`, `lastReportTime`, and `tmc`.

Normalized incident fields:

| Field | Source | Description |
|-------|--------|-------------|
| `id` | `properties.id` | TomTom incident ID |
| `type` | `properties.iconCategory` | Category label, e.g. `Jam`, `Accident`, `Road Works` |
| `severity` | `properties.magnitudeOfDelay` | `unknown`, `minor`, `moderate`, `major`, `severe` |
| `description` | `properties.events[0].description` | Event text, e.g. `Stopped traffic` |
| `events` | `properties.events[]` | Full TomTom event list with `description`, `code`, and `iconCategory` |
| `roadName` | `properties.roadNumbers[0]` | First road number/name |
| `from` | `properties.from` | Start location label |
| `to` | `properties.to` | End location label |
| `delaySeconds` | `properties.delay` | Delay caused by this specific incident |
| `lengthMeters` | `properties.length` | Length of the incident stretch |
| `startedAt` | `properties.startTime` | Incident start time, if available |
| `endsAt` | `properties.endTime` | Incident end time, if available |
| `lastReportedAt` | `properties.lastReportTime` | Last report time, if available |
| `timeValidity` | `properties.timeValidity` | `present` or `future` |
| `probability` | `properties.probabilityOfOccurrence` | `certain`, `probable`, `risk_of`, or `improbable` |
| `reportCount` | `properties.numberOfReports` | TomTom report count, if available |
| `hasExpiredEndTime` | Derived | `true` when `endsAt` is before current time |
| `lat`, `lng` | `geometry.coordinates` | Representative incident coordinate |
| `tmc` | `properties.tmc` | Traffic Message Channel metadata, when TomTom provides it |

Null-like TomTom values (`null`, `"null"`, and empty strings) are normalized to
omitted optional fields before storage.

The full TomTom geometry is requested so we can derive the representative
coordinate. The public API currently exposes `lat` and `lng`, not the complete
LineString coordinates.

### TomTom Map Tiles

Used directly by the frontend map, separate from D1-backed incident cards:

| Tile/API | Purpose |
|----------|---------|
| Traffic flow vector tiles | Colored road flow overlay |
| Incident vector tiles | TomTom incident icons on the map |
| Incident style/sprite/glyphs | Official incident marker styling |

The red numbered incident icons on the map come from TomTom's map tile style.
They are not rendered from the D1 incident list.

---

## `GET /api/health`

Collection health and freshness check.

```json
{
  "status": "ok",
  "totalSamples": 1420,
  "lastCollection": "2026-05-18T06:30:00Z",
  "lastSuccessfulCollection": "2026-05-18T06:30:00Z",
  "errorCount": 2,
  "lastErrorMessage": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Always `ok` |
| `totalSamples` | `number` | Total rows in `traffic_samples` |
| `lastCollection` | `string\|null` | Most recent sample timestamp, including errors |
| `lastSuccessfulCollection` | `string\|null` | Most recent non-error sample timestamp |
| `errorCount` | `number` | Total rows with `api_status = 'error'` |
| `lastErrorMessage` | `string\|null` | Most recent error message |

---

## `GET /api/traffic/latest`

Current traffic status for all corridor directions. Returns the latest D1 row per
direction.

```json
{
  "status": "ok",
  "lastUpdated": "2026-05-18T06:30:00Z",
  "corridors": {
    "pansol_f": {
      "direction": "pansol_f",
      "durationSeconds": 480,
      "noTrafficSeconds": 360,
      "historicSeconds": 400,
      "delaySeconds": 120,
      "congestionRatio": 1.33,
      "congestionLevel": "moderate",
      "distanceMeters": 5200,
      "currentSpeedKph": 39.0,
      "freeFlowSpeedKph": 52.0,
      "routePolyline": "14.187799,121.170550;14.185526,121.172035",
      "incidents": [],
      "apiStatus": "ok",
      "collectedAt": "2026-05-18T06:30:00Z",
      "isStale": false
    }
  }
}
```

Top-level fields:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | `ok` or `no_data` |
| `lastUpdated` | `string\|null` | Newest sample timestamp across directions |
| `corridors` | `object` | Direction-keyed corridor data |

Direction object fields:

| Field | Type | Description |
|-------|------|-------------|
| `direction` | `string` | `{corridor}_{f\|r}` |
| `durationSeconds` | `number` | Travel time with traffic |
| `noTrafficSeconds` | `number` | Free-flow travel time |
| `historicSeconds` | `number\|null` | Historic average, when present |
| `delaySeconds` | `number` | Route delay |
| `congestionRatio` | `number` | Traffic duration divided by free-flow duration |
| `congestionLevel` | `string` | Derived congestion level |
| `distanceMeters` | `number` | Route distance |
| `currentSpeedKph` | `number` | Derived current speed |
| `freeFlowSpeedKph` | `number` | Derived free-flow speed |
| `routePolyline` | `string\|null` | Semicolon-separated route points |
| `incidents` | `Incident[]` | Active incident snapshot from D1 |
| `apiStatus` | `string` | `ok`, `error`, or `seeded` |
| `collectedAt` | `string` | Sample collection timestamp |
| `isStale` | `boolean` | `true` if older than 30 minutes |

---

## `GET /api/traffic/history`

Hourly averages for trend charts. Only non-error samples are included.

Query params:

| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `hours` | `24` | `1-168` | Hours of history to return |

```json
[
  {
    "hour": "2026-05-17T22:00:00Z",
    "pansol_f": {
      "avgDuration": 450,
      "avgNoTraffic": 360,
      "avgRatio": 1.25,
      "avgDelay": 90,
      "avgCurrentSpeedKph": 41.6,
      "avgFreeFlowSpeedKph": 52.0,
      "sampleCount": 6
    }
  }
]
```

---

## `GET /api/traffic/samples`

Recent sample points grouped by minute bucket for granular charts.

Query params:

| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `hours` | `24` | `1-168` | Hours of samples to return |

```json
[
  {
    "time": "2026-05-18T06:00:00Z",
    "pansol_f": {
      "durationSeconds": 480,
      "noTrafficSeconds": 360,
      "congestionRatio": 1.33,
      "delaySeconds": 120,
      "currentSpeedKph": 39.0,
      "freeFlowSpeedKph": 52.0
    }
  }
]
```

---

## `GET /api/traffic/heatmap`

P50/P90 delay by Manila-local hour-of-week for all directions.

Query params:

| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `days` | `14` | `14` | Historical window in days |

```json
{
  "data": [
    {
      "direction": "pansol_f",
      "dow": 1,
      "hr": 17,
      "sampleCount": 12,
      "avgDelay": 180,
      "p50Delay": 120,
      "p90Delay": 420,
      "incidentCount": 3
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `direction` | `string` | Direction key |
| `dow` | `number` | Manila-local day of week, `0=Sun` ... `6=Sat` |
| `hr` | `number` | Manila-local hour, `0-23` |
| `sampleCount` | `number` | Samples in the bucket |
| `avgDelay` | `number` | Average delay in seconds |
| `p50Delay` | `number\|null` | Nearest-rank median delay in seconds |
| `p90Delay` | `number\|null` | Nearest-rank P90 delay in seconds |
| `incidentCount` | `number` | Number of samples in the bucket with at least one incident |

---

## Local-only Endpoints

### `POST /api/traffic/seed`

Inserts a test sample. Localhost only.

### `GET /api/debug/collect`

Manually triggers a collection cycle. Localhost only.

---

## Corridors

| ID | Forward (`_f`) | Reverse (`_r`) |
|----|----------------|----------------|
| `pansol` | Bucal Bypass to Municipal Hall | Municipal Hall to Bucal Bypass |
| `municipal` | Municipal Hall to Crossing | Crossing to Municipal Hall |
| `uplb` | Crossing to UPLB Gate | UPLB Gate to Crossing |
| `bay` | Crossing to Bay Arch | Bay Arch to Crossing |

Direction keys use `{id}_f` for forward and `{id}_r` for reverse.

---

## Storage And Collection

### Cron

- Schedule: every 10 minutes.
- Collection gate: 5 AM-11 PM Manila time.
- Per tick: 8 Routing API calls plus 1 Incident Details API call.
- Retention: 14 days.
- Stale threshold: 30 minutes.

### D1 `traffic_samples`

One row per direction per collection tick.

| Column | Description |
|--------|-------------|
| `direction` | Direction key |
| `duration_seconds` | Travel time with traffic |
| `no_traffic_seconds` | Free-flow travel time |
| `historic_seconds` | Historic travel time |
| `delay_seconds` | Route delay |
| `congestion_ratio` | Route multiplier |
| `distance_meters` | Route distance |
| `traffic_delay_seconds` | TomTom route traffic delay |
| `current_speed_kph` | Derived current speed |
| `free_flow_speed_kph` | Derived free-flow speed |
| `route_polyline` | Semicolon-separated route points |
| `incidents` | JSON string containing normalized incidents |
| `provider` | Data provider |
| `api_status` | Collection status |
| `error_message` | Error detail, if any |
| `created_at` | UTC collection timestamp |

### Timestamp Convention

- D1 stores UTC as `YYYY-MM-DD HH:MM:SS`.
- Worker normalizes public timestamps to ISO 8601 UTC.
- Frontend displays user-facing times in `Asia/Manila`.
