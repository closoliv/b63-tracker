import { describe, expect, it, vi } from "vitest";
import fileSettings from "../../config/lines.json";
import { checkPasscode } from "./auth";
import { validateSettings } from "./schema";
import { isStorageConfigured, readSettings, SETTINGS_KEY, type SettingsClient } from "./store";

const bus = {
  label: "Carlos", mode: "bus", route: "B63", direction: "Southbound",
  stopId: "308215", walkMin: 3, unit: "leave",
};
const subway = { label: "Freyal", mode: "subway", route: "R", stopId: "R32N", walkMin: 8, unit: "stops" };

const errorsFor = (lines: unknown[]) => {
  const r = validateSettings({ lines });
  return r.ok ? {} : r.fieldErrors;
};

describe("settings schema", () => {
  it("accepts the shipped config/lines.json", () => {
    expect(validateSettings(fileSettings).ok).toBe(true);
  });

  it("accepts one or two lines and normalizes case and whitespace", () => {
    const r = validateSettings({
      lines: [{ ...bus, route: " b63 " }, { ...subway, route: "r", stopId: "r32s", direction: "" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.settings.lines[0].route).toBe("B63");
    expect(r.settings.lines[1]).toEqual({ ...subway, stopId: "R32S" }); // empty direction dropped
  });

  it("keeps a subway direction override", () => {
    const r = validateSettings({ lines: [{ ...subway, direction: "Uptown" }] });
    expect(r.ok && r.settings.lines[0].direction).toBe("Uptown");
  });

  it("requires 1–2 lines", () => {
    expect(errorsFor([])).toHaveProperty("lines");
    expect(errorsFor([bus, subway, bus])).toHaveProperty("lines");
    expect(validateSettings({}).ok).toBe(false);
  });

  it("rejects bad mode and unit", () => {
    expect(errorsFor([{ ...bus, mode: "ferry" }])).toHaveProperty(["lines.0.mode"]);
    expect(errorsFor([{ ...bus, unit: "hours" }])).toHaveProperty(["lines.0.unit"]);
  });

  it("limits walkMin to whole minutes 0–60", () => {
    expect(validateSettings({ lines: [{ ...bus, walkMin: 0 }] }).ok).toBe(true);
    expect(validateSettings({ lines: [{ ...bus, walkMin: 60 }] }).ok).toBe(true);
    for (const walkMin of [-1, 61, 2.5, NaN, "3"]) {
      expect(errorsFor([{ ...bus, walkMin }])).toHaveProperty(["lines.0.walkMin"]);
    }
  });

  it("limits label to 20 characters and requires stopId", () => {
    expect(errorsFor([{ ...bus, label: "x".repeat(21) }])).toHaveProperty(["lines.0.label"]);
    expect(validateSettings({ lines: [{ ...bus, label: "x".repeat(20) }] }).ok).toBe(true);
    expect(errorsFor([{ ...bus, stopId: "  " }])).toHaveProperty(["lines.0.stopId"]);
  });

  it("subway: route must have a color and stop ID must end in N or S", () => {
    expect(errorsFor([{ ...subway, route: "X" }])).toHaveProperty(["lines.0.route"]);
    expect(errorsFor([{ ...subway, stopId: "R32" }])).toHaveProperty(["lines.0.stopId"]);
  });

  it("bus: route looks like B63 and direction is required", () => {
    for (const route of ["B", "63", "B1234", "ABCD1", "B63X"]) {
      expect(errorsFor([{ ...bus, route }])).toHaveProperty(["lines.0.route"]);
    }
    expect(validateSettings({ lines: [{ ...bus, route: "BX12" }] }).ok).toBe(true);
    expect(errorsFor([{ ...bus, direction: "" }])).toHaveProperty(["lines.0.direction"]);
    expect(errorsFor([{ ...bus, direction: undefined }])).toHaveProperty(["lines.0.direction"]);
  });

  it("reports errors on the right line", () => {
    expect(Object.keys(errorsFor([bus, { ...subway, stopId: "" }]))).toEqual(["lines.1.stopId"]);
  });
});

describe("checkPasscode", () => {
  it("accepts only the exact passcode", () => {
    expect(checkPasscode("hunter2", "hunter2")).toBe(true);
    expect(checkPasscode("hunter3", "hunter2")).toBe(false);
    expect(checkPasscode("hunter", "hunter2")).toBe(false);
    expect(checkPasscode("", "hunter2")).toBe(false);
    expect(checkPasscode(null, "hunter2")).toBe(false);
  });
  it("always fails when no passcode is configured", () => {
    expect(checkPasscode("", undefined)).toBe(false);
    expect(checkPasscode("", "")).toBe(false);
    expect(checkPasscode("anything", undefined)).toBe(false);
  });
});

describe("settings storage fallback", () => {
  const fake = (value: unknown): SettingsClient => ({
    get: vi.fn(async () => value),
    set: vi.fn(async () => "OK"),
  });
  const stored = { lines: [{ ...subway, route: "Q", stopId: "D24N" }] };

  it("uses config/lines.json when storage isn't configured", async () => {
    expect(await readSettings(null)).toEqual({
      settings: fileSettings, source: "file", storageConfigured: false,
    });
  });

  it("uses config/lines.json when nothing is saved yet", async () => {
    const c = fake(null);
    expect(await readSettings(c)).toMatchObject({ settings: fileSettings, source: "file", storageConfigured: true });
    expect(c.get).toHaveBeenCalledWith(SETTINGS_KEY);
  });

  it("uses saved settings (object or JSON string)", async () => {
    expect(await readSettings(fake(stored))).toEqual({ settings: stored, source: "redis", storageConfigured: true });
    expect((await readSettings(fake(JSON.stringify(stored)))).settings).toEqual(stored);
  });

  it("falls back when the saved value is invalid or the read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await readSettings(fake({ lines: [] }))).source).toBe("file");
    expect((await readSettings(fake("not json"))).source).toBe("file");
    const broken: SettingsClient = { get: async () => { throw new Error("down"); }, set: async () => "OK" };
    expect(await readSettings(broken)).toMatchObject({ settings: fileSettings, source: "file" });
  });

  it("detects either env var pair", () => {
    expect(isStorageConfigured({})).toBe(false);
    expect(isStorageConfigured({ UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" })).toBe(true);
    expect(isStorageConfigured({ KV_REST_API_URL: "u", KV_REST_API_TOKEN: "t" })).toBe(true);
    expect(isStorageConfigured({ KV_REST_API_URL: "u" })).toBe(false);
  });
});
