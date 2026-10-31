"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import st from "./Info.module.css";

/** Section explainer kept out of the way: hover or focus previews it, click pins it open.
 *  The card is position: fixed so panels with overflow: hidden never clip it. */
export default function Info({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState<"hover" | "pinned" | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();

  const place = () => {
    const r = btn.current!.getBoundingClientRect();
    const w = Math.min(420, innerWidth - 24);
    setPos({ top: r.bottom + 8, left: Math.max(12, Math.min(r.left - 16, innerWidth - w - 12)) });
  };
  const show = (how: "hover" | "pinned") => {
    clearTimeout(timer.current);
    place();
    setOpen((o) => (o === "pinned" ? o : how));
  };
  const hideSoon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen((o) => (o === "hover" ? null : o)), 120);
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const t = e.target as Node;
      if (card.current?.contains(t) || btn.current?.contains(t)) return;
      setOpen(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      btn.current?.focus();
    };
    addEventListener("pointerdown", away);
    addEventListener("scroll", away, true);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("pointerdown", away);
      removeEventListener("scroll", away, true);
      removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={st.info}
        aria-label={`About ${label}`}
        aria-expanded={open === "pinned"}
        aria-describedby={open ? id : undefined}
        onClick={() => (open === "pinned" ? setOpen(null) : show("pinned"))}
        onPointerEnter={(e) => e.pointerType === "mouse" && show("hover")}
        onPointerLeave={hideSoon}
        onFocus={() => show("hover")}
        onBlur={hideSoon}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.6v.1" />
        </svg>
      </button>
      {open ? (
        <div ref={card} id={id} role="tooltip" className={st["info-card"]} data-pinned={open === "pinned" || undefined} style={{ top: pos.top, left: pos.left }} onPointerEnter={() => clearTimeout(timer.current)} onPointerLeave={hideSoon}>
          {children}
        </div>
      ) : null}
    </>
  );
}
