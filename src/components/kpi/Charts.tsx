"use client";

import { cx } from "@/lib/cx";
import type { KpiRow } from "@/lib/kpi";
import st from "./Charts.module.css";

export type Series = { key: string; label: string; hue: string; get: (r: KpiRow) => number };

const W = 900;
const L = 64;
const R = 12;
const T = 12;
const B = 26;

/** One stacked bar per period, oldest on the left. Click a bar to focus that period everywhere on the page.
 *  `percent` stacks each bar to 100% (a mix rather than totals). */
export function StackBars({ rows, series, focus, onFocus, fmt, percent = false, label, H = 230 }: { rows: KpiRow[]; series: Series[]; focus: number; onFocus: (i: number) => void; fmt: (v: number) => string; percent?: boolean; label: string; H?: number }) {
  const n = rows.length;
  const ordered = rows.map((row, i) => ({ row, i })).reverse();
  const totals = ordered.map(({ row }) => series.reduce((a, s) => a + s.get(row), 0));
  const max = percent ? 100 : Math.max(...totals, 1) * 1.08;
  const slot = (W - L - R) / n;
  const bw = Math.max(6, slot * 0.68);
  const Y = (v: number) => T + (H - T - B) * (1 - v / max);
  const every = n > 14 ? 2 : 1;

  return (
    <svg className={st.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 1, 2, 3].map((j) => {
        const v = (max * j) / 3;
        return (
          <g key={j}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className={st.grid} />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end" className={st.axis}>
              {percent ? `${Math.round(v)}%` : fmt(v)}
            </text>
          </g>
        );
      })}
      {ordered.map(({ row, i }, k) => {
        const x = L + k * slot + (slot - bw) / 2;
        let acc = 0;
        const tot = totals[k] || 1;
        return (
          <g key={row.key} className={cx(st.bar, i === focus && st.on)} style={{ animationDelay: `${k * 18}ms` }} onClick={() => onFocus(i)}>
            <title>{`${row.label} · ${row.sub}\n${series.map((s) => `${s.label}: ${percent ? `${Math.round((s.get(row) / tot) * 100)}%` : fmt(s.get(row))}`).join("\n")}`}</title>
            <rect x={L + k * slot} y={T} width={slot} height={H - T - B} className={st.hit} />
            {series.map((s) => {
              const v = percent ? (s.get(row) / tot) * 100 : s.get(row);
              const y0 = Y(acc);
              acc += v;
              const y1 = Y(acc);
              return <rect key={s.key} x={x} y={y1} width={bw} height={Math.max(0, y0 - y1)} rx={2} style={{ fill: s.hue }} />;
            })}
            {k % every === (n - 1) % every || i === focus ? (
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" className={cx(st.axis, i === focus && st.axisOn)}>
                {row.label.replace("KW ", "")}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** One metric as a line across all periods, oldest on the left, with the focused period marked. */
export function Trend({ rows, get, fmt, focus, onFocus, label, H = 210 }: { rows: KpiRow[]; get: (r: KpiRow) => number | null; fmt: (v: number) => string; focus: number; onFocus: (i: number) => void; label: string; H?: number }) {
  const n = rows.length;
  const pts = rows.map((row, i) => ({ row, i, v: get(row) })).reverse();
  const vals = pts.map((p) => p.v).filter((v): v is number => v !== null);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || hi * 0.1 || 1;
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const X = (k: number) => L + ((W - L - R) * k) / Math.max(1, n - 1);
  const Y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
  const d = pts.reduce((acc, p, k) => (p.v === null ? acc : `${acc}${acc ? "L" : "M"}${X(k).toFixed(1)} ${Y(p.v).toFixed(1)}`), "");
  const fk = n - 1 - focus;
  const every = n > 14 ? 2 : 1;

  return (
    <svg className={st.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 1, 2, 3].map((j) => {
        const v = min + ((max - min) * j) / 3;
        return (
          <g key={j}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className={st.grid} />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end" className={st.axis}>
              {fmt(v)}
            </text>
          </g>
        );
      })}
      <line x1={X(fk)} x2={X(fk)} y1={T} y2={H - B} className={st.sel} />
      <path key={label} d={d} pathLength={1} className={st.line} />
      {pts.map((p, k) =>
        p.v === null ? null : (
          <circle key={p.row.key} cx={X(k)} cy={Y(p.v)} r={p.i === focus ? 5 : 3} className={cx(st.dot, p.i === focus && st.dotOn)}>
            <title>{`${p.row.label} · ${p.row.sub}: ${fmt(p.v)}`}</title>
          </circle>
        ),
      )}
      {pts.map((p, k) =>
        k % every === (n - 1) % every || p.i === focus ? (
          <text key={p.row.key} x={X(k)} y={H - 8} textAnchor="middle" className={cx(st.axis, p.i === focus && st.axisOn)}>
            {p.row.label.replace("KW ", "")}
          </text>
        ) : null,
      )}
      {pts.map((p, k) => {
        const half = (W - L - R) / Math.max(1, n - 1) / 2;
        return <rect key={p.row.key} x={X(k) - half} y={T} width={half * 2} height={H - T - B} className={st.hit} onClick={() => onFocus(p.i)} />;
      })}
    </svg>
  );
}
