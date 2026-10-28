import { Redis } from "@upstash/redis";
import fileSettings from "../../config/lines.json";
import { validateSettings, type Settings } from "./schema";

export const SETTINGS_KEY = "settings:v1";
const CACHE_MS = 10_000;

/** The subset of the Redis client the store uses, so tests can pass a fake. */
export interface SettingsClient {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
}

export type SettingsSource = "redis" | "file";

export interface LoadedSettings {
  settings: Settings;
  source: SettingsSource;
  storageConfigured: boolean;
}

export function isStorageConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(
    (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) ||
      (env.KV_REST_API_URL && env.KV_REST_API_TOKEN),
  );
}

let client: SettingsClient | null | undefined;

/** Upstash client from either the UPSTASH_* or KV_* env vars, or null if neither is set. */
export function getClient(): SettingsClient | null {
  if (client === undefined) {
    // Redis.fromEnv() reads UPSTASH_REDIS_REST_* and falls back to KV_REST_API_*.
    client = isStorageConfigured() ? Redis.fromEnv() : null;
  }
  return client;
}

export function defaultSettings(): Settings {
  return fileSettings as Settings;
}

/**
 * Read settings from storage, falling back to config/lines.json when storage
 * isn't configured, nothing is saved yet, the read fails, or the saved value
 * doesn't validate.
 */
export async function readSettings(c: SettingsClient | null): Promise<LoadedSettings> {
  const fallback = { settings: defaultSettings(), source: "file" as const, storageConfigured: c != null };
  if (!c) return fallback;
  let raw: unknown;
  try {
    raw = await c.get(SETTINGS_KEY);
  } catch (e) {
    console.error("settings: Redis read failed, using config/lines.json", e);
    return fallback;
  }
  if (raw == null) return fallback;
  // @upstash/redis parses JSON automatically; tolerate a raw string too.
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  const result = validateSettings(raw);
  if (!result.ok) {
    console.error("settings: stored value is invalid, using config/lines.json", result.fieldErrors);
    return fallback;
  }
  return { settings: result.settings, source: "redis", storageConfigured: true };
}

let cache: { at: number; value: Promise<LoadedSettings> } | null = null;

/**
 * Current settings, cached in memory briefly. A save clears this instance's
 * cache; other server instances pick the change up within CACHE_MS.
 */
export function getSettings(): Promise<LoadedSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = readSettings(getClient());
  cache = { at: Date.now(), value };
  return value;
}

export function clearSettingsCache(): void {
  cache = null;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const c = getClient();
  if (!c) throw new Error("Storage not configured");
  await c.set(SETTINGS_KEY, settings);
  clearSettingsCache();
}
