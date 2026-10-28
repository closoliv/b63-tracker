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

Keys are only read on the server and never sent to the browser. `.env.local` is gitignored.

## Changing lines

Edit `config/lines.json` (1 or 2 lines):

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
