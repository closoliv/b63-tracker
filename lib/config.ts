import linesJson from "../config/lines.json";
import type { LineConfig, Unit } from "./types";

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

export function getLines(): LineConfig[] {
  const lines = (linesJson as { lines: LineConfig[] }).lines;
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 2) {
    throw new Error("config/lines.json must define 1 or 2 lines");
  }
  return lines;
}
