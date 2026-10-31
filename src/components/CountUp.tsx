"use client";

import { useLayoutEffect, useRef } from "react";
import { eur, int, pct1 } from "@/lib/format";

const KINDS = {
  eur: (v: number) => eur.format(v),
  int: (v: number) => int.format(Math.round(v)),
  pct: (v: number) => `${pct1.format(v)}%`,
} as const;

export type CountKind = keyof typeof KINDS;

/** Counts from the last shown number (0 on first paint) to `value` with an exponential ease-out.
 *  Writes straight to the text node, so a 60fps count never re-renders React.
 *  Reduced motion keeps the count (it changes text, nothing moves) but shortens it. */
export default function CountUp({ value, kind, duration = 1100 }: { value: number; kind: CountKind; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = KINDS[kind];
    const from = shown.current ?? 0;
    if (from === value) {
      el.textContent = fmt(value);
      return;
    }
    const ms = matchMedia("(prefers-reduced-motion: reduce)").matches ? Math.min(duration, 500) : duration;
    const t0 = performance.now();
    let raf = 0;
    el.textContent = fmt(from);
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      const v = p === 1 ? value : from + (value - from) * e;
      shown.current = v;
      el.textContent = fmt(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, kind, duration]);

  return <span ref={ref}>{KINDS[kind](value)}</span>;
}
