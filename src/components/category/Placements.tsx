"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { CategoryData, Embed, Mode } from "@/lib/category";
import { addCell, zero, type Cell } from "@/lib/ads";
import { PLACEMENTS, categoryPlacements, type Placement } from "@/lib/placements";
import { eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { cx } from "@/lib/cx";
import { SampleTag } from "@/lib/homeData";
import Info from "../Info";
import Segmented from "../Segmented";
import Select from "../Select";
import st from "./Placements.module.css";

const KEY: Record<Placement, string> = { "Top of Search": "tos", "Product pages": "pp", "Rest of Search": "ros", "Off Amazon": "off" };
const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null);
type Metric = "spend" | "share" | "ctr" | "cpc" | "acos" | "cvr";
const METRICS: { value: Metric; label: string }[] = [
  { value: "spend", label: "Spend" },
  { value: "share", label: "Share" },
  { value: "ctr", label: "CTR" },
  { value: "cpc", label: "CPC" },
  { value: "acos", label: "ACOS" },
  { value: "cvr", label: "CVR" },
];
const get = (c: Cell, m: Metric, tot: number): number | null =>
  m === "spend" ? c.spend : m === "share" ? ratio(c.spend, tot) : m === "ctr" ? ratio(c.clicks, c.impr) : m === "cpc" ? (c.clicks ? c.spend / c.clicks : null) : m === "acos" ? ratio(c.spend, c.sales) : ratio(c.orders, c.clicks);
const fmt = (v: number, m: Metric) => (m === "spend" ? eur.format(v) : m === "cpc" ? eur2.format(v) : `${(m === "ctr" || m === "cvr" ? pct2 : pct1).format(v)}%`);

// chart geometry (viewBox units)
const W = 900;
const H = 220;
const L = 64;
const R = 16;
const T = 16;
const B = 28;

export default function Placements({ data, family, mode, embed }: { data: CategoryData; family: string; mode: Mode; embed?: Embed }) {
  const uid = embed?.uid ?? "";
  const weeks = useMemo(() => categoryPlacements(data, family), [data, family]);
  const [sel, setSel] = useState(0);
  const [metric, setMetric] = useState<Metric>("spend");
  const w = weeks[sel];
  const tot = PLACEMENTS.reduce((a, pl) => addCell(a, w.p[pl]), zero());
  const options = weeks.map((x) => `${x.kw} · ${x.label}`);

  // oldest on the left, newest on the right
  const series = useMemo(() => {
    const ordered = weeks.map((x, i) => ({ x, i })).reverse();
    return PLACEMENTS.map((pl) => ({
      pl,
      pts: ordered.map(({ x, i }) => {
        const t = PLACEMENTS.reduce((a, k) => a + x.p[k].spend, 0);
        return { i, v: get(x.p[pl], metric, t) };
      }),
    }));
  }, [weeks, metric]);
  const vals = series.flatMap((s) => s.pts.map((p) => p.v)).filter((v): v is number => v !== null);
  const max = (Math.max(...vals, 0) || 1) * 1.1;
  const n = weeks.length;
  const X = (k: number) => L + ((W - L - R) * k) / (n - 1);
  const Y = (v: number) => T + (H - T - B) * (1 - v / max);
  const selX = X(n - 1 - sel);

  return (
    <section id={`${uid}placements`} className="panel flush" aria-labelledby={`${uid}pl-h`}>
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id={`${uid}pl-h`} className="ph">
            {embed?.title ?? "Placements"}
          </h2>
          <SampleTag live={data.live} reason="not connected to the database yet" />
          <Info label="Placements">
            <p>Where Sponsored Products ads ran: Top of Search, product pages, the rest of the search results, and off Amazon. Amazon reports placements for Sponsored Products only, and only per week, so this section stays weekly even in the monthly view.</p>
            <p>Own campaigns only: shared catch-all campaigns also advertise other categories and are not split here.</p>
          </Info>
        </div>
        <div className="filters">
          <Select label="Week" value={options[sel]} options={options} onChange={(v) => setSel(options.indexOf(v))} />
        </div>
      </div>
      <p className={st.cov}>
        <b>{eur2.format(tot.spend)}</b> own-campaign SP spend in {w.kw} ({w.label}), {int.format(tot.orders)} orders at ACOS <b>{tot.sales ? `${pct1.format((tot.spend / tot.sales) * 100)}%` : "—"}</b>.
        {mode === "monthly" ? " Weekly figures: Amazon reports placements per week only." : ""}
      </p>

      <div className="tscroll">
        <table className={st.pl}>
          <thead>
            <tr>
              <th scope="col">Placement</th>
              {["Spend", "Share", "Impressions", "Clicks", "CTR", "CPC", "Sales", "Orders", "ACOS", "CVR"].map((h) => (
                <th key={h} scope="col" className="n">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={`${family}${sel}`} className="swap">
            {PLACEMENTS.map((pl) => {
              const c = w.p[pl];
              const share = tot.spend ? c.spend / tot.spend : 0;
              const acos = ratio(c.spend, c.sales);
              return (
                <tr key={pl}>
                  <th scope="row">
                    <span className={st.pn}>
                      <i className={st[KEY[pl]]} />
                      {pl}
                    </span>
                  </th>
                  <td className="n strong">{eur2.format(c.spend)}</td>
                  <td className="n">
                    <span className={st.shareCell} style={{ "--w": share } as CSSProperties}>
                      {pct1.format(share * 100)}%
                      <span className={cx(st.bar, st[KEY[pl]])} aria-hidden="true">
                        <i />
                      </span>
                    </span>
                  </td>
                  <td className="n">{int.format(c.impr)}</td>
                  <td className="n">{int.format(c.clicks)}</td>
                  <td className="n">{c.impr ? `${pct2.format((c.clicks / c.impr) * 100)}%` : <span className="na">—</span>}</td>
                  <td className="n">{c.clicks ? eur2.format(c.spend / c.clicks) : <span className="na">—</span>}</td>
                  <td className="n">{eur.format(c.sales)}</td>
                  <td className="n">{int.format(c.orders)}</td>
                  <td className="n">{acos === null ? <span className="na">no sales</span> : `${pct1.format(acos)}%`}</td>
                  <td className="n">{c.clicks ? `${pct2.format((c.orders / c.clicks) * 100)}%` : <span className="na">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="n">{eur2.format(tot.spend)}</td>
              <td className="n">100%</td>
              <td className="n">{int.format(tot.impr)}</td>
              <td className="n">{int.format(tot.clicks)}</td>
              <td className="n">{tot.impr ? `${pct2.format((tot.clicks / tot.impr) * 100)}%` : "—"}</td>
              <td className="n">{tot.clicks ? eur2.format(tot.spend / tot.clicks) : "—"}</td>
              <td className="n">{eur.format(tot.sales)}</td>
              <td className="n">{int.format(tot.orders)}</td>
              <td className="n">{tot.sales ? `${pct1.format((tot.spend / tot.sales) * 100)}%` : "—"}</td>
              <td className="n">{tot.clicks ? `${pct2.format((tot.orders / tot.clicks) * 100)}%` : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className={st.trend}>
        <div className={st.trendHd}>
          <h3>12-week trend</h3>
          <Segmented label="Trend metric" size="sm" value={metric} onChange={setMetric} options={METRICS} />
          <div className={st.legend} aria-hidden="true">
            {PLACEMENTS.map((pl) => (
              <span key={pl}>
                <i className={st[KEY[pl]]} />
                {pl}
              </span>
            ))}
          </div>
        </div>
        <svg className={st.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${METRICS.find((m) => m.value === metric)!.label} by placement over 12 weeks`}>
          {[0, 1, 2, 3].map((j) => {
            const v = (max * j) / 3;
            return (
              <g key={j}>
                <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className={st.grid} />
                <text x={L - 8} y={Y(v) + 4} textAnchor="end" className={st.axis}>
                  {fmt(v, metric)}
                </text>
              </g>
            );
          })}
          <line x1={selX} x2={selX} y1={T} y2={H - B} className={st.sel} />
          {weeks
            .map((x, i) => ({ x, i }))
            .reverse()
            .map(({ x, i }, k) => (
              <text key={x.kw} x={X(k)} y={H - 8} textAnchor={k === 0 ? "start" : k === n - 1 ? "end" : "middle"} className={cx(st.axis, i === sel && st.axisOn)}>
                {x.kw.replace("KW ", "KW")}
              </text>
            ))}
          {series.map((s) => {
            const d = s.pts.reduce((acc, p, k) => (p.v === null ? acc : acc + `${acc ? "L" : "M"}${X(k).toFixed(1)} ${Y(p.v).toFixed(1)}`), "");
            return (
              <g key={`${s.pl}${metric}${family}`} className={st[KEY[s.pl]]}>
                <path d={d} pathLength={1} className={st.line} />
                {s.pts.map((p, k) =>
                  p.v === null ? null : (
                    <circle key={k} cx={X(k)} cy={Y(p.v)} r={p.i === sel ? 4.5 : 2.8} className={st.dot}>
                      <title>{`${s.pl} · ${weeks[p.i].kw}: ${fmt(p.v, metric)}`}</title>
                    </circle>
                  ),
                )}
              </g>
            );
          })}
          {/* one invisible column per week: click to show that week in the table */}
          {weeks.map((x, i) => {
            const k = n - 1 - i;
            const half = (W - L - R) / (n - 1) / 2;
            return <rect key={x.kw} x={X(k) - half} y={T} width={half * 2} height={H - T - B} className={st.hit} onClick={() => setSel(i)} aria-label={`Show ${x.kw}`} />;
          })}
        </svg>
      </div>
    </section>
  );
}
