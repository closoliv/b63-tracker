import { z } from "zod";
import colors from "../../data/routeColors.json";
import type { LineConfig } from "../types";

export const SUBWAY_ROUTES = Object.keys(colors.subway);
export const BUS_ROUTE_RE = /^[A-Z]{1,3}\d{1,3}$/;

const trimmed = z.string().trim();

const lineSchema = z
  .object({
    label: trimmed.min(1, "Label is required").max(20, "Label must be 20 characters or fewer"),
    mode: z.enum(["bus", "subway"], { error: 'Mode must be "bus" or "subway"' }),
    route: trimmed.toUpperCase().min(1, "Route is required"),
    direction: trimmed.optional(),
    stopId: trimmed.toUpperCase().min(1, "Stop ID is required"),
    walkMin: z
      .number({ error: "Walk time must be a number" })
      .int("Walk time must be a whole number")
      .min(0, "Walk time must be 0–60")
      .max(60, "Walk time must be 0–60"),
    unit: z.enum(["leave", "stops"], { error: 'Show must be "leave" or "stops"' }),
  })
  .superRefine((line, ctx) => {
    if (line.mode === "subway") {
      if (line.route && !SUBWAY_ROUTES.includes(line.route)) {
        ctx.addIssue({ code: "custom", path: ["route"], message: `Unknown subway route "${line.route}"` });
      }
      if (line.stopId && !/[NS]$/.test(line.stopId)) {
        ctx.addIssue({ code: "custom", path: ["stopId"], message: "Subway stop ID must end in N or S" });
      }
    } else {
      if (line.route && !BUS_ROUTE_RE.test(line.route)) {
        ctx.addIssue({ code: "custom", path: ["route"], message: "Bus route looks like B63" });
      }
      if (!line.direction) {
        ctx.addIssue({ code: "custom", path: ["direction"], message: "Direction is required for buses" });
      }
    }
  })
  .transform((line): LineConfig => {
    // Drop an empty direction so subway lines derive it.
    const { direction, ...rest } = line;
    return direction ? { ...rest, direction } : rest;
  });

export const settingsSchema = z.object({
  lines: z
    .array(lineSchema, { error: "lines must be a list" })
    .min(1, "Configure at least 1 line")
    .max(2, "Configure at most 2 lines"),
});

export interface Settings {
  lines: LineConfig[];
}

/** Field errors keyed by dotted path, e.g. "lines.0.stopId". "" is the form as a whole. */
export type FieldErrors = Record<string, string>;

export function validateSettings(
  input: unknown,
): { ok: true; settings: Settings } | { ok: false; fieldErrors: FieldErrors } {
  const result = settingsSchema.safeParse(input);
  if (result.success) return { ok: true, settings: result.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, fieldErrors };
}
