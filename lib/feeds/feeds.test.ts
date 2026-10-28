import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { describe, expect, it } from "vitest";
import { parseStopMonitoring } from "./bus";
import { mockArrivals } from "./mock";
import { feedUrl, parseTripUpdates } from "./subway";

const now = Date.parse("2026-10-28T12:00:00Z");

describe("parseStopMonitoring", () => {
  it("reads ExpectedArrivalTime and StopsFromCall", () => {
    const visit = (time: string | undefined, stops: number) => ({
      MonitoredVehicleJourney: {
        MonitoredCall: {
          ExpectedArrivalTime: time,
          Extensions: { Distances: { StopsFromCall: stops } },
        },
      },
    });
    const arrivals = parseStopMonitoring(
      {
        Siri: {
          ServiceDelivery: {
            StopMonitoringDelivery: [
              { MonitoredStopVisit: [visit("2026-10-28T12:06:00Z", 3), visit(undefined, 9)] },
            ],
          },
        },
      },
      now,
    );
    expect(arrivals).toEqual([
      { minutesAway: 6, stopsAway: 3 },
      { minutesAway: null, stopsAway: 9 },
    ]);
  });

  it("throws on a SIRI error condition", () => {
    expect(() =>
      parseStopMonitoring(
        { Siri: { ServiceDelivery: { StopMonitoringDelivery: [{ ErrorCondition: { Description: "bad key" } }] } } },
        now,
      ),
    ).toThrow("bad key");
  });
});

describe("parseTripUpdates", () => {
  it("filters by route and counts stops before the target stop", () => {
    const t = (min: number) => now / 1000 + min * 60;
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.fromObject({
      header: { gtfsRealtimeVersion: "1.0" },
      entity: [
        {
          id: "1",
          tripUpdate: {
            trip: { routeId: "R" },
            stopTimeUpdate: [
              { stopId: "R30N", arrival: { time: t(2) } },
              { stopId: "R31N", arrival: { time: t(4) } },
              { stopId: "R32N", arrival: { time: t(6) } },
            ],
          },
        },
        {
          id: "2",
          tripUpdate: {
            trip: { routeId: "N" },
            stopTimeUpdate: [{ stopId: "R32N", arrival: { time: t(1) } }],
          },
        },
      ],
    });
    expect(parseTripUpdates(feed, "R", "R32N", now)).toEqual([{ minutesAway: 6, stopsAway: 2 }]);
  });

  it("maps routes to feed groups", () => {
    expect(feedUrl("R")).toMatch(/gtfs-nqrw$/);
    expect(feedUrl("A")).toMatch(/gtfs-ace$/);
    expect(feedUrl("4")).toMatch(/nyct%2Fgtfs$/);
    expect(() => feedUrl("X9")).toThrow();
  });
});

describe("mockArrivals", () => {
  it("counts down and rolls to the next vehicle", () => {
    const line = { label: "x", mode: "bus" as const, route: "B63", direction: "S", stopId: "1", walkMin: 3, unit: "leave" as const };
    const a = mockArrivals(line, now)[0].minutesAway!;
    const b = mockArrivals(line, now + 60_000)[0].minutesAway!;
    expect(Math.abs(b - (a - 1)) < 1e-9 || b > a).toBe(true);
    expect(a).toBeGreaterThan(0);
  });
});
