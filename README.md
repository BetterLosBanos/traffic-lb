# Traffic Ba Sa LB?

Live traffic status for Los Baños major corridors — Pansol, Municipal Hall, Crossing, UPLB, Bay.

## Architecture

```
TomTom API → Worker (cron every 10 min) → D1 database
                       ↓
Frontend (Cloudflare Pages) ← /api/traffic/latest + /api/traffic/history + /api/traffic/samples
```

## Corridors

| ID | Route |
|----|-------|
| pansol | Bucal Bypass ↔ Municipal Hall |
| municipal | Municipal Hall ↔ Crossing |
| uplb | Crossing ↔ UPLB Gate |
| bay | Crossing ↔ Bay Welcome Arch |

Each corridor has two directions (`_f` forward, `_r` reverse) — 8 API calls per collection tick.

## Setup

### Prerequisites

- Node.js 22+
- [TomTom API key](https://developer.tomtom.com/) (free tier)
- Cloudflare account

### Install

```bash
pnpm install --store /home/pn/.local/share/pnpm/store
```

### Local Development

**1. Start the Worker (API + cron):**

```bash
# Apply D1 migrations locally
npx wrangler d1 migrations apply traffic-lb-db --local

# Set your TomTom API key
export TOMTOM_API_KEY=your_key_here

# Start worker dev server
npx wrangler dev
```

**2. Start the frontend (separate terminal):**

```bash
pnpm dev
```

Frontend proxies `/api/*` to `localhost:8787` via Vite config.

### Deploy

```bash
# Create D1 database (first time only)
npx wrangler d1 create traffic-lb-db
# Update wrangler.jsonc with the returned database_id

# Apply remote migrations
npx wrangler d1 migrations apply traffic-lb-db --remote

# Set TomTom API key as secret
npx wrangler secret put TOMTOM_API_KEY

# Build frontend and deploy worker
pnpm build
npx wrangler deploy
```

## API

Full endpoint docs, response schemas, and database schema → **[API.md](./API.md)**

Quick reference:

| Endpoint | Description |
|----------|-------------|
| `GET /api/traffic/latest` | Latest traffic status for all corridors |
| `GET /api/traffic/history?hours=24` | Hourly averages for trend chart |
| `GET /api/traffic/samples?hours=3` | Raw samples for granular trend |
| `GET /api/traffic/heatmap?days=14` | Weekly pattern heatmap (P50/P90 by hour-of-week) |
| `GET /api/health` | Collection health and last sample time |
| `POST /api/traffic/seed` | Insert test sample (localhost only) |
| `GET /api/debug/collect` | Manual cron trigger (localhost only) |

## Collection Schedule

Cron runs every 10 minutes (`*/10 * * * *`). The Worker gates on Manila hours (5 AM–11 PM) to conserve TomTom quota. Each tick makes 9 API calls (8 routing + 1 incidents).

## Map

MapLibre GL JS + CARTO vector tiles (no API key). Route polylines from TomTom routing coordinates.
