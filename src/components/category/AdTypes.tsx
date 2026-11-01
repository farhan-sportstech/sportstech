"use client";

import { useState } from "react";
import type { Period } from "@/lib/mock";
import type { AdType } from "@/lib/category";
import { eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { cx } from "@/lib/cx";
import { SampleTag } from "@/lib/homeData";
import Info from "../Info";
import MultiSelect from "../MultiSelect";
import st from "./AdTypes.module.css";

// tot[i] = spend of all ad types in period i (for the share)
type M = { key: string; label: string; get: (a: AdType, i: number, tot: number[]) => number | null; fmt: (v: number) => string };

const div = (a: number, b: number) => (b ? a / b : null);
const pctOf = (a: number, b: number) => (b ? (a / b) * 100 : null);
const METRICS: M[] = [
  { key: "spend", label: "Spend", get: (a, i) => a.spend[i], fmt: (v) => eur2.format(v) },
  { key: "share", label: "Spend share", get: (a, i, tot) => pctOf(a.spend[i], tot[i]), fmt: (v) => `${pct1.format(v)}%` },
  { key: "sales", label: "Sales", get: (a, i) => a.sales[i], fmt: (v) => eur.format(v) },
  { key: "acos", label: "ACOS", get: (a, i) => pctOf(a.spend[i], a.sales[i]), fmt: (v) => `${pct1.format(v)}%` },
  { key: "orders", label: "Orders", get: (a, i) => a.orders[i], fmt: (v) => int.format(v) },
  { key: "cvr", label: "CVR", get: (a, i) => pctOf(a.orders[i], a.clicks[i]), fmt: (v) => `${pct2.format(v)}%` },
  { key: "clicks", label: "Clicks", get: (a, i) => a.clicks[i], fmt: (v) => int.format(v) },
  { key: "impr", label: "Impressions", get: (a, i) => a.impressions[i], fmt: (v) => int.format(v) },
  { key: "ctr", label: "CTR", get: (a, i) => pctOf(a.clicks[i], a.impressions[i]), fmt: (v) => `${pct2.format(v)}%` },
  { key: "cpc", label: "Avg. CPC", get: (a, i) => div(a.spend[i], a.clicks[i]), fmt: (v) => eur2.format(v) },
];
const DEFAULT = ["spend", "share", "acos"];

export default function AdTypes({ periods, types, mode, sample }: { periods: Period[]; types: AdType[]; mode: string; sample?: string }) {
  const [metrics, setMetrics] = useState(DEFAULT);
  const shown = METRICS.filter((m) => metrics.includes(m.key));
  const tot = periods.map((_, i) => types.reduce((a, t) => a + t.spend[i], 0));
  const total = tot[0];
  const sb = types.find((t) => !t.perAsin);

  return (
    <section id="adtype" className="panel flush" aria-labelledby="at-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="at-h" className="ph">
            By ad type
          </h2>
          <SampleTag live={Boolean(sample)} reason={sample} />
          <Info label="By ad type">
            <p>Sponsored Products and Sponsored Display are attributed to the advertised ASIN, so they are inside every product number on this page.</p>
            <p>Sponsored Brands has no per-ASIN attribution: it is counted at campaign level for SB campaigns whose name identifies a product of this category, shown separately and not part of the product tables.</p>
            <p>Sales here are campaign-attributed (they include halo sales of other products), so they run higher than the same-SKU ad sales used elsewhere.</p>
          </Info>
        </div>
        <MultiSelect
          label="Metrics"
          value={metrics}
          onChange={setMetrics}
          options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
          presets={[
            { label: "All", value: METRICS.map((m) => m.key) },
            { label: "None", value: [] },
            { label: "Default", value: DEFAULT },
          ]}
        />
      </div>
      {sb ? (
        <p className={st.lede}>
          Sponsored Brands this {mode === "weekly" ? "week" : "month"}: <b>{eur2.format(sb.spend[0])}</b> spend, <b>{eur.format(sb.sales[0])}</b> sales, kept out of the product numbers.
        </p>
      ) : null}
      <div className="tscroll">
        <table className={st.at}>
          <thead>
            <tr className={st.grp}>
              <th scope="col" colSpan={4} />
              {shown.map((m) => (
                <th key={m.key} scope="colgroup" colSpan={periods.length} className={st.gh}>
                  {m.label}
                </th>
              ))}
            </tr>
            <tr>
              <th scope="col">Ad type</th>
              <th scope="col" className="n">
                Spend
              </th>
              <th scope="col" className="n">
                Share
              </th>
              <th scope="col" className={cx("n", st.end)}>
                ACOS
              </th>
              {shown.map((m) =>
                periods.map((p, i) => (
                  <th key={m.key + p.key} scope="col" className={cx("n", i === 0 && "cur", i === periods.length - 1 && st.end)}>
                    {p.kw}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody key={mode + metrics.join()} className="swap">
            {types.map((t) => (
              <tr key={t.name}>
                <th scope="row">
                  {t.name}
                  <small>{t.perAsin ? "in product numbers" : "campaign level, not in product numbers"}</small>
                </th>
                <td className="n strong">{eur2.format(t.spend[0])}</td>
                <td className="n">{pct1.format(total ? (t.spend[0] / total) * 100 : 0)}%</td>
                <td className={cx("n", st.end)}>{t.sales[0] ? `${pct1.format((t.spend[0] / t.sales[0]) * 100)}%` : "—"}</td>
                {shown.map((m) =>
                  periods.map((p, i) => {
                    const v = m.get(t, i, tot);
                    return (
                      <td key={m.key + p.key} className={cx("n", i === 0 && "cur", i === periods.length - 1 && st.end)}>
                        {v === null ? <span className="na">—</span> : m.fmt(v)}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
