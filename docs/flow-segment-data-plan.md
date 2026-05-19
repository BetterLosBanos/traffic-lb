# Flow Segment Data Plan

Status: draft
Date: 2026-05-18

## Purpose

TomTom Flow Segment Data should be used as a bottleneck and segment-detail
layer. It should not replace the Routing API.

The Routing API remains the source of truth for full corridor travel time,
delay, route distance, and route shape. Flow Segment Data answers a narrower
question: given one latitude/longitude point, what is the traffic condition on
the closest TomTom road fragment?

## API Role

### Routing API

Use for corridor-level metrics:

- current travel time
- free-flow travel time
- historical travel time
- route delay
- congestion ratio
- route distance
- route polyline

### Flow Segment Data API

Use for sampled road-fragment metrics:

- current speed
- free-flow speed
- current travel time
- free-flow travel time
- segment delay
- segment ratio
- confidence
- road closure
- road class (`frc`)
- segment geometry
- optional OpenLR code

### Vector Flow Tiles

Use for live visual map context only. Vector tiles are not ideal as the primary
analytics source because they are tile-oriented and do not provide stable
dashboard-friendly segment IDs.

## How Segments Work

Flow Segment Data does not let us define an arbitrary corridor as a segment.
The request passes one point:

```text
point=latitude,longitude
```

TomTom returns the closest traffic-flow road fragment for that point.

In this app, we should define our own stable corridor checkpoints and map each
checkpoint to TomTom's nearest flow segment.

Example:

```text
Bucal -> Municipal route
  checkpoint 1: Bucal approach
  checkpoint 2: Pansol / middle section
  checkpoint 3: Municipal approach
```

The app-owned checkpoint is stable. The returned TomTom segment is the live road
fragment associated with that checkpoint at collection time.

## Request Budget

TomTom Freemium limits:

- 50,000 free tile requests daily
- 2,500 free non-tile requests daily

Current collection schedule:

```text
*/10 * * * *
```

That is 144 collection ticks per day.

Current non-tile calls per tick:

- 8 Routing API calls, one per corridor direction
- 1 Incident Details API call

Current daily non-tile usage:

```text
9 calls/tick * 144 ticks/day = 1,296 calls/day
```

Remaining non-tile budget:

```text
2,500 - 1,296 = 1,204 calls/day
```

## Sampling Options

### Option A: Hourly Flow Segment Sampling

Sample 3 checkpoints per direction once per hour.

```text
3 checkpoints * 8 directions * 24 hours = 576 calls/day
1,296 existing calls + 576 flow calls = 1,872 calls/day
```

This leaves 628 calls/day for retries, manual refreshes, debugging, and future
small additions.

Recommendation: use this option first.

### Option B: Every 30 Minutes

Sample 3 checkpoints per direction every 30 minutes.

```text
3 checkpoints * 8 directions * 48 runs = 1,152 calls/day
1,296 existing calls + 1,152 flow calls = 2,448 calls/day
```

This technically fits, but leaves only 52 calls/day. That is too tight for
retries or operational variance.

### Option C: Rotate Checkpoints Every 10 Minutes

Sample one checkpoint per direction on each 10-minute collection tick. With
three checkpoints, each checkpoint updates every 30 minutes.

```text
1 checkpoint * 8 directions * 144 ticks = 1,152 calls/day
1,296 existing calls + 1,152 flow calls = 2,448 calls/day
```

This has the same budget issue as Option B.

## Recommended First Version

Use hourly Flow Segment Data collection with 3 checkpoints per corridor
direction.

Implementation shape:

1. Keep Routing API collection every 10 minutes.
2. Keep Incident Details collection every 10 minutes.
3. Add Flow Segment Data collection once per hour.
4. Sample 3 checkpoint points per direction.
5. Store results in `flow_segments`.
6. Add a latest-segments API endpoint.
7. Use segment data for a bottleneck card and route map overlays.

## Suggested Stored Fields

The existing `flow_segments` table already covers part of this model. It should
be expanded or normalized to store:

| Field | Source | Purpose |
|-------|--------|---------|
| `sample_id` | local | Link to traffic sample when applicable |
| `direction` | local | Corridor direction |
| `point_index` | local | Stable checkpoint index |
| `lat` | local | Checkpoint latitude |
| `lng` | local | Checkpoint longitude |
| `frc` | TomTom | Functional road class |
| `current_speed_kph` | TomTom `currentSpeed` | Current segment speed |
| `free_flow_speed_kph` | TomTom `freeFlowSpeed` | Free-flow segment speed |
| `current_travel_time_seconds` | TomTom `currentTravelTime` | Segment travel time now |
| `free_flow_travel_time_seconds` | TomTom `freeFlowTravelTime` | Segment free-flow time |
| `delay_seconds` | derived | `currentTravelTime - freeFlowTravelTime` |
| `congestion_ratio` | derived | `currentTravelTime / freeFlowTravelTime` |
| `confidence` | TomTom | Quality score from 0 to 1 |
| `road_closure` | TomTom | Closure indicator |
| `coordinates` | TomTom | Returned segment geometry |
| `openlr` | TomTom, optional | Segment reference if `openLr=true` |
| `created_at` | local | Collection timestamp |

## Product Uses

### Bottleneck Card

Show the worst current checkpoint by delay or ratio:

```text
Worst bottleneck: Pansol approach
12 km/h vs 38 km/h normal · +3 min · confidence 0.86
```

### Route Map Overlay

Draw sampled TomTom flow segments over the route:

- subtle yellow/orange/red overlays by segment ratio or delay
- dashed red for closures
- muted styling for low-confidence data

### Historical Reports

Use stored segment samples for:

- recurring bottleneck ranking
- segment P90 delay
- segment reliability by hour/day
- closure frequency
- time wasted by bottleneck
- incident-to-segment correlation

## Constraints

- Do not sample every route vertex.
- Do not use Flow Segment Data as the source of truth for whole-corridor ETA.
- Do not run 3+ checkpoints per direction every 10 minutes under the Freemium
  non-tile limit.
- Treat segment coordinates as visualization geometry, not necessarily exact
  road centerline geometry. TomTom notes coordinates may shift by zoom/style.

