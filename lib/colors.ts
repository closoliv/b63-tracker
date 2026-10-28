import colors from "../data/routeColors.json";
import type { Mode, RouteColor } from "./types";

const FALLBACK: RouteColor = { bg: "#808183", text: "#FFFFFF" };

export function routeColor(mode: Mode, route: string): RouteColor {
  if (mode === "bus") return { bg: colors.bus.bg, text: colors.bus.text };
  const c = (colors.subway as Record<string, RouteColor>)[route.toUpperCase()];
  return c ?? FALLBACK;
}
