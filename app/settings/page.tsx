"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DeparturePanel } from "@/components/DeparturePanel";
import { RoutePicker } from "@/components/RoutePicker";
import { directionLabel } from "@/lib/compute";
import { SUBWAY_ROUTES, validateSettings, type FieldErrors } from "@/lib/settings/schema";
import type { DepartureRow, LineConfig, Mode, Unit } from "@/lib/types";

const PASSCODE_KEY = "b63:adminPasscode";
const PASSCODE_HEADER = "x-admin-passcode";

/** Form state for one line. walkMin stays a string while editing. */
interface FormLine {
  label: string;
  mode: Mode;
  route: string;
  direction: string;
  stopId: string;
  walkMin: string;
  unit: Unit;
}

const NEW_LINE: FormLine = {
  label: "",
  mode: "subway",
  route: "",
  direction: "",
  stopId: "",
  walkMin: "5",
  unit: "stops",
};

const toForm = (l: LineConfig): FormLine => ({
  label: l.label,
  mode: l.mode,
  route: l.route,
  direction: l.direction ?? "",
  stopId: l.stopId,
  walkMin: String(l.walkMin),
  unit: l.unit,
});

const toInput = (lines: FormLine[]) => ({
  lines: lines.map((l) => ({
    ...l,
    walkMin: l.walkMin.trim() === "" ? NaN : Number(l.walkMin),
  })),
});

function readStoredPasscode(): string | null {
  try {
    return localStorage.getItem(PASSCODE_KEY);
  } catch {
    return null;
  }
}
function storePasscode(value: string | null) {
  try {
    if (value == null) localStorage.removeItem(PASSCODE_KEY);
    else localStorage.setItem(PASSCODE_KEY, value);
  } catch {
    // Storage blocked (private mode): the passcode just isn't remembered.
  }
}

/* ───────────── small form controls ───────────── */

function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="field" disabled={disabled}>
      <legend className="field-label">{legend}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={o.value} className={o.value === value ? "on" : undefined}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id}>
      {message}
    </p>
  );
}

/* ───────────── line card ───────────── */

function LineCard({
  index,
  line,
  errors,
  onChange,
  disabled,
}: {
  index: number;
  line: FormLine;
  errors: FieldErrors;
  onChange: (patch: Partial<FormLine>) => void;
  disabled: boolean;
}) {
  const p = `line${index}`;
  const err = (field: keyof FormLine) => errors[`lines.${index}.${field}`];
  const describe = (field: keyof FormLine, help?: string) =>
    [help, err(field) ? `${p}-${field}-error` : undefined].filter(Boolean).join(" ") || undefined;

  const derived = directionLabel({ mode: "subway", stopId: line.stopId, direction: "" });
  const walk = Number(line.walkMin);
  const step = (d: number) =>
    onChange({ walkMin: String(Math.min(60, Math.max(0, (Number.isFinite(walk) ? Math.round(walk) : 0) + d))) });

  return (
    <section className="panel form-card" aria-labelledby={`${p}-title`}>
      <h2 className="label" id={`${p}-title`}>
        Line {index + 1}
      </h2>

      <div className="field">
        <label className="field-label" htmlFor={`${p}-label`}>
          Label
        </label>
        <input
          id={`${p}-label`}
          className="input"
          value={line.label}
          maxLength={40}
          placeholder="e.g. Carlos"
          disabled={disabled}
          aria-invalid={err("label") ? true : undefined}
          aria-describedby={describe("label")}
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <FieldError id={`${p}-label-error`} message={err("label")} />
      </div>

      <Segmented
        legend="Mode"
        name={`${p}-mode`}
        value={line.mode}
        disabled={disabled}
        options={[
          { value: "bus", label: "Bus" },
          { value: "subway", label: "Subway" },
        ]}
        onChange={(mode) => {
          if (mode === line.mode) return;
          // A route from the other mode is never valid; make the user pick again.
          onChange({ mode, route: "" });
        }}
      />

      <div className="field">
        <label className="field-label" id={`${p}-route-label`} htmlFor={`${p}-route`}>
          Route
        </label>
        {line.mode === "subway" ? (
          <RoutePicker
            id={`${p}-route`}
            routes={SUBWAY_ROUTES}
            value={line.route}
            disabled={disabled}
            invalid={Boolean(err("route"))}
            describedBy={describe("route")}
            onChange={(route) => onChange({ route })}
          />
        ) : (
          <input
            id={`${p}-route`}
            className="input"
            value={line.route}
            placeholder="e.g. B63"
            autoCapitalize="characters"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={err("route") ? true : undefined}
            aria-describedby={describe("route")}
            onChange={(e) => onChange({ route: e.target.value.toUpperCase() })}
          />
        )}
        <FieldError id={`${p}-route-error`} message={err("route")} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${p}-stopId`}>
          Stop ID
        </label>
        <input
          id={`${p}-stopId`}
          className="input"
          value={line.stopId}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode={line.mode === "bus" ? "numeric" : "text"}
          disabled={disabled}
          aria-invalid={err("stopId") ? true : undefined}
          aria-describedby={describe("stopId", `${p}-stopId-help`)}
          onChange={(e) => onChange({ stopId: e.target.value })}
        />
        <p className="field-help" id={`${p}-stopId-help`}>
          Bus: 6-digit code on the stop sign. Subway: GTFS stop ID ending in N or S, e.g. R32N.
        </p>
        <FieldError id={`${p}-stopId-error`} message={err("stopId")} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${p}-direction`}>
          Direction label{line.mode === "subway" ? " (optional)" : ""}
        </label>
        <input
          id={`${p}-direction`}
          className="input"
          value={line.direction}
          placeholder={line.mode === "subway" ? derived || "Manhattan-bound" : "e.g. Southbound"}
          disabled={disabled}
          aria-invalid={err("direction") ? true : undefined}
          aria-describedby={describe("direction")}
          onChange={(e) => onChange({ direction: e.target.value })}
        />
        <FieldError id={`${p}-direction-error`} message={err("direction")} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${p}-walkMin`}>
          Walk time in minutes
        </label>
        <div className="stepper">
          <button
            type="button"
            className="step"
            aria-label="Decrease walk time"
            disabled={disabled}
            onClick={() => step(-1)}
          >
            −
          </button>
          <input
            id={`${p}-walkMin`}
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            step={1}
            value={line.walkMin}
            disabled={disabled}
            aria-invalid={err("walkMin") ? true : undefined}
            aria-describedby={describe("walkMin")}
            onChange={(e) => onChange({ walkMin: e.target.value })}
          />
          <button
            type="button"
            className="step"
            aria-label="Increase walk time"
            disabled={disabled}
            onClick={() => step(1)}
          >
            +
          </button>
        </div>
        <FieldError id={`${p}-walkMin-error`} message={err("walkMin")} />
      </div>

      <Segmented
        legend="Show"
        name={`${p}-unit`}
        value={line.unit}
        disabled={disabled}
        options={[
          { value: "leave", label: "Min to leave" },
          { value: "stops", label: "Stops away" },
        ]}
        onChange={(unit) => onChange({ unit })}
      />
    </section>
  );
}

/* ───────────── page ───────────── */

type Status =
  | { kind: "idle" }
  | { kind: "busy"; what: "preview" | "save" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export default function SettingsPage() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageConfigured, setStorageConfigured] = useState<boolean | null>(null);
  const [lines, setLines] = useState<FormLine[]>([]);
  const [count, setCount] = useState(1);
  const [savedJson, setSavedJson] = useState("");

  const [passcode, setPasscode] = useState<string | null>(null);
  const [passcodeReady, setPasscodeReady] = useState(false);
  const [passcodeDraft, setPasscodeDraft] = useState("");
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [preview, setPreview] = useState<DepartureRow[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { lines: LineConfig[]; storageConfigured: boolean };
      const form = json.lines.map(toForm);
      setLines(form.length > 1 ? form : [...form, { ...NEW_LINE }]);
      setCount(form.length);
      setSavedJson(JSON.stringify(form));
      setStorageConfigured(json.storageConfigured);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Request failed");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read device-local passcode after mount
    setPasscode(readStoredPasscode());
    setPasscodeReady(true);
    load();
  }, [load]);

  const active = useMemo(() => lines.slice(0, count), [lines, count]);
  const dirty = savedJson !== "" && JSON.stringify(active) !== savedJson;
  const validation = useMemo(() => validateSettings(toInput(active)), [active]);
  const clientErrors = validation.ok ? {} : validation.fieldErrors;

  // Show a field's error once it's been edited, or for every field after a submit attempt.
  const visibleErrors: FieldErrors = { ...serverErrors };
  for (const [key, msg] of Object.entries(clientErrors)) {
    if (showAllErrors || touched.has(key)) visibleErrors[key] = msg;
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const readOnly = storageConfigured === false;

  const updateLine = (i: number, patch: Partial<FormLine>) => {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    setTouched((t) => {
      const next = new Set(t);
      for (const k of Object.keys(patch)) next.add(`lines.${i}.${k}`);
      if ("mode" in patch) next.delete(`lines.${i}.route`); // fresh pick, don't nag yet
      return next;
    });
    setServerErrors({});
    if (status.kind !== "busy") setStatus({ kind: "idle" });
  };

  /** Shared by Preview, Save and the passcode check. Returns null on 401. */
  const send = async (
    method: "POST" | "PUT",
    url: string,
    code: string,
  ): Promise<{ status: number; json: Record<string, unknown> } | null> => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", [PASSCODE_HEADER]: code },
      body: JSON.stringify(toInput(active)),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      storePasscode(null);
      setPasscode(null);
      setPasscodeError(typeof json.error === "string" ? json.error : "Wrong passcode");
      return null;
    }
    return { status: res.status, json };
  };

  const handleResult = (r: { status: number; json: Record<string, unknown> }) => {
    if (r.status === 400 && r.json.fieldErrors) {
      setServerErrors(r.json.fieldErrors as FieldErrors);
      setStatus({ kind: "error", message: "Fix the highlighted fields." });
      return false;
    }
    if (r.status >= 400) {
      setStatus({ kind: "error", message: String(r.json.error ?? `Request failed (HTTP ${r.status})`) });
      return false;
    }
    return true;
  };

  const submitPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = passcodeDraft;
    if (!code) return setPasscodeError("Enter the passcode");
    setChecking(true);
    setPasscodeError(null);
    try {
      // Preview doubles as the passcode check: anything but 401 means it's right.
      const r = await send("POST", "/api/settings/preview", code);
      if (!r) return;
      storePasscode(code);
      setPasscode(code);
      setPasscodeDraft("");
      if (r.status === 200) setPreview(r.json.rows as DepartureRow[]);
    } catch {
      setPasscodeError("Couldn't reach the server. Try again.");
    } finally {
      setChecking(false);
    }
  };

  const runPreview = async () => {
    if (!passcode) return;
    setShowAllErrors(true);
    if (!validation.ok) return setStatus({ kind: "error", message: "Fix the highlighted fields." });
    setStatus({ kind: "busy", what: "preview" });
    try {
      const r = await send("POST", "/api/settings/preview", passcode);
      if (!r) return setStatus({ kind: "idle" });
      if (handleResult(r)) {
        setPreview(r.json.rows as DepartureRow[]);
        setStatus({ kind: "idle" });
      }
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  };

  const save = async () => {
    if (!passcode) return;
    setShowAllErrors(true);
    if (!validation.ok) return;
    setStatus({ kind: "busy", what: "save" });
    try {
      const r = await send("PUT", "/api/settings", passcode);
      if (!r) return setStatus({ kind: "idle" });
      if (handleResult(r)) {
        const saved = (r.json.lines as LineConfig[]).map(toForm);
        setLines((ls) => [...saved, ...ls.slice(saved.length)]);
        setSavedJson(JSON.stringify(saved));
        setStatus({ kind: "saved" });
      }
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  };

  const forget = () => {
    storePasscode(null);
    setPasscode(null);
    setPasscodeError(null);
  };

  const leave = (e: React.MouseEvent) => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) e.preventDefault();
  };

  /* ───── render ───── */

  const header = (
    <header className="settings-header">
      <h1>Settings</h1>
      <Link href="/" className="text-link" onClick={leave}>
        ← Display
      </Link>
    </header>
  );

  if (loadError) {
    return (
      <main className="page settings">
        {header}
        <p className="banner error" role="alert">
          Couldn&apos;t load settings: {loadError}
        </p>
      </main>
    );
  }

  if (storageConfigured === null || !passcodeReady) {
    return (
      <main className="page settings">
        {header}
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!readOnly && !passcode) {
    return (
      <main className="page settings">
        {header}
        <form className="panel form-card" onSubmit={submitPasscode} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="passcode">
              Passcode
            </label>
            <input
              id="passcode"
              className="input"
              type="password"
              autoComplete="current-password"
              value={passcodeDraft}
              aria-invalid={passcodeError ? true : undefined}
              aria-describedby={passcodeError ? "passcode-error" : "passcode-help"}
              onChange={(e) => setPasscodeDraft(e.target.value)}
            />
            <p className="field-help" id="passcode-help">
              Saved on this device so you only enter it once.
            </p>
            {passcodeError && (
              <p className="field-error" id="passcode-error" role="alert">
                {passcodeError}
              </p>
            )}
          </div>
          <button type="submit" className="btn primary" disabled={checking}>
            {checking ? "Checking…" : "Continue"}
          </button>
        </form>
      </main>
    );
  }

  const busy = status.kind === "busy";

  return (
    <main className="page settings">
      {header}

      {readOnly ? (
        <p className="banner" role="status">
          Storage not configured. Showing settings from config/lines.json (read-only).
        </p>
      ) : (
        <p className="device-note">
          Passcode saved on this device.{" "}
          <button type="button" className="text-link" onClick={forget}>
            Forget passcode
          </button>
        </p>
      )}

      <form
        className="settings-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="panel form-card">
          <Segmented
            legend="Lines"
            name="count"
            value={String(count) as "1" | "2"}
            disabled={readOnly}
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
            ]}
            onChange={(v) => {
              setCount(Number(v));
              setLines((ls) => (ls.length < 2 ? [...ls, { ...NEW_LINE }] : ls));
              setServerErrors({});
            }}
          />
        </div>

        <div className="grid">
          {active.map((line, i) => (
            <LineCard
              key={i}
              index={i}
              line={line}
              errors={visibleErrors}
              disabled={readOnly}
              onChange={(patch) => updateLine(i, patch)}
            />
          ))}
        </div>

        {visibleErrors[""] && <p className="field-error">{visibleErrors[""]}</p>}

        {!readOnly && (
          <div className="actions">
            <button type="button" className="btn" disabled={busy} onClick={runPreview}>
              {status.kind === "busy" && status.what === "preview" ? "Loading preview…" : "Preview"}
            </button>
            <button type="submit" className="btn primary" disabled={busy || !validation.ok}>
              {status.kind === "busy" && status.what === "save" ? "Saving…" : "Save"}
            </button>
          </div>
        )}

        <div aria-live="polite">
          {status.kind === "saved" && (
            <p className="banner success">
              Saved. Every display picks this up within 30 seconds.{" "}
              <Link href="/" className="text-link">
                Back to display
              </Link>
            </p>
          )}
          {status.kind === "error" && <p className="banner error">{status.message}</p>}
          {!readOnly && dirty && status.kind !== "saved" && (
            <p className="muted small">You have unsaved changes.</p>
          )}
        </div>
      </form>

      {preview && (
        <section aria-labelledby="preview-title" className="preview">
          <h2 className="label" id="preview-title">
            Preview{preview.some((r) => r.mock) ? " · mock data" : ""}
          </h2>
          <div className="grid">
            {preview.map((row, i) => (
              <DeparturePanel key={i} row={row} />
            ))}
          </div>
          {preview.some((r) => r.error) && (
            <p className="muted small">
              A line showing &ldquo;No data&rdquo; usually means the stop ID or route is wrong, or nothing is
              running there right now.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
