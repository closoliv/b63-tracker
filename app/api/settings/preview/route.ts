import { getDepartureRows } from "@/lib/departures";
import { checkPasscode, PASSCODE_HEADER, unauthorized } from "@/lib/settings/auth";
import { validateSettings } from "@/lib/settings/schema";

const noStore = { "Cache-Control": "no-store" };

/** Rows /api/departures would return for draft settings, without saving them. */
export async function POST(request: Request) {
  if (!checkPasscode(request.headers.get(PASSCODE_HEADER))) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Body must be JSON", fieldErrors: { "": "Body must be JSON" } },
      { status: 400, headers: noStore },
    );
  }
  const result = validateSettings(body);
  if (!result.ok) {
    return Response.json(
      { error: "Invalid settings", fieldErrors: result.fieldErrors },
      { status: 400, headers: noStore },
    );
  }
  const rows = await getDepartureRows(result.settings.lines);
  return Response.json({ rows, updatedAt: new Date().toISOString() }, { headers: noStore });
}
