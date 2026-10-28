/**
 * fetch with a timeout and error messages that are safe to show on the page:
 * never includes the URL, which may carry an API key.
 */
export async function fetchFeed(url: string, name: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  } catch (e) {
    const err = e as { name?: string; cause?: { code?: string } };
    const why = err.name === "TimeoutError" ? "timed out" : (err.cause?.code ?? "network error");
    throw new Error(`${name} unreachable (${why})`);
  }
  if (!res.ok) throw new Error(`${name} returned HTTP ${res.status}`);
  return res;
}
