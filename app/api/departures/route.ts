import { connection } from "next/server";
import { routeColor } from "@/lib/colors";
import { buildRow, errorRow } from "@/lib/compute";
import { getLines } from "@/lib/config";
import { fetchBusArrivals } from "@/lib/feeds/bus";
import { mockArrivals } from "@/lib/feeds/mock";
import { fetchSubwayArrivals } from "@/lib/feeds/subway";
import type { Arrival, DepartureRow, LineConfig } from "@/lib/types";

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

export async function GET() {
  // Always render at request time.
  await connection();

  let lines: LineConfig[];
  try {
    lines = getLines();
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Bad config", rows: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rows = await Promise.all(lines.map(rowFor));
  return Response.json(
    { rows, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
