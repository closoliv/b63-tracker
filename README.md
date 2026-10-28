# b63-tracker

A mobile-friendly page that tells you, for one or two NYC transit lines, how many minutes until you need to leave or how many stops away the next bus or train is.

<!-- Screenshot placeholder: add docs/screenshot.png and uncomment -->
<!-- ![b63-tracker](docs/screenshot.png) -->

## How it works

```
MTA feeds ──► /api/departures (Next.js route handler) ──► page (polls every 30s)
```

- **Bus**: MTA Bus Time SIRI StopMonitoring JSON (`lib/feeds/bus.ts`). Needs a free key from [Bus Time](https://register.developer.obanyc.com/).
- **Subway**: MTA GTFS-Realtime feeds, decoded with `gtfs-realtime-bindings` (`lib/feeds/subway.ts`). No key needed.
- `app/api/departures/route.ts` fetches each configured line (feed responses cached in memory for ~20s), and `lib/compute.ts` turns arrivals into one row per line: the current and next catchable vehicle, an urgency zone (green / yellow / red) and a bar fill.
- `app/page.tsx` shows one panel per line. If a feed fails, that panel shows "No data" and the reason; the other line keeps working.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

### Environment variables

| Variable      | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `MTA_BUS_KEY` | MTA Bus Time API key. If empty, bus lines use mock data.                 |
| `USE_MOCK`    | `true` to use fake arrivals for every line (counts down and rolls over). |
| `ADMIN_PASSCODE` | Passcode for saving on `/settings`. If empty, settings can't be changed. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis for saved settings. `KV_REST_API_URL` / `KV_REST_API_TOKEN` also work. |

Keys are only read on the server and never sent to the browser. `.env.local` is gitignored.

## Settings

Display settings can be changed from your phone at `/settings`, with no code change or redeploy. Every device (and later the LED sign) reads the same saved settings, and displays pick up a save within one 30s refresh.

1. **Add Upstash Redis in Vercel**: in your Vercel project, open Storage (or the Marketplace), add **Upstash Redis**, and connect it to the project. This injects `UPSTASH_REDIS_REST_URL`/`TOKEN` or `KV_REST_API_URL`/`TOKEN`; either pair works.
2. **Set `ADMIN_PASSCODE`** in the project's Environment Variables, then redeploy once so both changes take effect.
3. **Open `/settings` by typing the URL** (e.g. `https://your-app.vercel.app/settings`). There's deliberately no link to it from the display, and it's marked `noindex`. Enter the passcode once; it's remembered on that device (use "Forget passcode" to clear it).

On the settings page you can preview the real panels before saving. Settings are stored as JSON under the Redis key `settings:v1`. Until something is saved, or when Redis isn't configured, the app uses `config/lines.json`, and `/settings` shows "Storage not configured" and is read-only.

API: `GET /api/settings` (public), `PUT /api/settings` and `POST /api/settings/preview` (both need the `x-admin-passcode` header).

## Changing the default lines

Edit `config/lines.json` (1 or 2 lines). This is the fallback when nothing has been saved on `/settings`:

```json
{ "label": "Carlos", "mode": "bus", "route": "B63",
  "direction": "Southbound", "stopId": "308215", "walkMin": 3, "unit": "leave" }
```

- `mode`: `bus` or `subway`
- `direction`: label shown under the route. Optional for subway lines, which derive it from the stop ID suffix (`N` → "Manhattan-bound", `S` → "Brooklyn-bound"); a non-empty value overrides that
- `stopId`: Bus Time stop code (e.g. B63 southbound `308215`, northbound `308208`) or GTFS stop ID with direction (e.g. `R32N`, `R32S`)
- `walkMin`: minutes to walk to the stop
- `unit`: `leave` (minutes until you must leave) or `stops` (stops away)

Urgency thresholds and bar ranges live in `lib/config.ts`. Route colors come from `data/routeColors.json`.

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm test`: unit tests for `lib/compute.ts` and feed parsers (Vitest)
- `npm run lint`

## Roadmap

- Drive an LED matrix display (e.g. a Raspberry Pi + RGB matrix) from `/api/departures`, so the countdown lives by the door.
