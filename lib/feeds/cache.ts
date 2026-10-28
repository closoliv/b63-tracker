const TTL_MS = 20_000;

const store = new Map<string, { at: number; value: Promise<unknown> }>();

/**
 * Memoize a feed fetch in memory for ~20s. Concurrent callers share one
 * in-flight request; failures are not cached.
 */
export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  return value;
}
