"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import st from "./Segmented.module.css";
import { cx } from "@/lib/cx";

/** Toggle group whose thumb slides to the pressed option. The thumb is measured, so labels of any width work. */
export default function Segmented<T extends string>({ options, value, onChange, label, size }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; size?: "sm" }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const place = () => {
      const on = root.querySelector<HTMLElement>('button[aria-pressed="true"]');
      if (!on) return;
      root.style.setProperty("--x", `${on.offsetLeft}px`);
      root.style.setProperty("--w", `${on.offsetWidth}px`);
    };
    place();
    // web fonts swap in after first paint and change label widths
    const ro = new ResizeObserver(place);
    ro.observe(root);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div ref={ref} className={cx(st.seg, size && st[size])} role="group" aria-label={label} style={{ "--x": "3px", "--w": "0px" } as CSSProperties}>
      <span className={st.thumb} aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
