"use client";

import { useMemo, useState } from "react";
import type { Period } from "@/lib/mock";
import type { CategoryData, Embed, Mode } from "@/lib/category";
import { categoryCampaigns, total, zero, addCell, type Cell } from "@/lib/ads";
import { eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { cx } from "@/lib/cx";
import { SampleTag } from "@/lib/homeData";
import Info from "../Info";
import MultiSelect from "../MultiSelect";
import Select from "../Select";
import st from "./Campaigns.module.css";

const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null);
type M = { key: string; label: string; get: (c: Cell, tot: number) => number | null; fmt: (v: number) => string };
const METRICS: M[] = [
  { key: "spend", label: "Spend", get: (c) => c.spend, fmt: (v) => eur2.format(v) },
  { key: "share", label: "Spend share", get: (c, tot) => ratio(c.spend, tot), fmt: (v) => `${pct1.format(v)}%` },
  { key: "sales", label: "Sales", get: (c) => c.sales, fmt: (v) => eur.format(v) },
  { key: "acos", label: "ACOS", get: (c) => ratio(c.spend, c.sales), fmt: (v) => `${pct1.format(v)}%` },
  { key: "orders", label: "Orders", get: (c) => c.orders, fmt: (v) => int.format(v) },
  { key: "cvr", label: "CVR", get: (c) => ratio(c.orders, c.clicks), fmt: (v) => `${pct2.format(v)}%` },
  { key: "clicks", label: "Clicks", get: (c) => c.clicks, fmt: (v) => int.format(v) },
  { key: "impr", label: "Impressions", get: (c) => c.impr, fmt: (v) => int.format(v) },
  { key: "ctr", label: "CTR", get: (c) => ratio(c.clicks, c.impr), fmt: (v) => `${pct2.format(v)}%` },
  { key: "cpc", label: "Avg. CPC", get: (c) => (c.clicks ? c.spend / c.clicks : null), fmt: (v) => eur2.format(v) },
];
const DEFAULT = ["spend", "acos"];
const TYPES = ["All campaigns", "Own only", "Shared only"];
const MIN = ["Any spend", "€10+ spend", "€50+ spend", "€200+ spend"];
const minOf = (s: string) => Number(s.replace(/\D/g, "")) || 0;
type SortKey = "name" | "spend" | "sales" | "orders" | "acos" | "cvr";

export default function Campaigns({ data, family, mode, periods, embed }: { data: CategoryData; family: string; mode: Mode; periods: Period[]; embed?: Embed }) {
  const uid = embed?.uid ?? "";
  const [metrics, setMetrics] = useState(DEFAULT);
  const [type, setType] = useState(TYPES[0]);
  const [min, setMin] = useState(MIN[0]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "spend", dir: -1 });
  const unit = mode === "weekly" ? "week" : "month";
  const n = periods.length;
  const shown = METRICS.filter((m) => metrics.includes(m.key));

  const all = useMemo(() => categoryCampaigns(data, mode, family).map((c) => ({ ...c, t: total(c.w) })), [data, mode, family]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const val = (r: (typeof all)[number]) =>
      sort.key === "name" ? 0 : sort.key === "acos" ? (ratio(r.t.spend, r.t.sales) ?? Infinity) : sort.key === "cvr" ? (ratio(r.t.orders, r.t.clicks) ?? -1) : r.t[sort.key];
    return all
      .filter((r) => r.t.spend >= minOf(min) && (type === TYPES[0] || (type === TYPES[1]) === r.own) && (!needle || `${r.name} ${r.product ?? ""}`.toLowerCase().includes(needle)))
      .sort((a, b) => (sort.key === "name" ? a.name.localeCompare(b.name) * sort.dir : (val(a) - val(b)) * sort.dir));
  }, [all, min, type, q, sort]);

  const perTot = periods.map((_, i) => rows.reduce((a, r) => a + (r.w[i]?.spend ?? 0), 0));
  const sum = rows.reduce((a, r) => addCell(a, r.t), zero());
  const sumW = periods.map((_, i) => rows.reduce<Cell>((a, r) => addCell(a, r.w[i]), zero()));
  const wasted = rows.filter((r) => r.t.orders === 0 && r.t.spend >= 10).length;

  const head = (k: SortKey, label: string, sub?: string, cls?: string) => (
    <th scope="col" rowSpan={2} className={cx(k !== "name" && "n", "sortable", sort.key === k && "sorted", cls)} aria-sort={sort.key === k ? (sort.dir === -1 ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => (s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: k === "name" ? 1 : -1 }))}>
        {label}
        <span className="arr" aria-hidden="true">
          {sort.key === k ? (sort.dir === -1 ? "↓" : "↑") : ""}
        </span>
      </button>
      {sub ? <small>{sub}</small> : null}
    </th>
  );

  return (
    <section id={`${uid}campaigns`} className="panel flush" aria-labelledby={`${uid}cp-h`}>
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id={`${uid}cp-h`} className="ph">
            {embed?.title ?? "Campaigns"}
          </h2>
          <SampleTag live={data.live} reason="not connected to the database yet" />
          <Info label="Campaigns">
            <p>Every campaign that advertised a product in this category, from the Sponsored Products advertised-product report, so the figures count only spend and sales attributable to these ASINs.</p>
            <p>
              <b>Own</b> campaigns are named after a product of this category; <b>shared</b> ones are account-wide catch-alls that happen to include these ASINs. Sales are campaign-attributed. Sponsored Brands campaigns are under By ad type.
            </p>
          </Info>
        </div>
        <p className="tot">
          <b>{rows.length}</b> campaigns · {rows.filter((r) => r.own).length} own · {rows.filter((r) => !r.own).length} shared
          {wasted ? (
            <>
              {" "}
              · <b className={st.warn}>{wasted}</b> spent €10+ with no order
            </>
          ) : null}
        </p>
      </div>

      <div className={st.bar}>
        <div className={st.ctl}>
          <span className={st.cap}>Columns per {unit}</span>
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
        <div className={st.ctl}>
          <span className={st.cap}>Filter</span>
          <div className="filters">
            <input type="search" className={st.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaign or product" aria-label="Search campaigns" />
            <Select label="Campaign type" value={type} onChange={setType} options={TYPES} />
            <Select label="Minimum spend over 5 periods" value={min} onChange={setMin} options={MIN} />
          </div>
        </div>
      </div>

      <div className="tscroll tall">
        <table className={st.cp}>
          <thead>
            <tr className={st.grp}>
              {head("name", "Campaign")}
              {shown.map((m) => (
                <th key={m.key} scope="colgroup" colSpan={n} className={st.gh}>
                  {m.label}
                </th>
              ))}
              {head("spend", "Spend", `${n} ${unit}s`, st.split)}
              {head("sales", "Sales", `${n} ${unit}s`)}
              {head("orders", "Orders", `${n} ${unit}s`)}
              {head("acos", "ACOS")}
              {head("cvr", "CVR")}
            </tr>
            <tr>
              {shown.map((m) =>
                periods.map((p, i) => (
                  <th key={m.key + p.key} scope="col" className={cx("n", i === 0 && "cur", i === 0 && st.start)}>
                    {p.kw}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody key={`${mode}${family}${metrics.join()}${type}`} className="swap">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6 + shown.length * n} className="empty">
                  No campaigns match.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const acos = ratio(r.t.spend, r.t.sales);
              const cvr = ratio(r.t.orders, r.t.clicks);
              const noOrder = r.t.orders === 0 && r.t.spend >= 10;
              return (
                <tr key={r.name} className={cx(noOrder && st.waste)}>
                  <th scope="row" className={st.name}>
                    {r.name}
                    <small>
                      <span className={cx(st.tag, r.own ? st.own : st.shared)}>{r.own ? "own" : "shared"}</span>
                      {r.own ? (r.product ?? "multi-product") : "account-wide catch-all"}
                      {noOrder ? <span className={st.none}>no orders</span> : null}
                    </small>
                  </th>
                  {shown.map((m) =>
                    r.w.map((c, i) => {
                      const v = c ? m.get(c, perTot[i]) : null;
                      return (
                        <td key={m.key + i} className={cx("n", i === 0 && "cur", i === 0 && st.start)}>
                          {v === null ? <span className="na">—</span> : m.fmt(v)}
                        </td>
                      );
                    }),
                  )}
                  <td className={cx("n strong", st.split)}>{eur2.format(r.t.spend)}</td>
                  <td className="n">{eur.format(r.t.sales)}</td>
                  <td className="n">{int.format(r.t.orders)}</td>
                  <td className="n">{acos === null ? <span className="na">—</span> : `${pct1.format(acos)}%`}</td>
                  <td className="n">{cvr === null ? <span className="na">—</span> : `${pct2.format(cvr)}%`}</td>
                </tr>
              );
            })}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {shown.map((m) =>
                  sumW.map((c, i) => {
                    const v = m.get(c, perTot[i]);
                    return (
                      <td key={m.key + i} className={cx("n", i === 0 && "cur", i === 0 && st.start)}>
                        {v === null ? "—" : m.fmt(v)}
                      </td>
                    );
                  }),
                )}
                <td className={cx("n", st.split)}>{eur2.format(sum.spend)}</td>
                <td className="n">{eur.format(sum.sales)}</td>
                <td className="n">{int.format(sum.orders)}</td>
                <td className="n">{sum.sales ? `${pct1.format((sum.spend / sum.sales) * 100)}%` : "—"}</td>
                <td className="n">{sum.clicks ? `${pct2.format((sum.orders / sum.clicks) * 100)}%` : "—"}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}
