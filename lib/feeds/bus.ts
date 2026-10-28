import type { Arrival, LineConfig } from "../types";
import { cached } from "./cache";
import { fetchFeed } from "./http";

const ENDPOINT = "https://bustime.mta.info/api/siri/stop-monitoring.json";

interface MonitoredCall {
  ExpectedArrivalTime?: string;
  Extensions?: { Distances?: { StopsFromCall?: number } };
}

interface SiriResponse {
  Siri?: {
    ServiceDelivery?: {
      StopMonitoringDelivery?: {
        MonitoredStopVisit?: {
          MonitoredVehicleJourney?: { MonitoredCall?: MonitoredCall };
        }[];
        ErrorCondition?: { Description?: string };
      }[];
    };
  };
}

export function parseStopMonitoring(json: SiriResponse, now: number): Arrival[] {
  const delivery = json.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0];
  const err = delivery?.ErrorCondition?.Description;
  if (err) throw new Error(`Bus Time: ${err}`);
  const visits = delivery?.MonitoredStopVisit ?? [];
  const arrivals: Arrival[] = [];
  for (const v of visits) {
    const call = v.MonitoredVehicleJourney?.MonitoredCall;
    if (!call) continue;
    const t = call.ExpectedArrivalTime ? Date.parse(call.ExpectedArrivalTime) : NaN;
    const minutesAway = Number.isFinite(t) ? (t - now) / 60_000 : null;
    if (minutesAway != null && minutesAway < -0.5) continue; // already gone
    const stops = call.Extensions?.Distances?.StopsFromCall;
    arrivals.push({
      minutesAway: minutesAway == null ? null : Math.max(0, minutesAway),
      stopsAway: typeof stops === "number" ? stops : null,
    });
  }
  return arrivals;
}

export async function fetchBusArrivals(line: LineConfig, key: string): Promise<Arrival[]> {
  const url =
    `${ENDPOINT}?key=${encodeURIComponent(key)}` +
    `&MonitoringRef=${encodeURIComponent(line.stopId)}` +
    `&LineRef=${encodeURIComponent(`MTA NYCT_${line.route}`)}`;

  // Cache key omits the API key.
  const json = await cached(`bus:${line.stopId}:${line.route}`, async () => {
    const res = await fetchFeed(url, "Bus Time");
    return (await res.json()) as SiriResponse;
  });
  return parseStopMonitoring(json, Date.now());
}
