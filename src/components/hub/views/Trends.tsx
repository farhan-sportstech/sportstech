"use client";

import { useState, type CSSProperties } from "react";
import { trendWeeks, type TrendWeek } from "@/lib/hub";
import { DAYS, acosD, addDay, cpcD, ctrD, cvrD, roasD, zeroDay, type Day } from "@/lib/account";
import { eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { cx } from "@/lib/cx";
import Info from "../../Info";
import Segmented from "../../Segmented";
import { View } from "../HubTable";
import st from "../hub.module.css";

type B = { label: string; sub: string; sp: Day; sb: Day; sd: Day; all: Day };
type RowDef = { label: string; get: (b: B) => number | null; fmt: (v: number) => string; heat: "up" | "down" | "none"; sep?: boolean };
const ROWS: RowDef[] = [
  { label: "Impressions", get: (b) => b.all.impr, fmt: (v) => int.format(v), heat: "up" },
  { label: "Clicks", get: (b) => b.all.clicks, fmt: (v) => int.format(v), heat: "up" },
  { label: "PPC orders", get: (b) => b.all.orders, fmt: (v) => int.format(v), heat: "up" },
  { label: "PPC cost", get: (b) => b.all.spend, fmt: (v) => eur.format(v), heat: "none" },
  { label: "PPC sales", get: (b) => b.all.sales, fmt: (v) => eur.format(v), heat: "up" },
  { label: "ACOS", get: (b) => acosD(b.all), fmt: (v) => `${pct1.format(v)}%`, heat: "down", sep: true },
  { label: "ROAS", get: (b) => roasD(b.all), fmt: (v) => pct2.format(v), heat: "up" },
  { label: "CTR", get: (b) => ctrD(b.all), fmt: (v) => `${pct2.format(v)}%`, heat: "up" },
  { label: "CPC", get: (b) => cpcD(b.all), fmt: (v) => eur2.format(v), heat: "down" },
  { label: "Conversion", get: (b) => cvrD(b.all), fmt: (v) => `${pct1.format(v)}%`, heat: "up" },
  { label: "Cost per order", get: (b) => (b.all.orders ? b.all.spend / b.all.orders : null), fmt: (v) => eur2.format(v), heat: "down" },
  { label: "SP cost", get: (b) => b.sp.spend, fmt: (v) => eur.format(v), heat: "none", sep: true },
  { label: "SB cost", get: (b) => b.sb.spend, fmt: (v) => eur.format(v), heat: "none" },
  { label: "SD cost", get: (b) => b.sd.spend, fmt: (v) => eur.format(v), heat: "none" },
  { label: "SP sales", get: (b) => b.sp.sales, fmt: (v) => eur.format(v), heat: "up", sep: true },
  { label: "SB sales", get: (b) => b.sb.sales, fmt: (v) => eur.format(v), heat: "up" },
  { label: "SD sales", get: (b) => b.sd.sales, fmt: (v) => eur.format(v), heat: "up" },
];
const SIZES = [
  { value: "1", label: "Weekly" },
  { value: "2", label: "2 weeks" },
  { value: "4", label: "4 weeks" },
];

const merge = (ws: TrendWeek[]): B => {
  const sp = ws.reduce((a, w) => addDay(a, w.sp), zeroDay());
  const sb = ws.reduce((a, w) => addDay(a, w.sb), zeroDay());
  const sd = ws.reduce((a, w) => addDay(a, w.sd), zeroDay());
  const first = ws[0];
  const last = ws[ws.length - 1];
  return { label: ws.length === 1 ? first.label : `${first.label}–${last.label.replace("KW ", "")}`, sub: ws.length === 1 ? first.sub : `${first.sub.split("–")[0]}–${last.sub.split("–").pop()}`, sp, sb, sd, all: addDay(addDay(sp, sb), sd) };
};

export default function Trends() {
  const [size, setSize] = useState("1");
  const n = Number(size);
  // whole buckets only: the oldest leftover weeks drop off
  const keep = Math.floor(trendWeeks.length / n) * n;
  const weeks = trendWeeks.slice(trendWeeks.length - keep);
  const buckets = Array.from({ length: keep / n }, (_, i) => merge(weeks.slice(i * n, i * n + n)));
  const summary = merge(weeks);

  const tint = (r: RowDef, v: number | null) => {
    if (r.heat === "none" || v === null) return undefined;
    const vs = buckets.map(r.get).filter((x): x is number => x !== null);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    if (hi <= lo) return undefined;
    const t = (v - lo) / (hi - lo);
    const good = r.heat === "up" ? t : 1 - t;
    // good end green, bad end red, the middle stays clear
    const tone = good >= 0.5 ? "var(--good)" : "var(--bad)";
    return { "--heat": tone, "--ha": `${Math.round(Math.abs(good - 0.5) * 2 * 16)}%` } as CSSProperties;
  };

  const exportCsv = () =>
    downloadCsv(`trends-${DAYS[0].iso}.csv`, [
      ["Metric", ...buckets.map((b) => `${b.label} (${b.sub})`), "Summary"],
      ...ROWS.map((r) => [r.label, ...[...buckets, summary].map((b) => {
        const v = r.get(b);
        return v === null ? "" : Math.round(v * 100) / 100;
      })]),
    ]);

  return (
    <View>
      <section className="panel flush" aria-label="Trends">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 className="ph">13 weeks, SP + SB + SD</h2>
            <Info label="Trends">
              <p>Weekly PPC totals across Sponsored Products, Brands and Display (14-day attribution), oldest on the left. Wider buckets add weeks together and recompute the rates; leftover old weeks that don&apos;t fill a bucket are dropped.</p>
              <p>Shading compares the buckets within a row: green is the better end, red the worse. Cost rows aren&apos;t shaded.</p>
            </Info>
          </div>
          <p className="tot">
            {weeks[0].label} – {weeks[weeks.length - 1].label}
          </p>
        </div>
        <div className={st.tbar}>
          <div className="filters">
            <Segmented label="Columns" size="sm" value={size} onChange={setSize} options={SIZES} />
          </div>
          <div className="filters">
            <button type="button" className="btn sm" onClick={exportCsv}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
              </svg>
              CSV
            </button>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {buckets.map((b) => (
                  <th key={b.label} scope="col" className="n">
                    {b.label}
                    <small>{b.sub}</small>
                  </th>
                ))}
                <th scope="col" className={cx("n", "cur")}>
                  Summary
                  <small>{keep} weeks</small>
                </th>
              </tr>
            </thead>
            <tbody key={size} className={st.rows}>
              {ROWS.map((r, i) => (
                <tr key={r.label} style={{ "--i": i, ...(r.sep ? { borderTop: "1px solid var(--line-strong)" } : {}) } as CSSProperties}>
                  <th scope="row">{r.label}</th>
                  {buckets.map((b) => {
                    const v = r.get(b);
                    return (
                      <td key={b.label} className={cx("n", st.heat)} style={tint(r, v)}>
                        {v === null ? <span className="na">—</span> : r.fmt(v)}
                      </td>
                    );
                  })}
                  <td className="n strong cur">{(() => {
                    const v = r.get(summary);
                    return v === null ? "—" : r.fmt(v);
                  })()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </View>
  );
}
