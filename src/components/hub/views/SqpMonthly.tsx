"use client";

import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { SQP_WEEKS, sqpQueries, type SqpCell } from "@/lib/hub";
import { int, pct1 } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { cx } from "@/lib/cx";
import Delta from "../../Delta";
import Info from "../../Info";
import Segmented from "../../Segmented";
import Select from "../../Select";
import Switch from "../../Switch";
import { View } from "../HubTable";
import st from "../hub.module.css";
import sq from "./SqpMonthly.module.css";

/* ---------- SQP metrics, shared with the weekly view ---------- */
export type SqpMetric = { label: string; get: (c: SqpCell) => number | null; rate: boolean };
const r = (a: number, b: number) => (b ? (a / b) * 100 : null);
export const SQP_METRICS: SqpMetric[] = [
  { label: "Search volume", get: (c) => c.vol, rate: false },
  { label: "Our impressions", get: (c) => c.oImpr, rate: false },
  { label: "Our clicks", get: (c) => c.oClicks, rate: false },
  { label: "Our purchases", get: (c) => c.oPurch, rate: false },
  { label: "Market clicks", get: (c) => c.clicks, rate: false },
  { label: "Market purchases", get: (c) => c.purch, rate: false },
  { label: "Impression share %", get: (c) => r(c.oImpr, c.impr), rate: true },
  { label: "Click share %", get: (c) => r(c.oClicks, c.clicks), rate: true },
  { label: "Purchase share %", get: (c) => r(c.oPurch, c.purch), rate: true },
  { label: "Our CTR %", get: (c) => r(c.oClicks, c.oImpr), rate: true },
  { label: "Market CTR %", get: (c) => r(c.clicks, c.impr), rate: true },
  { label: "Our CVR %", get: (c) => r(c.oPurch, c.oClicks), rate: true },
  { label: "Market CVR %", get: (c) => r(c.purch, c.clicks), rate: true },
];
export const zeroCell = (): SqpCell => ({ vol: 0, impr: 0, oImpr: 0, clicks: 0, oClicks: 0, purch: 0, oPurch: 0 });
export const addCell = (a: SqpCell, b: SqpCell): SqpCell => ({ vol: a.vol + b.vol, impr: a.impr + b.impr, oImpr: a.oImpr + b.oImpr, clicks: a.clicks + b.clicks, oClicks: a.oClicks + b.oClicks, purch: a.purch + b.purch, oPurch: a.oPurch + b.oPurch });
export const fmtSqp = (m: SqpMetric, v: number | null) => (v === null ? "—" : m.rate ? `${pct1.format(v)}%` : int.format(Math.round(v)));

/* ---------- starred queries live in this browser ---------- */
const FAV = "hub:smfav";
const EVT = "hub:smfav";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
};
const readFav = () => {
  try {
    return localStorage.getItem(FAV);
  } catch {
    return null;
  }
};
const writeFav = (qs: string[]) => {
  try {
    localStorage.setItem(FAV, JSON.stringify(qs));
  } catch {
    // storage blocked: stars last until reload
  }
  window.dispatchEvent(new Event(EVT));
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = Array.from(new Set(SQP_WEEKS.map((w) => w.month))).map((m) => ({ key: m, label: `${MONTH_NAMES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`, idx: SQP_WEEKS.map((w, i) => (w.month === m ? i : -1)).filter((i) => i >= 0) }));
const ROWS_OPTS = ["Search query", "Account total"];
const RANGE = ["Latest 6 months", "All months"];

type Line = { q: string; cat: string; weeks: number; cells: SqpCell[]; total: SqpCell };

export default function SqpMonthly() {
  const [rowsBy, setRowsBy] = useState(ROWS_OPTS[0]);
  const [metric, setMetric] = useState("Search volume");
  const [range, setRange] = useState(RANGE[0]);
  const [how, setHow] = useState("values");
  const [heat, setHeat] = useState(true);
  const [q, setQ] = useState("");
  const raw = useSyncExternalStore(subscribe, readFav, () => null);
  const favs = useMemo<string[]>(() => {
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [raw]);

  const m = SQP_METRICS.find((x) => x.label === metric)!;
  const months = useMemo(() => (range === RANGE[0] ? MONTHS.slice(-6) : MONTHS), [range]);

  const lines = useMemo<Line[]>(() => {
    const per = (weeks: SqpCell[]) => months.map((mo) => mo.idx.reduce((a, i) => addCell(a, weeks[i]), zeroCell()));
    if (rowsBy === "Account total") {
      const all = SQP_WEEKS.map((_, i) => sqpQueries.reduce((a, x) => addCell(a, x.weeks[i]), zeroCell()));
      const cells = per(all);
      return [{ q: "Account total", cat: `${sqpQueries.length} queries`, weeks: SQP_WEEKS.length, cells, total: cells.reduce(addCell, zeroCell()) }];
    }
    const needle = q.trim().toLowerCase();
    return sqpQueries
      .filter((x) => !needle || x.q.includes(needle))
      .map((x) => {
        const cells = per(x.weeks);
        return { q: x.q, cat: x.cat, weeks: x.weeks.filter((w) => w.vol > 0).length, cells, total: cells.reduce(addCell, zeroCell()) };
      })
      .sort((a, b) => Number(favs.includes(b.q)) - Number(favs.includes(a.q)) || (m.get(b.total) ?? -1) - (m.get(a.total) ?? -1))
      .slice(0, 300);
  }, [rowsBy, months, q, favs, m]);

  // a month's value, or its change on the month before (% for counts, points for rates)
  const cellVal = (l: Line, i: number) => {
    const v = m.get(l.cells[i]);
    if (how === "values") return v;
    if (i === 0) return null;
    const p = m.get(l.cells[i - 1]);
    if (v === null || p === null) return null;
    return m.rate ? v - p : p ? ((v - p) / p) * 100 : null;
  };
  const tint = (l: Line, v: number | null) => {
    if (!heat || v === null) return undefined;
    const vs = l.cells.map((_, i) => cellVal(l, i)).filter((x): x is number => x !== null);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    if (hi <= lo) return undefined;
    if (how === "mom") return { "--heat": v >= 0 ? "var(--good)" : "var(--bad)", "--ha": `${Math.round(Math.min(1, Math.abs(v) / Math.max(Math.abs(lo), Math.abs(hi))) * 16)}%` } as CSSProperties;
    return { "--heat": "var(--accent)", "--ha": `${Math.round(((v - lo) / (hi - lo)) * 18)}%` } as CSSProperties;
  };
  const toggleFav = (query: string) => writeFav(favs.includes(query) ? favs.filter((x) => x !== query) : [...favs, query]);

  const exportCsv = () =>
    downloadCsv(`sqp-monthly-${months[months.length - 1].key}.csv`, [
      ["Search query", "Weeks in data", ...months.map((mo) => mo.label), "Total"],
      ...lines.map((l) => [l.q, l.weeks, ...l.cells.map((_, i) => {
        const v = cellVal(l, i);
        return v === null ? "" : Math.round(v * 100) / 100;
      }), how === "values" ? Math.round((m.get(l.total) ?? 0) * 100) / 100 : ""]),
    ]);

  return (
    <View>
      <section className="panel flush" aria-label="SQP monthly">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 className="ph">{metric} by month</h2>
            <Info label="SQP monthly">
              <p>Search Query Performance from Brand Analytics, weekly, grouped into months by the week&apos;s end date. Rates are recomputed from the month&apos;s summed counts, not averaged.</p>
              <p>MoM shows the change on the month before: % for counts, points for rates. Star a query to keep it at the top; stars stay in this browser.</p>
            </Info>
          </div>
          <p className="tot">
            <b>{int.format(lines.length)}</b> {rowsBy === "Account total" ? "row" : "queries"} · {months[0].label} – {months[months.length - 1].label}
          </p>
        </div>
        <div className={st.tbar}>
          <div className="filters">
            <Segmented label="Rows" size="sm" value={rowsBy} onChange={setRowsBy} options={ROWS_OPTS.map((v) => ({ value: v, label: v }))} />
            <Select label="Metric" value={metric} options={SQP_METRICS.map((x) => x.label)} onChange={setMetric} />
            <Select label="Months" value={range} options={RANGE} onChange={setRange} />
            <Segmented
              label="How"
              size="sm"
              value={how}
              onChange={setHow}
              options={[
                { value: "values", label: "Values" },
                { value: "mom", label: "MoM" },
              ]}
            />
            {rowsBy === "Search query" ? <input type="search" className={st.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a query" aria-label="Find a query" /> : null}
          </div>
          <div className="filters">
            <Switch checked={heat} onChange={setHeat}>
              Heatmap
            </Switch>
            <button type="button" className="btn sm" onClick={exportCsv}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
              </svg>
              CSV
            </button>
          </div>
        </div>
        <div className="tscroll tall">
          <table>
            <thead>
              <tr>
                {rowsBy === "Search query" ? (
                  <th scope="col" className={sq.star} aria-label="Star" />
                ) : null}
                <th scope="col">Search query</th>
                <th scope="col" className="n">
                  Weeks
                </th>
                {months.map((mo) => (
                  <th key={mo.key} scope="col" className="n">
                    {mo.label}
                    <small>{mo.idx.length} weeks</small>
                  </th>
                ))}
                <th scope="col" className="n cur">
                  Total
                </th>
              </tr>
            </thead>
            <tbody key={`${rowsBy}${metric}${range}${how}`} className={st.rows}>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={months.length + 4} className="empty">
                    No query matches.
                  </td>
                </tr>
              ) : null}
              {lines.map((l, li) => {
                const fav = favs.includes(l.q);
                return (
                  <tr key={l.q} style={{ "--i": li } as CSSProperties}>
                    {rowsBy === "Search query" ? (
                      <td className={sq.star}>
                        <button type="button" className={cx(sq.starBtn, fav && sq.on)} aria-pressed={fav} aria-label={fav ? `Unstar ${l.q}` : `Star ${l.q}`} onClick={() => toggleFav(l.q)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
                          </svg>
                        </button>
                      </td>
                    ) : null}
                    <th scope="row" className={st.name}>
                      {l.q}
                      <small>{l.cat}</small>
                    </th>
                    <td className="n">{l.weeks}</td>
                    {l.cells.map((_, i) => {
                      const v = cellVal(l, i);
                      return (
                        <td key={months[i].key} className={cx("n", st.heat)} style={tint(l, v)}>
                          {v === null ? <span className="na">—</span> : how === "mom" ? <Delta value={v} unit={m.rate ? " pp" : "%"} /> : fmtSqp(m, v)}
                        </td>
                      );
                    })}
                    <td className="n strong cur">{how === "values" ? fmtSqp(m, m.get(l.total)) : <span className="na">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </View>
  );
}
