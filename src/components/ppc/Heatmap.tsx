"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { HEAT, HEAT_WINDOW, WEEKDAYS } from "@/lib/heatmap";
import { KPI_CATS } from "@/lib/kpi";
import { eur, int, pct1 } from "@/lib/format";
import { cx } from "@/lib/cx";
import { useReveal } from "@/lib/motion";
import Info from "../Info";
import Segmented from "../Segmented";
import Select from "../Select";
import d from "../dash.module.css";
import st from "./ppc.module.css";
import hs from "./Heatmap.module.css";

const METRICS = [
  { value: "0", label: "Sales €" },
  { value: "1", label: "Units" },
  { value: "2", label: "Order lines" },
];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function Heatmap() {
  const [cat, setCat] = useState("All");
  const [metric, setMetric] = useState("0");
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);

  const m = Number(metric);
  const fmt = (v: number) => (m === 0 ? eur.format(v) : int.format(v));
  const grid = useMemo(() => HEAT[cat].map((row) => row.map((c) => c[m])), [cat, m]);
  const max = Math.max(...grid.flat(), 1);
  const rowSum = grid.map((r) => r.reduce((a, b) => a + b, 0));
  const byHour = Array.from({ length: 24 }, (_, h) => grid.reduce((a, r) => a + r[h], 0));
  const hourMax = Math.max(...byHour, 1);
  const total = rowSum.reduce((a, b) => a + b, 0);

  // what to read off the grid: the busiest slot, the evening share and the best day
  const peak = grid.flatMap((r, di) => r.map((v, h) => ({ v, di, h }))).sort((a, b) => b.v - a.v)[0];
  const evening = byHour.slice(18, 23).reduce((a, b) => a + b, 0);
  const night = byHour.slice(0, 6).reduce((a, b) => a + b, 0);
  const bestDay = rowSum.indexOf(Math.max(...rowSum));
  const orders = HEAT[cat].flat().reduce((a, c) => a + c[2], 0);

  return (
    <div className="wdp" ref={page}>
      <header className={d["pg-head"]}>
        <div className="pg-title">
          <div className={d["pg-h"]}>
            <h1>Sales heatmap</h1>
            <span className={d["pg-kw"]}>
              28 days
              <small>
                {HEAT_WINDOW.from} – {HEAT_WINDOW.to}
              </small>
            </span>
            <Info label="Where the numbers come from">
              <p>{int.format(orders)} order lines from tool4seller, purchase time converted to Berlin time. Category per ASIN uses the same mapping as the KPI page.</p>
              <p>Sales only: hourly ad spend isn&apos;t available, so there is no hourly ACOS. Each weekday appears 4 times in the window, so a single event such as a promo day can dominate a cell.</p>
            </Info>
          </div>
          <p className={d.meta}>Amazon.de · orders by hour × weekday · Europe/Berlin</p>
        </div>
        <div className={d["pg-ctl"]}>
          <Select label="Category" value={cat === "All" ? "All categories" : cat} options={["All categories", ...KPI_CATS]} onChange={(v) => setCat(v === "All categories" ? "All" : v)} />
          <Segmented label="Metric" value={metric} onChange={setMetric} options={METRICS} />
        </div>
      </header>

      <section className="panel" aria-labelledby="hm-h">
        <div className="ph-row between" style={{ padding: 0, marginBottom: 12 }}>
          <h2 id="hm-h" className="ph">
            {cat === "All" ? "All categories" : cat} · hour × weekday
          </h2>
          <p className="tot">
            <b>{fmt(total)}</b> in 28 days
          </p>
        </div>
        <p key={`${cat}${m}`} className={st.peaks}>
          <span>
            Busiest slot <b>{DAY_NAMES[peak.di]} {peak.h}:00</b> ({fmt(peak.v)})
          </span>
          <span>
            Best day <b>{DAY_NAMES[bestDay]}</b> ({pct1.format((rowSum[bestDay] / total) * 100)}%)
          </span>
          <span>
            18:00–23:00 brings <b>{pct1.format((evening / total) * 100)}%</b>
          </span>
          <span>
            Night 0:00–6:00 <b>{pct1.format((night / total) * 100)}%</b>
          </span>
        </p>
        <div className={st.heatWrap}>
          <div className={st.heat} role="table" aria-label={`${METRICS[m].label} by weekday and hour`}>
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className={st.hh}>
                {h}
              </span>
            ))}
            <span className={st.hh} style={{ textAlign: "right" }}>
              Σ
            </span>
            {grid.map((row, di) => (
              <div key={`${cat}${m}${di}`} role="row" style={{ display: "contents" }}>
                <span className={st.dl} role="rowheader">
                  {WEEKDAYS[di]}
                </span>
                {row.map((v, h) => {
                  const a = (v / max) * 90;
                  return (
                    <span key={h} role="cell" className={cx(st.hc, a > 55 && st.dark)} style={{ "--a": a, "--d": di, "--h": h } as CSSProperties} title={`${DAY_NAMES[di]} ${h}:00 · ${fmt(v)}`}>
                      {m === 0 ? "" : v || ""}
                    </span>
                  );
                })}
                <span className={st.rowSum}>{fmt(rowSum[di])}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={st.legendBar}>
          <span>less</span>
          <i />
          <span>more · hover a cell for its value</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="hh-h">
        <div className="ph-row between" style={{ padding: 0, marginBottom: 6 }}>
          <h2 id="hh-h" className="ph">
            By hour of day, all weekdays
          </h2>
        </div>
        <div key={`${cat}${m}`} className={hs.hours} role="img" aria-label={byHour.map((v, h) => `${h}:00 ${fmt(v)}`).join(", ")}>
          {byHour.map((v, h) => (
            <div key={h} className={cx(hs.hb, h === peak.h && hs.top)} title={`${h}:00 · ${fmt(v)}`}>
              <span className={hs.col}>
                <span className={hs.fill} style={{ "--h": v / hourMax, "--i": h } as CSSProperties} />
              </span>
              <span className={hs.hl}>{h}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
