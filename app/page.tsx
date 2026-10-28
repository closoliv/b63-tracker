"use client";

import { useCallback, useEffect, useState } from "react";
import { DeparturePanel } from "@/components/DeparturePanel";
import type { DepartureRow } from "@/lib/types";

const POLL_MS = 30_000;

export default function Home() {
  const [rows, setRows] = useState<DepartureRow[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/departures", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRows(json.rows);
      const t = Date.now();
      setFetchedAt(t);
      setNow(t);
      setFetchError(null);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Request failed");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Coming back to the tab (e.g. after saving settings) refreshes right away.
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const ago = fetchedAt == null || now == null ? null : Math.max(0, Math.round((now - fetchedAt) / 1000));
  const mock = rows?.some((r) => r.mock);

  return (
    <main className="page">
      <div className="grid">
        {rows?.map((row) => <DeparturePanel key={`${row.label}-${row.route}`} row={row} />)}
      </div>
      <footer className="footer">
        {ago == null ? (fetchError ? `Couldn't load: ${fetchError}` : "Loading…") : `updated ${ago}s ago`}
        {ago != null && fetchError && ` · last refresh failed`}
        {mock && " · mock data"}
      </footer>
    </main>
  );
}
