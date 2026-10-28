export type Mode = "bus" | "subway";
export type Unit = "leave" | "stops";
export type Zone = "green" | "yellow" | "red";

export interface LineConfig {
  label: string;
  mode: Mode;
  route: string;
  direction: string;
  stopId: string;
  walkMin: number;
  unit: Unit;
}

/** One upcoming vehicle at the configured stop, as reported by a feed. */
export interface Arrival {
  /** Fractional minutes until arrival; null when the feed has no time estimate. */
  minutesAway: number | null;
  /** Stops between the vehicle and the configured stop; null when unknown. */
  stopsAway: number | null;
}

export interface RouteColor {
  bg: string;
  text: string;
}

export interface DepartureRow {
  label: string;
  mode: Mode;
  route: string;
  direction: string;
  minutesAway: number | null;
  stopsAway: number | null;
  leaveIn: number | null;
  nextMinutesAway: number | null;
  nextStopsAway: number | null;
  nextLeaveIn: number | null;
  /** Unit actually displayed. A "leave" line falls back to "stops" when the feed has no times. */
  unit: Unit;
  zone: Zone;
  fill: number;
  routeColor: RouteColor;
  updatedAt: string;
  mock?: boolean;
  error?: string;
}
