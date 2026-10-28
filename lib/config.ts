import type { Unit } from "./types";

export const THRESHOLDS: Record<
  Unit,
  { red: number; yellow: number; barMax: number }
> = {
  // minutes until you must leave; bar fills over 15 min
  leave: { red: 2, yellow: 6, barMax: 15 },
  // stops away; bar fills over 10 stops
  stops: { red: 2, yellow: 5, barMax: 10 },
};

/** Minimum bar width so a far-away vehicle still shows a sliver. */
export const MIN_FILL = 0.08;
