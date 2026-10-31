"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Icon from "./NavIcon";
import st from "./Select.module.css";
import { cx } from "@/lib/cx";

/** Listbox dropdown styled to the console. The list is position: fixed, so table panels with
 *  overflow: hidden never clip it; scrolling or resizing the page closes it. */
export default function Select({ value, options, onChange, label, size }: { value: string; options: string[]; onChange: (v: string) => void; label: string; size?: "sm" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, up: false });
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  const show = () => {
    const r = btn.current!.getBoundingClientRect();
    const up = innerHeight - r.bottom < 300 && r.top > 300;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: r.width, up });
    setActive(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };
  const pick = (i: number) => {
    onChange(options[i]);
    close();
  };

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    const away = (e: Event) => {
      const t = e.target as Node;
      if (list.current?.contains(t) || (e.type === "pointerdown" && btn.current?.contains(t))) return;
      setOpen(false);
    };
    addEventListener("pointerdown", away);
    addEventListener("scroll", away, true);
    addEventListener("resize", away);
    return () => {
      removeEventListener("pointerdown", away);
      removeEventListener("scroll", away, true);
      removeEventListener("resize", away);
    };
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onListKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    const moves: Record<string, () => number> = {
      ArrowDown: () => Math.min(last, active + 1),
      ArrowUp: () => Math.max(0, active - 1),
      Home: () => 0,
      End: () => last,
    };
    if (moves[e.key]) {
      e.preventDefault();
      setActive(moves[e.key]());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    } else if (e.key.length === 1) {
      // type-ahead: jump to the next option starting with that letter
      const k = e.key.toLowerCase();
      const hit = options.findIndex((o, i) => i > active && o.toLowerCase().startsWith(k));
      const wrap = options.findIndex((o) => o.toLowerCase().startsWith(k));
      if (hit >= 0 || wrap >= 0) setActive(hit >= 0 ? hit : wrap);
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={cx(st.sel, size && st[size])}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${label}: ${value}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      >
        <span>{value}</span>
        <Icon name="chev" className="ic" />
      </button>
      {open ? (
        <ul
          ref={list}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          className={st["sel-list"]}
          data-up={pos.up || undefined}
          style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li key={o} id={`${id}-${i}`} data-i={i} role="option" aria-selected={o === value} className={i === active ? st.on : undefined} onPointerMove={() => setActive(i)} onClick={() => pick(i)}>
              <span>{o}</span>
              {o === value ? (
                <svg className={st.tick} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
