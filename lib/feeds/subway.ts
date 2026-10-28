import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import type { Arrival, LineConfig } from "../types";
import { cached } from "./cache";
import { fetchFeed } from "./http";

const BASE = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs";

/** Route id → feed suffix. "" is the numbered-lines feed (1–7, 42 St shuttle). */
const FEED_FOR_ROUTE: Record<string, string> = {
  A: "-ace", C: "-ace", E: "-ace", H: "-ace", FS: "-ace",
  B: "-bdfm", D: "-bdfm", F: "-bdfm", FX: "-bdfm", M: "-bdfm",
  G: "-g",
  J: "-jz", Z: "-jz",
  L: "-l",
  N: "-nqrw", Q: "-nqrw", R: "-nqrw", W: "-nqrw",
  SI: "-si", SIR: "-si",
  "1": "", "2": "", "3": "", "4": "", "5": "", "6": "", "6X": "",
  "7": "", "7X": "", GS: "", S: "",
};

export function feedUrl(route: string): string {
  const suffix = FEED_FOR_ROUTE[route.toUpperCase()];
  if (suffix === undefined) throw new Error(`No subway feed known for route ${route}`);
  return BASE + suffix;
}

type FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;

const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v); // handles number and protobuf Long
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function parseTripUpdates(
  feed: FeedMessage,
  route: string,
  stopId: string,
  now: number,
): Arrival[] {
  const arrivals: Arrival[] = [];
  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    if (!tu || tu.trip?.routeId !== route) continue;
    const stus = tu.stopTimeUpdate ?? [];
    const idx = stus.findIndex((s) => s.stopId === stopId);
    if (idx < 0) continue;
    const stu = stus[idx];
    const t = toNum(stu.arrival?.time) ?? toNum(stu.departure?.time);
    if (t == null) continue;
    const minutesAway = (t * 1000 - now) / 60_000;
    if (minutesAway < -0.5) continue;
    arrivals.push({ minutesAway: Math.max(0, minutesAway), stopsAway: idx });
  }
  return arrivals;
}

export async function fetchSubwayArrivals(line: LineConfig): Promise<Arrival[]> {
  const url = feedUrl(line.route);
  const feed = await cached(url, async () => {
    const res = await fetchFeed(url, "Subway feed");
    const buf = new Uint8Array(await res.arrayBuffer());
    return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf);
  });
  return parseTripUpdates(feed, line.route, line.stopId, Date.now());
}
