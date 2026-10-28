import { createHash, timingSafeEqual } from "node:crypto";

export const PASSCODE_HEADER = "x-admin-passcode";

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * Constant-time passcode check. Always false when no passcode is configured.
 * Hashing first makes both buffers the same length, so the length isn't leaked either.
 */
export function checkPasscode(
  provided: string | null | undefined,
  expected: string | undefined = process.env.ADMIN_PASSCODE,
): boolean {
  if (!expected || provided == null) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

export function unauthorized(): Response {
  const error = process.env.ADMIN_PASSCODE
    ? "Wrong passcode"
    : "ADMIN_PASSCODE isn't set on the server, so settings can't be changed";
  return Response.json(
    { error },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
