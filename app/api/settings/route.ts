import { connection } from "next/server";
import { checkPasscode, PASSCODE_HEADER, unauthorized } from "@/lib/settings/auth";
import { validateSettings } from "@/lib/settings/schema";
import { getSettings, isStorageConfigured, saveSettings } from "@/lib/settings/store";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  const { settings, source, storageConfigured } = await getSettings();
  return Response.json({ ...settings, source, storageConfigured }, { headers: noStore });
}

export async function PUT(request: Request) {
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

  if (!isStorageConfigured()) {
    return Response.json({ error: "Storage not configured" }, { status: 503, headers: noStore });
  }
  try {
    await saveSettings(result.settings);
  } catch (e) {
    console.error("settings: save failed", e);
    return Response.json({ error: "Couldn't save settings" }, { status: 502, headers: noStore });
  }
  return Response.json(result.settings, { headers: noStore });
}
