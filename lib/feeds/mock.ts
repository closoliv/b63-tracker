import type { Arrival, LineConfig } from "../types";

const HEADWAY_MIN: Record<string, number> = { bus: 9, subway: 6 };
const MIN_PER_STOP: Record<string, number> = { bus: 1.6, subway: 2 };

/**
 * Deterministic fake arrivals derived from the wall clock, so they count down
 * between polls and roll over to the next vehicle when one arrives.
 */
export function mockArrivals(line: LineConfig, now = Date.now()): Arrival[] {
  const headway = HEADWAY_MIN[line.mode];
  const perStop = MIN_PER_STOP[line.mode];
  // Offset each stop so two lines don't move in lockstep.
  let seed = 0;
  for (const ch of line.stopId) seed = (seed * 31 + ch.charCodeAt(0)) % 1000;
  const phase = ((now / 60_000 + seed) % headway + headway) % headway;
  const first = headway - phase;
  return Array.from({ length: 4 }, (_, i) => {
    // Small irregularity so gaps aren't perfectly even.
    const minutesAway = first + i * headway + (i % 2 ? 1.3 : 0);
    return { minutesAway, stopsAway: Math.floor(minutesAway / perStop) };
  });
}
