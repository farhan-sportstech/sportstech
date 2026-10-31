"use client";

import { useState } from "react";
import type { Period } from "@/lib/mock";
import type { CategoryData, Mode, OverallRow } from "@/lib/category";
import { acos, change, eur, eur2, int, pct1, pct2, tacos } from "@/lib/format";
import { avgPrice, organicShare } from "@/lib/metrics";
import { cx } from "@/lib/cx";
import Delta from "../Delta";
import Info from "../Info";
import Select from "../Select";
import BrandedSplit from "./BrandedSplit";
import Campaigns from "./Campaigns";
import KeywordsTargets from "./KeywordsTargets";
import Placements from "./Placements";
import st from "./ProductDetail.module.css";

type M = { label: string; get: (r: OverallRow) => number | null; fmt: (v: number) => string; ratio?: boolean; goodWhen: "up" | "down" | "none" };
const pctF = (v: number) => `${pct1.format(v)}%`;
const METRICS: M[] = [
  { label: "Sales", get: (r) => r.sales, fmt: (v) => eur.format(v), goodWhen: "up" },
  { label: "Units", get: (r) => r.units, fmt: (v) => int.format(v), goodWhen: "up" },
  { label: "Orders", get: (r) => r.orders, fmt: (v) => int.format(v), goodWhen: "up" },
  { label: "Sessions", get: (r) => r.sessions, fmt: (v) => int.format(v), goodWhen: "up" },
  { label: "Unit session %", get: (r) => (r.sessions ? (r.units / r.sessions) * 100 : null), fmt: (v) => `${pct2.format(v)}%`, ratio: true, goodWhen: "up" },
  { label: "Avg. price", get: avgPrice, fmt: (v) => eur2.format(v), goodWhen: "none" },
  { label: "Ad spend", get: (r) => r.adSpend, fmt: (v) => eur2.format(v), goodWhen: "none" },
  { label: "Ad sales", get: (r) => r.adSales, fmt: (v) => eur.format(v), goodWhen: "up" },
  { label: "ACOS", get: acos, fmt: pctF, ratio: true, goodWhen: "down" },
  { label: "TACoS", get: tacos, fmt: pctF, ratio: true, goodWhen: "down" },
  { label: "Organic share", get: organicShare, fmt: pctF, ratio: true, goodWhen: "up" },
];

/** One product at a time: its trading per period, then its own campaigns, keywords, branded split and placements. */
export default function ProductDetail({ data, family, mode, periods }: { data: CategoryData; family: string; mode: Mode; periods: Period[] }) {
  const products = data.pick(family);
  const labels = products.map((p) => `${p.name} · ${p.asin}`);
  const [picked, setPicked] = useState(labels[0]);
  const idx = Math.max(0, labels.indexOf(picked));
  const p = products[idx];
  if (!p) return null;
  const scope = `asin:${p.asin}`;
  const rows = data.totals(scope, mode);
  const [cur, prev] = periods;
  const unit = mode === "weekly" ? "week" : "month";
  const embed = (title: string) => ({ uid: "pd-", title: `${title} · ${p.name}` });

  return (
    <div className={st.group}>
      <section id="detail" className="panel flush" aria-labelledby="pd-h">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 id="pd-h" className="ph">
              Product detail
            </h2>
            <Info label="Product detail">
              <p>One product at a time: its {unit}-by-{unit} trading, then its own campaigns, keywords and targets, branded split and placements. Everything below this panel follows the product picked here.</p>
              <p>Shared catch-all campaigns are shown only in proportion to this product&apos;s share of the category, and never split by keyword.</p>
            </Info>
          </div>
          <div className="filters">
            <Select label="Product" value={labels[idx]} options={labels} onChange={setPicked} />
          </div>
        </div>
        <p className={st.vars}>
          <span>{p.variants.length} variants:</span>
          {p.variants.map((v, i) => (
            <span key={v.sku}>
              <b>{v.label}</b> {v.sku}
              {i < p.variants.length - 1 ? " ·" : ""}
            </span>
          ))}
        </p>
        <div className="tscroll">
          <table className={st.strip}>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {periods.map((x, i) => (
                  <th key={x.key} scope="col" className={cx("n", i === 0 && "cur")}>
                    {x.kw}
                    <small>{x.label}</small>
                  </th>
                ))}
                <th scope="col" className={cx("n", st.split)}>
                  vs {prev.kw}
                </th>
              </tr>
            </thead>
            <tbody key={`${p.asin}${mode}`} className="swap">
              {METRICS.map((m) => {
                const a = m.get(rows[0]);
                const b = m.get(rows[1]);
                return (
                  <tr key={m.label}>
                    <th scope="row">{m.label}</th>
                    {rows.map((r, i) => {
                      const v = m.get(r);
                      return (
                        <td key={i} className={cx("n", i === 0 && "cur")}>
                          {v === null ? <span className="na">—</span> : m.fmt(v)}
                        </td>
                      );
                    })}
                    <td className={cx("n", st.split)}>{a === null || b === null ? <span className="na">—</span> : <Delta value={m.ratio ? a - b : change(a, b)} unit={m.ratio ? " pp" : "%"} goodWhen={m.goodWhen} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={st.foot}>
          {cur.kw}: <b>{eur.format(rows[0].sales)}</b> sales at ACOS <b>{pct1.format(acos(rows[0]))}%</b>. The four sections below show {p.name} only.
        </p>
      </section>
      <Campaigns key={`pc${p.asin}`} data={data} family={scope} mode={mode} periods={periods} embed={embed("Campaigns")} />
      <KeywordsTargets key={`pk${p.asin}`} data={data} family={scope} mode={mode} periods={periods} embed={embed("Keywords & targets")} />
      <BrandedSplit data={data} family={scope} mode={mode} periods={periods} embed={embed("Branded vs non-branded")} />
      <Placements key={`pp${p.asin}`} data={data} family={scope} mode={mode} embed={embed("Placements")} />
    </div>
  );
}
