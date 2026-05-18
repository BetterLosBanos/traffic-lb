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
- Data status: trust and freshness
- Reported issues: possible cause
- Route map: spatial context
- Trend chart: timing decision

## Hierarchy rule

Cards should dominate the first screen.

The multiplier is the hero:
`2.1x` should be easier to notice than labels, icons, maps, or charts.

## Default rhythm

1. Dynamic summary
2. Traffic cards
3. Compact data freshness
4. Reported issues
5. Route map
6. Traffic trend

## Design test

Before adding or enlarging anything, ask:

Does this help the user answer either:
1. How bad is it now?
2. Should I wait?

If not, reduce it, move it down, or remove it.
