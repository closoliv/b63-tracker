"use client";

import { useCallback, useEffect, useState } from "react";
import type { DepartureRow, Zone } from "@/lib/types";

const POLL_MS = 30_000;

const ZONE_COLOR: Record<Zone, string> = {
  green: "var(--green)",
  yellow: "var(--yellow)",
  red: "var(--red)",
};

function Bullet({ row }: { row: DepartureRow }) {
  return (
    <span
      className={`bullet ${row.mode}`}
      style={{ background: row.routeColor.bg, color: row.routeColor.text }}
      aria-label={`${row.route} ${row.mode}`}
    >
      {row.route}
    </span>
  );
}

function nextText(row: DepartureRow): string | null {
  if (row.unit === "leave") {
    if (row.nextLeaveIn == null) return null;
    return row.nextLeaveIn === 0 ? "Next: leave now" : `Next: leave in ${row.nextLeaveIn} min`;
  }
  if (row.nextStopsAway == null) return null;
  if (row.nextStopsAway === 0) return "Next: here";
  return `Next: ${row.nextStopsAway} ${row.nextStopsAway === 1 ? "stop" : "stops"} away`;
}

function Panel({ row }: { row: DepartureRow }) {
  const header = (
    <div>
      <div className="label">{row.label}</div>
      <div className="route">
        <Bullet row={row} />
        <span>{row.direction}</span>
      </div>
    </div>
  );

  if (row.error) {
    return (
      <section className="panel dim">
        {header}
        <div>
          <div className="reading">
            <span className="big nodata">No data</span>
          </div>
          <div className="reason">{row.error}</div>
        </div>
      </section>
    );
  }

  const value = row.unit === "leave" ? row.leaveIn : row.stopsAway;
  let big: string;
  let unitLabel: string | null;
  if (value === 0) {
    big = row.unit === "leave" ? "Go" : "Here";
    unitLabel = null;
  } else {
    big = String(value);
    unitLabel = row.unit === "leave" ? "min to leave" : value === 1 ? "stop away" : "stops away";
  }
  const next = nextText(row);

  return (
    <section className="panel">
      {header}
      <div>
        <div className="reading">
          <span className="big">{big}</span>
          {unitLabel && <span className="unit">{unitLabel}</span>}
        </div>
        <div
          className="track"
          role="meter"
          aria-label={row.zone}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={row.fill}
        >
          <div
            className="bar"
            style={{ width: `${row.fill * 100}%`, background: ZONE_COLOR[row.zone] }}
          />
        </div>
      </div>
      {next && <div className="next">{next}</div>}
    </section>
  );
}

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
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const ago = fetchedAt == null || now == null ? null : Math.max(0, Math.round((now - fetchedAt) / 1000));
  const mock = rows?.some((r) => r.mock);

  return (
    <main className="page">
      <div className="grid">
        {rows?.map((row) => <Panel key={`${row.label}-${row.route}`} row={row} />)}
      </div>
      <footer className="footer">
        {ago == null ? (fetchError ? `Couldn't load: ${fetchError}` : "Loading…") : `updated ${ago}s ago`}
        {ago != null && fetchError && ` · last refresh failed`}
        {mock && " · mock data"}
      </footer>
    </main>
  );
}
