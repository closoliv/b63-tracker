import { routeColor } from "./colors";
import { buildRow, errorRow } from "./compute";
import { fetchBusArrivals } from "./feeds/bus";
import { mockArrivals } from "./feeds/mock";
import { fetchSubwayArrivals } from "./feeds/subway";
import type { Arrival, DepartureRow, LineConfig } from "./types";

async function rowFor(line: LineConfig): Promise<DepartureRow> {
  const color = routeColor(line.mode, line.route);
  const busKey = process.env.MTA_BUS_KEY;
  const useMock =
    process.env.USE_MOCK === "true" || (line.mode === "bus" && !busKey);

  try {
    let arrivals: Arrival[];
    if (useMock) arrivals = mockArrivals(line);
    else if (line.mode === "bus") arrivals = await fetchBusArrivals(line, busKey!);
    else arrivals = await fetchSubwayArrivals(line);

    const row = buildRow(line, arrivals, color, new Date().toISOString());
    return useMock ? { ...row, mock: true } : row;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Feed error";
    return errorRow(line, color, new Date().toISOString(), msg);
  }
}

/** One normalized row per line. A failed feed becomes that row's error, never a throw. */
export function getDepartureRows(lines: LineConfig[]): Promise<DepartureRow[]> {
  return Promise.all(lines.map(rowFor));
}
