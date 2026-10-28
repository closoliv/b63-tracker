"use client";

import { useEffect, useId, useRef, useState } from "react";
import { routeColor } from "@/lib/colors";
import { RouteBullet } from "./DeparturePanel";

/**
 * Dropdown of subway routes, each shown with its colored bullet.
 * The caller renders `<label id={`${id}-label`} htmlFor={id}>`.
 */
export function RoutePicker({
  id,
  routes,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  id: string;
  routes: string[];
  value: string;
  onChange: (route: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    listRef.current?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const openList = () => {
    setActive(Math.max(0, routes.indexOf(value)));
    setOpen(true);
  };
  const choose = (route: string) => {
    onChange(route);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(routes.length - 1, a + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(routes.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(routes[active]);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") buttonRef.current?.focus();
    }
  };

  return (
    <div className="picker" ref={rootRef}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className={`input picker-button${invalid ? " invalid" : ""}`}
        aria-labelledby={`${id}-label ${id}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
          }
        }}
      >
        {value && routes.includes(value) ? (
          <>
            <RouteBullet mode="subway" route={value} color={routeColor("subway", value)} size="small" />
            <span>{value} train</span>
          </>
        ) : (
          <span className="muted">Choose a route</span>
        )}
        <span className="chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${listId}-${routes[active]}`}
          className="picker-list"
          onKeyDown={onListKey}
        >
          {routes.map((r, i) => (
            <li
              key={r}
              id={`${listId}-${r}`}
              role="option"
              aria-selected={r === value}
              className={`picker-option${i === active ? " active" : ""}`}
              onClick={() => choose(r)}
              onPointerMove={() => setActive(i)}
            >
              <RouteBullet mode="subway" route={r} color={routeColor("subway", r)} size="small" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
