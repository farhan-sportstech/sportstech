"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Icon from "./NavIcon";
import sel from "./Select.module.css";
import st from "./MultiSelect.module.css";
import { cx } from "@/lib/cx";

type Opt = { value: string; label: string };

/** Checkbox dropdown: pick any number of options. Same fixed positioning and keyboard model as Select,
 *  except Enter/Space toggles the active option and the list stays open until Escape or a click away. */
export default function MultiSelect({ label, options, value, onChange, presets }: { label: string; options: Opt[]; value: string[]; onChange: (v: string[]) => void; presets?: { label: string; value: string[] }[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();

  const chosen = options.filter((o) => value.includes(o.value));
  const summary = chosen.length === 0 ? "None" : chosen.length === options.length ? "All" : chosen.length <= 2 ? chosen.map((o) => o.label).join(", ") : `${chosen.length} selected`;

  const show = () => {
    const r = btn.current!.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
    setActive(0);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };
  // keep the option order stable whatever order they were ticked in
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : options.map((o) => o.value).filter((x) => x === v || value.includes(x)));

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    const away = (e: Event) => {
      const t = e.target as Node;
      if (wrap.current?.contains(t) || (e.type === "pointerdown" && btn.current?.contains(t))) return;
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

  const onKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (e.key === "ArrowDown" ? Math.min(last, a + 1) : Math.max(0, a - 1)));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : last);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(options[active].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={cx(sel.sel, st.msel)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${label}: ${summary}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            show();
          }
        }}
      >
        <span className={st["msel-l"]}>{label}</span>
        <span className={st["msel-v"]}>{summary}</span>
        <Icon name="chev" className="ic" />
      </button>
      {open ? (
        <div ref={wrap} className={cx(sel["sel-list"], st["msel-list"])} style={{ top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 220) }}>
          <div ref={list} id={id} role="listbox" aria-multiselectable="true" aria-label={label} tabIndex={-1} aria-activedescendant={`${id}-${active}`} onKeyDown={onKey}>
            {options.map((o, i) => {
              const on = value.includes(o.value);
              return (
                <div key={o.value} id={`${id}-${i}`} role="option" aria-selected={on} className={cx(st.mopt, i === active && st.on)} onPointerMove={() => setActive(i)} onClick={() => toggle(o.value)}>
                  <span className={st.box} aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  {o.label}
                </div>
              );
            })}
          </div>
          {presets?.length ? (
            <div className={st["msel-ft"]}>
              {presets.map((p) => (
                <button key={p.label} type="button" onClick={() => onChange(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
