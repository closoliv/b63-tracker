import type { DepartureRow, Mode, RouteColor, Zone } from "@/lib/types";

const ZONE_COLOR: Record<Zone, string> = {
  green: "var(--green)",
  yellow: "var(--yellow)",
  red: "var(--red)",
};

export function RouteBullet({
  mode,
  route,
  color,
  size,
}: {
  mode: Mode;
  route: string;
  color: RouteColor;
  size?: "small";
}) {
  return (
    <span
      className={`bullet ${mode}${size ? ` ${size}` : ""}`}
      style={{ background: color.bg, color: color.text }}
      aria-label={`${route} ${mode}`}
    >
      {route}
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

export function DeparturePanel({ row }: { row: DepartureRow }) {
  const header = (
    <div>
      <div className="label">{row.label}</div>
      <div className="route">
        <RouteBullet mode={row.mode} route={row.route} color={row.routeColor} />
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
