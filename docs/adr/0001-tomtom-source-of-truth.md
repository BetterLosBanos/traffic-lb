# ADR 0001: Use Routing and Flow Segment APIs as data sources; keep traffic tiles visual-only

## Status

Accepted

## Context

Traffic Ba Sa LB uses several TomTom APIs that expose overlapping traffic information:

- Routing API returns route-level travel time, delay, route distance, and route geometry for a Corridor Direction.
- Flow Segment Data API returns checkpoint-level speed and travel-time data for the road fragment nearest a requested point.
- Incident Details API returns provider-reported road conditions inside or intersecting the app's corridor area.
- Vector flow and incident tiles render live traffic lines and incident icons on the map.

Vector flow tiles are visually useful because they show colored live traffic lines, but they are tile-oriented display data. They do not naturally align with the app's Corridor Direction model, do not directly answer full-corridor travel time, and would require tile decoding, clipping, map matching, and duplicate handling before they could become app-owned analytics records.

## Decision

Use TomTom APIs by role:

- Routing API is the source of truth for Traffic Samples.
- Flow Segment Data API is the source of truth for Flow Segment Samples.
- Incident Details API is the source of truth for cached Traffic Incidents.
- Vector flow and incident tiles are Traffic Map Context only.

The app keeps colored TomTom traffic lines on the map as an important live visual signal, but it does not store tile-derived traffic data in D1 or calculate Congestion Severity from tile colors.

## Consequences

Traffic Samples stay aligned with the Corridor Direction model and remain suitable for dashboard metrics, history, trends, and heatmaps.

Flow Segment Samples can be added later for bottleneck detail and route map overlays without replacing route-level metrics.

The map can continue showing visually rich live TomTom traffic tiles without making tile structure part of the app's persisted data model.

If a future feature needs tile-derived data, it must explicitly reopen this decision and justify the added decoding, matching, and storage complexity.
