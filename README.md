# Traffic Ba Sa Pansol?

Live traffic status between Pansol (Calamba) and Los Baños, Laguna.

## Architecture

```
TomTom API → Worker (cron every 10 min, 5 AM-11 PM Manila) → D1 database
                                            ↓
Frontend (Cloudflare Pages) ← /api/traffic/latest + /api/traffic/history
```

## Setup

### Prerequisites

- Node.js 20+
- [TomTom API key](https://developer.tomtom.com/) (free tier)
- Cloudflare account

### Install

```bash
pnpm install
```

### Local Development

**1. Start the Worker (API + cron):**

```bash
cd worker
# Create the D1 database locally
pnpm exec wrangler d1 migrations apply traffic-pansol-db --local
# Set your TomTom API key
export TOMTOM_API_KEY=your_key_here
# Start worker dev server
pnpm exec wrangler dev
```

**2. Start the frontend (separate terminal):**

```bash
pnpm dev
```

Frontend proxies `/api/*` to `localhost:8787` automatically.

**3. Manually collect a local sample:**

With the Worker running on `localhost:8787`:

```bash
pnpm collect:local
```

This local command bypasses the scheduled-hours guard so you can populate a development database at any time.

### Deploy

**Worker (API + frontend assets + cron):**

```bash
# Create D1 database
cd worker
pnpm exec wrangler d1 create traffic-pansol-db
# Update wrangler.jsonc with the database_id
pnpm exec wrangler d1 migrations apply traffic-pansol-db --remote
# Set TomTom API key as secret
pnpm exec wrangler secret put TOMTOM_API_KEY
# Build frontend assets and deploy the Worker
pnpm run deploy
```

## Route Coordinates

| Direction | Origin | Destination |
|-----------|--------|-------------|
| Northbound | Boundary Arch (14.1721, 121.2014) | Bucal Bypass / Pansol (14.1878, 121.1706) |
| Southbound | Bucal Bypass / Pansol (14.1878, 121.1706) | Boundary Arch (14.1721, 121.2014) |

These are approximate and can be tuned for better accuracy.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/traffic/latest` | Latest traffic status (both directions) |
| `GET /api/traffic/history?hours=24` | Hourly congestion history |
| `GET /api/traffic/samples?hours=3` | Raw recent samples for granular trend views |
| `GET /api/health` | Collection health summary |
| `GET /api/debug/collect` | Local-only manual collection trigger |

## Congestion Levels

| Ratio | Level |
|-------|-------|
| < 1.25 | Light |
| < 1.75 | Moderate |
| < 2.5 | Heavy |
| ≥ 2.5 | Severe |

## Collection Schedule

Automated traffic collection runs every 10 minutes from 5:00 AM to 11:00 PM Manila time. Late-night collection is skipped to protect the TomTom daily request quota.

Cloudflare cron is configured in UTC as:

```json
"*/10 21-23,0-15 * * *"
```

The Worker also checks `Asia/Manila` time at runtime before scheduled collection, so the business rule remains explicit in code.

## Map Tiles

The frontend uses CARTO raster tiles, which do not require a Stadia Maps API key:

- Light: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
- Dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`

Leaflet attribution is enabled for OpenStreetMap and CARTO.
