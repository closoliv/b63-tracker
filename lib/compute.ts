import { MIN_FILL, THRESHOLDS } from "./config";
import type {
  Arrival,
  DepartureRow,
  LineConfig,
  RouteColor,
  Unit,
  Zone,
} from "./types";

const SUBWAY_DIRECTIONS: Record<string, string> = {
  N: "Manhattan-bound",
  S: "Brooklyn-bound",
};

/**
 * Direction shown under the route. A non-empty config `direction` wins;
 * otherwise subway lines derive it from the GTFS stop ID suffix (R32N → N).
 */
export function directionLabel(line: Pick<LineConfig, "mode" | "stopId" | "direction">): string {
  const override = line.direction?.trim();
  if (override) return override;
  if (line.mode === "subway") {
    return SUBWAY_DIRECTIONS[line.stopId.slice(-1).toUpperCase()] ?? "";
  }
  return "";
}

/** Minutes until you must leave to catch a vehicle. Fractional, may be negative. */
export function leaveIn(minutesAway: number | null, walkMin: number): number | null {
  return minutesAway == null ? null : minutesAway - walkMin;
}

/** Sort by time (unknown times last), then by stops. */
export function sortArrivals(arrivals: Arrival[]): Arrival[] {
  return [...arrivals].sort((a, b) => {
    const am = a.minutesAway ?? Infinity;
    const bm = b.minutesAway ?? Infinity;
    if (am !== bm) return am - bm;
    return (a.stopsAway ?? Infinity) - (b.stopsAway ?? Infinity);
  });
}

/**
 * Pick the current and next vehicle.
 * - "leave": skip vehicles you can't make (leaveIn < 0). Vehicles with no time
 *   estimate can't be ruled out, so they are kept.
 * - "stops": first and second arriving.
 */
export function selectArrivals(
  arrivals: Arrival[],
  unit: Unit,
  walkMin: number,
): { current: Arrival | null; next: Arrival | null } {
  let list = sortArrivals(arrivals);
  if (unit === "leave") {
    list = list.filter((a) => {
      const l = leaveIn(a.minutesAway, walkMin);
      return l == null || l >= 0;
    });
  }
  return { current: list[0] ?? null, next: list[1] ?? null };
}

export function zoneFor(unit: Unit, value: number): Zone {
  const t = THRESHOLDS[unit];
  if (value <= t.red) return "red";
  if (value <= t.yellow) return "yellow";
  return "green";
}

/** Bar fill 0–1: full when the vehicle is here / it's time to go, floored at MIN_FILL. */
export function fillFor(unit: Unit, value: number): number {
  const max = THRESHOLDS[unit].barMax;
  const v = Math.max(0, value);
  return Math.max(MIN_FILL, 1 - Math.min(v, max) / max);
}

const floorOrNull = (n: number | null) => (n == null ? null : Math.max(0, Math.floor(n)));

export function buildRow(
  line: LineConfig,
  arrivals: Arrival[],
  color: RouteColor,
  updatedAt: string,
): DepartureRow {
  const { current, next } = selectArrivals(arrivals, line.unit, line.walkMin);

  const base = {
    label: line.label,
    mode: line.mode,
    route: line.route,
    direction: directionLabel(line),
    routeColor: color,
    updatedAt,
  };

  const row: DepartureRow = {
    ...base,
    minutesAway: floorOrNull(current?.minutesAway ?? null),
    stopsAway: current?.stopsAway ?? null,
    leaveIn: floorOrNull(leaveIn(current?.minutesAway ?? null, line.walkMin)),
    nextMinutesAway: floorOrNull(next?.minutesAway ?? null),
    nextStopsAway: next?.stopsAway ?? null,
    nextLeaveIn: floorOrNull(leaveIn(next?.minutesAway ?? null, line.walkMin)),
    unit: line.unit,
    zone: "green",
    fill: MIN_FILL,
  };

  // A "leave" line without a time estimate falls back to showing stops.
  if (row.unit === "leave" && row.leaveIn == null) row.unit = "stops";

  const value = row.unit === "leave" ? row.leaveIn : row.stopsAway;
  if (value == null) {
    return { ...row, unit: line.unit, error: "No upcoming vehicles" };
  }
  row.zone = zoneFor(row.unit, value);
  row.fill = fillFor(row.unit, value);
  return row;
}

export function errorRow(
  line: LineConfig,
  color: RouteColor,
  updatedAt: string,
  error: string,
): DepartureRow {
  return {
    label: line.label,
    mode: line.mode,
    route: line.route,
    direction: directionLabel(line),
    minutesAway: null,
    stopsAway: null,
    leaveIn: null,
    nextMinutesAway: null,
    nextStopsAway: null,
    nextLeaveIn: null,
    unit: line.unit,
    zone: "red",
    fill: 0,
    routeColor: color,
    updatedAt,
    error,
  };
}
