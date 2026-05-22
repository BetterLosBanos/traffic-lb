# Context

## Design Principles

### Forkable Traffic Monitor

The app is designed to be easily forked by developers who want to monitor traffic for their own areas. Corridors, API keys, and collection schedule are the only things a forker must change. Architecture decisions should keep the code discoverable — a new developer should find the corridor config, the data fetch layer, and the component map within minutes of opening the repo.

### Departure Decision Priority

The app's primary purpose is helping commuters decide whether to leave now, wait, or reroute. Analytics features serve this goal first. Civic advocacy (showing chronic congestion to LGU) is a secondary use case served by the same data.

### Two-Tab Layout

The app has two views: Live (default) and Analytics. Live shows traffic cards with inline sparklines and direction markers, incidents, and the map — a 10-second scan for commuters. Analytics shows trend charts and heatmap for deeper analysis. Tabs are state-based, no URL routing.

## Glossary

### Corridor Direction

One directed traffic route between the two endpoints of a corridor. Each corridor has a forward and reverse Corridor Direction, identified by `{corridorId}_f` or `{corridorId}_r`.

### Corridor Direction ID

An internal app identifier for a Corridor Direction, such as `pansol_f` or `pansol_r`. It may appear in Worker-to-frontend JSON, but UI code treats it as an opaque lookup key and converts it to user-facing labels through corridor metadata.

### Traffic Collection Tick

One scheduled collection pass that refreshes current traffic data for all corridor directions by collecting route metrics and incidents, then storing a new sample set. It runs every 10 minutes.

A tick is valid when it records an outcome for each corridor direction, even if some outcomes are errors. Incident collection is optional and must not block route samples.

The tick is a scheduled action, not a persisted domain object. The Traffic Samples matter; the tick itself does not.

### Traffic Sample

The recorded outcome for one Corridor Direction during one Traffic Collection Tick. A Traffic Sample may contain successful route metrics or an error outcome.

### Usual Delay

The extra travel time compared with the historic travel time for the same route. It answers how bad traffic is compared with normal conditions.

### Free-flow Delay

The extra travel time compared with free-flow travel time. It answers how far current travel is from ideal conditions.

### Free-flow Travel Time

Travel time under free-flow conditions. User-facing UI may call this "Best time" to avoid technical wording, but code and contracts use Free-flow terminology.

### Traffic Baseline

The comparison basis for delay, ratio, and Congestion Severity. Code and contracts use `usual` for historic conditions and `freeFlow` for free-flow conditions. User-facing UI may label `freeFlow` as "Best time".

### Delay Seconds

Legacy storage field for route delay. Frontend-facing app contracts do not expose it; they use `usualDelaySeconds` and `freeFlowDelaySeconds`.

### Usual Ratio

Current travel time divided by historic travel time for the same route. It answers how many times worse current traffic is than usual conditions.

### Free-flow Ratio

Current travel time divided by free-flow travel time. It answers how many times worse current traffic is than ideal conditions.

### Congestion Ratio

Legacy storage field for route multiplier. Frontend-facing app contracts do not expose it; they use `usualRatio` and `freeFlowRatio`.

Baseline-specific route metrics should be explicit. New contracts use Usual Delay, Free-flow Delay, Usual Ratio, and Free-flow Ratio rather than ambiguous delay or ratio fields.

Frontend-facing app contracts use baseline-specific metric fields and do not expose ambiguous generic delay, ratio, or severity fields. Existing storage fields may remain for compatibility, but they are not the canonical app model.

Worker traffic endpoints are internal app contracts for the frontend. They are externally accessible HTTP endpoints, but the app does not currently guarantee third-party API stability. Worker and frontend may make coordinated contract changes inside the repo.

### Congestion Severity

The light, moderate, heavy, or severe traffic category for a Corridor Direction. It is derived from a baseline-specific ratio. The same threshold bands apply to Usual Ratio and Free-flow Ratio, and the UI labels which baseline is active.

### Departure Decision

The user's decision whether to leave now or wait, based on current delay, usual conditions, incidents, and short-term trends.

### Traffic Incident

A provider-reported road condition whose geometry is inside or intersects the app's corridor area. A Traffic Incident may explain delay, but is not itself a Corridor Direction metric and is not assigned to a Corridor Direction unless the app performs its own matching. Traffic Incidents are currently cached as JSON snapshots on Traffic Samples, not as separate persisted records.

Traffic Incidents are explanatory context only. They do not determine congestion severity, because route travel time already reflects live traffic conditions.

### Flow Segment Checkpoint

**Status: Planned, deferred.** See `docs/flow-segment-data-plan.md` for design and `docs/adr/0001-tomtom-source-of-truth.md` for the architectural decision. The `flow_segments` table exists but is not yet written to or queried.

An app-owned point along a Corridor Direction used to request TomTom Flow Segment Data for the nearest road fragment. It may share coordinates with a route waypoint, but it exists to observe traffic, not to shape the route.

### Flow Segment Sample

A checkpoint-level traffic observation associated with a Traffic Sample when available. It describes the TomTom road fragment nearest a Flow Segment Checkpoint and supports bottleneck detail and route map overlays. It does not define a Corridor Direction's travel time, delay, ratio, or Congestion Severity.

Flow Segment Samples are a lower-frequency detail layer. The first version collects them hourly; they do not need to be as fresh as Traffic Samples unless the product uses them for real-time Departure Decisions.

### Route Waypoint

An app-owned point used to shape a Routing API request for a Corridor Direction. It exists to keep the calculated route on the intended corridor path, not to observe traffic conditions.

### Traffic Map Context

The map's visual context for route polylines, TomTom flow tiles, incident tiles, waypoints, and checkpoints. The colored TomTom traffic lines are an important live visual signal for users, but they do not define stored Traffic Samples, Traffic Incidents, or Congestion Severity.

Traffic Samples come from the Routing API. Flow Segment Samples come from the Flow Segment Data API. Traffic Incidents come from the Incident Details API. TomTom vector flow and incident tiles are used for live map display rather than app-owned analytics records.
