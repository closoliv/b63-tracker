import { connection } from "next/server";
import { getDepartureRows } from "@/lib/departures";
import { getSettings } from "@/lib/settings/store";

export async function GET() {
  // Always render at request time.
  await connection();

  const { settings } = await getSettings();
  const rows = await getDepartureRows(settings.lines);
  return Response.json(
    { rows, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
