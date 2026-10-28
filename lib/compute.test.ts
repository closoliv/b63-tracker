import { describe, expect, it } from "vitest";
import {
  buildRow,
  directionLabel,
  fillFor,
  leaveIn,
  selectArrivals,
  zoneFor,
} from "./compute";
import type { LineConfig } from "./types";

const color = { bg: "#000", text: "#fff" };
const at = "2026-10-28T12:00:00.000Z";

const busLine: LineConfig = {
  label: "Carlos", mode: "bus", route: "B63", direction: "Southbound",
  stopId: "308215", walkMin: 3, unit: "leave",
};
const subwayLine: LineConfig = {
  label: "Freyal", mode: "subway", route: "R",
  stopId: "R32N", walkMin: 8, unit: "stops",
};

describe("directionLabel", () => {
  it("derives Manhattan-bound from an N stop ID", () => {
    expect(directionLabel(subwayLine)).toBe("Manhattan-bound");
  });
  it("derives Brooklyn-bound from an S stop ID", () => {
    expect(directionLabel({ ...subwayLine, stopId: "R32S" })).toBe("Brooklyn-bound");
  });
  it("uses a non-empty config direction as an override", () => {
    expect(directionLabel({ ...subwayLine, direction: "Uptown" })).toBe("Uptown");
    expect(directionLabel({ ...subwayLine, direction: "  " })).toBe("Manhattan-bound");
  });
  it("uses the config direction for buses", () => {
    expect(directionLabel(busLine)).toBe("Southbound");
  });
});

describe("leaveIn", () => {
  it("subtracts walk time", () => {
    expect(leaveIn(10, 3)).toBe(7);
    expect(leaveIn(2, 3)).toBe(-1);
  });
  it("is null without a time", () => {
    expect(leaveIn(null, 3)).toBeNull();
  });
});

describe("selectArrivals", () => {
  it("leave mode skips vehicles you can't make", () => {
    const { current, next } = selectArrivals(
      [{ minutesAway: 2, stopsAway: 1 }, { minutesAway: 12, stopsAway: 7 }, { minutesAway: 5, stopsAway: 3 }],
      "leave", 3,
    );
    expect(current?.minutesAway).toBe(5);
    expect(next?.minutesAway).toBe(12);
  });
  it("leave mode keeps a vehicle you can just make (leaveIn 0)", () => {
    const { current } = selectArrivals([{ minutesAway: 3, stopsAway: 2 }], "leave", 3);
    expect(current?.minutesAway).toBe(3);
  });
  it("stops mode takes first and second arriving regardless of walk", () => {
    const { current, next } = selectArrivals(
      [{ minutesAway: 9, stopsAway: 5 }, { minutesAway: 1, stopsAway: 0 }, { minutesAway: 4, stopsAway: 2 }],
      "stops", 8,
    );
    expect(current?.stopsAway).toBe(0);
    expect(next?.stopsAway).toBe(2);
  });
  it("returns nulls when nothing is catchable", () => {
    expect(selectArrivals([{ minutesAway: 1, stopsAway: 0 }], "leave", 3)).toEqual({
      current: null, next: null,
    });
  });
  it("sorts unknown times last", () => {
    const { current, next } = selectArrivals(
      [{ minutesAway: null, stopsAway: 9 }, { minutesAway: 10, stopsAway: 6 }],
      "leave", 3,
    );
    expect(current?.minutesAway).toBe(10);
    expect(next?.stopsAway).toBe(9);
  });
});

describe("zoneFor", () => {
  it("leave thresholds: red <= 2, yellow <= 6", () => {
    expect(zoneFor("leave", 0)).toBe("red");
    expect(zoneFor("leave", 2)).toBe("red");
    expect(zoneFor("leave", 3)).toBe("yellow");
    expect(zoneFor("leave", 6)).toBe("yellow");
    expect(zoneFor("leave", 7)).toBe("green");
  });
  it("stops thresholds: red <= 2, yellow <= 5", () => {
    expect(zoneFor("stops", 2)).toBe("red");
    expect(zoneFor("stops", 5)).toBe("yellow");
    expect(zoneFor("stops", 6)).toBe("green");
  });
});

describe("fillFor", () => {
  it("is full at zero", () => {
    expect(fillFor("leave", 0)).toBe(1);
    expect(fillFor("stops", 0)).toBe(1);
  });
  it("scales over 15 min / 10 stops", () => {
    expect(fillFor("leave", 7.5)).toBeCloseTo(0.5);
    expect(fillFor("stops", 5)).toBeCloseTo(0.5);
  });
  it("floors at 0.08 beyond the max", () => {
    expect(fillFor("leave", 15)).toBe(0.08);
    expect(fillFor("leave", 40)).toBe(0.08);
    expect(fillFor("stops", 9.5)).toBe(0.08);
  });
});

describe("buildRow", () => {
  it("builds a leave row with current and next catchable", () => {
    const row = buildRow(busLine, [
      { minutesAway: 1, stopsAway: 0 },
      { minutesAway: 7.6, stopsAway: 4 },
      { minutesAway: 18.2, stopsAway: 11 },
    ], color, at);
    expect(row).toMatchObject({
      minutesAway: 7, stopsAway: 4, leaveIn: 4,
      nextMinutesAway: 18, nextStopsAway: 11, nextLeaveIn: 15,
      unit: "leave", zone: "yellow", routeColor: color, updatedAt: at,
    });
    expect(row.fill).toBeCloseTo(1 - 4 / 15);
    expect(row.error).toBeUndefined();
  });

  it("builds a stops row", () => {
    const row = buildRow(subwayLine, [
      { minutesAway: 3, stopsAway: 1 },
      { minutesAway: 15, stopsAway: 8 },
    ], color, at);
    expect(row).toMatchObject({
      direction: "Manhattan-bound", stopsAway: 1, nextStopsAway: 8, unit: "stops", zone: "red",
    });
    expect(row.fill).toBeCloseTo(0.9);
  });

  it("falls back to stops when a leave line has no times", () => {
    const row = buildRow(busLine, [{ minutesAway: null, stopsAway: 4 }], color, at);
    expect(row).toMatchObject({ unit: "stops", stopsAway: 4, leaveIn: null, zone: "yellow" });
  });

  it("reports an error when there is nothing to show", () => {
    const row = buildRow(busLine, [], color, at);
    expect(row.error).toBe("No upcoming vehicles");
    expect(row.minutesAway).toBeNull();
  });
});
