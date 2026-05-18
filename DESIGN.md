# Traffic Ba Sa LB — Design Principles

Traffic Ba Sa LB has two jobs:

1. Tell the user how bad traffic is right now.
2. Help the user decide whether to leave now or wait.

## Product posture

This is a civic utility, not a decorative dashboard.

The interface should feel like a road sign or departure board:
- glance-first
- mobile-first
- large numbers
- clear direction labels
- minimal decoration
- color used as warning, not atmosphere

## Component roles

- Hero summary: instant overall answer
- Traffic cards: current corridor and direction severity
- Trust strip: data freshness at a glance
- Reported issues: possible cause
- Route map: spatial context
- Trend chart: timing decision

## Hierarchy rule

Cards should dominate the first screen.

**Delay minutes are the hero metric.** `+7 min` is the first thing the eye lands on. The congestion ratio (`1.4x`) is supporting context in the detail row — not the primary number.

Color communicates severity. The number communicates magnitude.

## Card layout (per direction)

```
┌─────────────────────────────┐
│  [severity dot] Label       │
│                             │
│  +7 min        1.4x         │
│  ─────────────────          │
│  min delay                  │
└─────────────────────────────┘
```

- Left: delay hero (large, colored by congestion level)
- Right: ratio detail (small, colored, supports the story)

## Default rhythm

1. Dynamic summary
2. Traffic cards
3. Compact data freshness
4. Reported issues
5. Route map
6. Traffic trend

## Timestamps

All timestamps are ISO 8601 UTC at the API boundary. Frontend formats to `Asia/Manila`. No raw D1 datetime strings escape the worker.

## Design test

Before adding or enlarging anything, ask:

Does this help the user answer either:
1. How bad is it now?
2. Should I wait?

If not, reduce it, move it down, or remove it.
