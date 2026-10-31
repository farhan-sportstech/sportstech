"use client";

import { useMemo, useState } from "react";
import type { Period } from "@/lib/mock";
import type { CategoryData, Embed, Mode } from "@/lib/category";
import { MATCH_TYPES, categoryAds, scopeRows, total, addCell, zero, type Cell, type KwRow } from "@/lib/ads";
import { eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { cx } from "@/lib/cx";
import Info from "../Info";
import Segmented from "../Segmented";
import Select from "../Select";
import st from "./KeywordsTargets.module.css";

type Metric = "spend" | "sales" | "acos" | "orders" | "clicks" | "cvr";
const METRICS: { value: Metric; label: string }[] = [
  { value: "spend", label: "Spend" },
  { value: "sales", label: "Sales" },
  { value: "acos", label: "ACOS" },
  { value: "orders", label: "Orders" },
  { value: "clicks", label: "Clicks" },
  { value: "cvr", label: "CVR" },
];
const pctOf = (a: number, b: number) => (b ? (a / b) * 100 : null);
const value = (c: Cell | null, m: Metric): number | null => {
  if (!c) return null;
  if (m === "acos") return pctOf(c.spend, c.sales);
  if (m === "cvr") return pctOf(c.orders, c.clicks);
  return c[m];
};
const fmt = (v: number | null, m: Metric) => {
  if (v === null) return <span className="na">—</span>;
  if (m === "spend") return eur2.format(v);
  if (m === "sales") return eur.format(v);
  if (m === "acos") return `${pct1.format(v)}%`;
  if (m === "cvr") return `${pct2.format(v)}%`;
  return int.format(v);
};
const ALL_TYPES = "All match types";
const MIN = ["Any spend", "€5+ spend", "€20+ spend", "€50+ spend"];
const minOf = (s: string) => Number(s.replace(/\D/g, "")) || 0;
type SortKey = "spend" | "sales" | "acos" | "orders" | "h10";
const LIMIT = 40;

export default function KeywordsTargets({ data, family, mode, periods, embed }: { data: CategoryData; family: string; mode: Mode; periods: Period[]; embed?: Embed }) {
  const uid = embed?.uid ?? "";
  const [metric, setMetric] = useState<Metric>("spend");
  const [match, setMatch] = useState(ALL_TYPES);
  const [min, setMin] = useState(MIN[0]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "spend", dir: -1 });
  const [all, setAll] = useState(false);
  const unit = mode === "weekly" ? "week" : "month";

  const scoped = useMemo(() => {
    const asins = family ? data.pick(family).map((p) => p.asin) : null;
    return scopeRows(categoryAds(data, mode), asins).map((r) => ({ ...r, t: total(r.w) }));
  }, [data, family, mode]);

  // min-spend and search apply to both tables; the match-type filter only to the full list
  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped.filter((r) => r.t.spend >= minOf(min) && (!needle || `${r.term} ${r.campaign} ${r.product ?? ""}`.toLowerCase().includes(needle)));
  }, [scoped, min, q]);

  const summary = useMemo(() => {
    const all5 = base.reduce((a, r) => a + r.t.spend, 0);
    const group = (label: string, rs: typeof base, sub: boolean) => {
      const w = periods.map((_, i) => rs.reduce<Cell | null>((a, r) => (r.w[i] ? addCell(a ?? zero(), r.w[i]) : a), null));
      const t = rs.reduce((a, r) => addCell(a, r.t), zero());
      return { label, sub, n: rs.length, w, t, share: all5 ? (t.spend / all5) * 100 : 0 };
    };
    return MATCH_TYPES.flatMap((m) => {
      const rs = base.filter((r) => r.match === m);
      if (!rs.length) return [];
      const subs = Array.from(new Set(rs.map((r) => r.sub).filter((s): s is string => !!s))).sort();
      return [group(m, rs, false), ...subs.map((s) => group(s, rs.filter((r) => r.sub === s), true))];
    });
  }, [base, periods]);

  const list = useMemo(() => {
    const key = (r: (typeof base)[number]) => (sort.key === "acos" ? (pctOf(r.t.spend, r.t.sales) ?? Infinity) : sort.key === "h10" ? (r.market?.h10 ?? -1) : r.t[sort.key]);
    return base.filter((r) => match === ALL_TYPES || r.match === match).sort((a, b) => (key(a) - key(b)) * sort.dir);
  }, [base, match, sort]);
  const shown = all ? list : list.slice(0, LIMIT);
  const spend5 = list.reduce((a, r) => a + r.t.spend, 0);

  const head = (key: SortKey, label: string, cls?: string) => (
    <th scope="col" className={cx("n sortable", sort.key === key && "sorted", cls)} aria-sort={sort.key === key ? (sort.dir === -1 ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }))}>
        {label}
        <span className="arr" aria-hidden="true">
          {sort.key === key ? (sort.dir === -1 ? "↓" : "↑") : ""}
        </span>
      </button>
    </th>
  );
  const periodHeads = periods.map((p, i) => (
    <th key={p.key} scope="col" className={cx("n", i === 0 && "cur")}>
      {p.kw}
    </th>
  ));
  const metricLabel = METRICS.find((m) => m.value === metric)!.label;

  return (
    <section id={`${uid}keywords`} className="panel flush" aria-labelledby={`${uid}kw-h`}>
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id={`${uid}kw-h`} className="ph">
            {embed?.title ?? "Keywords & targets"}
          </h2>
          <Info label="Keywords & targets">
            <p>Every bidded keyword and target in own campaigns, one row per keyword and match type, five {unit}s side by side.</p>
            <p>On the right: Helium 10 search volume (30 days) and Amazon Search Query Performance for the same query: weekly searches, this category&apos;s share of clicks and purchases, and the best organic rank among the products in scope.</p>
            <p>A row belongs to a product when at least 80% of its campaign&apos;s spend is on that product. Otherwise it is tagged multi and appears under the whole category only.</p>
          </Info>
        </div>
        <p className="tot">
          <b>{int.format(list.length)}</b> rows · <b>{eur2.format(spend5)}</b> spend over 5 {unit}s
        </p>
      </div>

      <div className={st.bar}>
        <div className={st.ctl}>
          <span className={st.cap}>Show per {unit}</span>
          <Segmented label={`Metric per ${unit}`} size="sm" value={metric} onChange={setMetric} options={METRICS} />
        </div>
        <div className={st.ctl}>
          <span className={st.cap}>Filter</span>
          <div className="filters">
            <input type="search" className={st.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keyword, target or campaign" aria-label="Search keywords" />
            <Select label="Match type" value={match} onChange={setMatch} options={[ALL_TYPES, ...MATCH_TYPES]} />
            <Select label="Minimum spend over 5 periods" value={min} onChange={setMin} options={MIN} />
          </div>
        </div>
      </div>

      <h3 className={st.h3}>By match type</h3>
      <p className={st.sub}>Every match type, whatever the match-type filter says. Min. spend and search still apply.</p>
      <div className="tscroll">
        <table className={st.sum}>
          <thead>
            <tr>
              <th scope="col">Match type</th>
              <th scope="col" className="n">
                Rows
              </th>
              {periodHeads}
              <th scope="col" className={cx("n", st.split)}>
                Spend · 5 {unit}s
              </th>
              <th scope="col" className="n">
                Share
              </th>
              <th scope="col" className="n">
                Sales
              </th>
              <th scope="col" className="n">
                ACOS
              </th>
              <th scope="col" className="n">
                Orders
              </th>
              <th scope="col" className="n">
                CVR
              </th>
            </tr>
          </thead>
          <tbody key={`${mode}${metric}${family}`} className="swap">
            {summary.length === 0 ? (
              <tr>
                <td colSpan={8 + periods.length} className="empty">
                  No keywords or targets match.
                </td>
              </tr>
            ) : null}
            {summary.map((g) => (
              <tr key={g.label} className={cx(g.sub && st.subrow)}>
                <th scope="row">{g.label}</th>
                <td className="n">{int.format(g.n)}</td>
                {g.w.map((c, i) => (
                  <td key={i} className={cx("n", i === 0 && "cur")}>
                    {fmt(value(c, metric), metric)}
                  </td>
                ))}
                <td className={cx("n strong", st.split)}>{eur2.format(g.t.spend)}</td>
                <td className="n">{pct1.format(g.share)}%</td>
                <td className="n">{eur.format(g.t.sales)}</td>
                <td className="n">{fmt(pctOf(g.t.spend, g.t.sales), "acos")}</td>
                <td className="n">{int.format(g.t.orders)}</td>
                <td className="n">{fmt(pctOf(g.t.orders, g.t.clicks), "cvr")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={st.h3}>All keywords &amp; targets</h3>
      <div className={st.legend}>
        <span>
          <i className={st.kAd} /> Own campaigns, {metricLabel.toLowerCase()} per {unit}
        </span>
        <span>
          <i className={st.kMkt} /> Market &amp; SEO: Helium 10 and Amazon SQP
        </span>
      </div>
      <div className="tscroll tall">
        <table className={st.kw}>
          <thead>
            <tr>
              <th scope="col">Keyword or target</th>
              <th scope="col">Match</th>
              <th scope="col">Product</th>
              {periodHeads}
              {head("spend", `Spend · 5 ${unit}s`, st.split)}
              {head("sales", "Sales")}
              {head("acos", "ACOS")}
              {head("orders", "Orders")}
              {head("h10", "H10 volume", st.mkt)}
              <th scope="col" className={cx("n", st.mkt)}>
                SQP searches
              </th>
              <th scope="col" className={cx("n", st.mkt)}>
                Click share
              </th>
              <th scope="col" className={cx("n", st.mkt)}>
                Purchase share
              </th>
              <th scope="col" className={cx("n", st.mkt)}>
                Org. rank
              </th>
            </tr>
          </thead>
          <tbody key={`${mode}${metric}${family}${match}`} className="swap">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={12 + periods.length} className="empty">
                  No keywords or targets match.
                </td>
              </tr>
            ) : null}
            {shown.map((r: KwRow & { t: Cell }) => (
              <tr key={r.id}>
                <th scope="row" className={st.term}>
                  {r.term}
                  <small>{r.campaign}</small>
                </th>
                <td className={st.match}>{r.sub ?? r.match}</td>
                <td>{r.product ?? <span className={st.multi}>multi</span>}</td>
                {r.w.map((c, i) => (
                  <td key={i} className={cx("n", i === 0 && "cur")}>
                    {fmt(value(c, metric), metric)}
                  </td>
                ))}
                <td className={cx("n strong", st.split)}>{eur2.format(r.t.spend)}</td>
                <td className="n">{eur.format(r.t.sales)}</td>
                <td className="n">{fmt(pctOf(r.t.spend, r.t.sales), "acos")}</td>
                <td className="n">{int.format(r.t.orders)}</td>
                <td className={cx("n", st.mkt)}>{r.market ? int.format(r.market.h10) : <span className="na">—</span>}</td>
                <td className={cx("n", st.mkt)}>{r.market ? int.format(r.market.sqpVol) : <span className="na">—</span>}</td>
                <td className={cx("n", st.mkt)}>{r.market ? `${pct1.format(r.market.clickShare)}%` : <span className="na">—</span>}</td>
                <td className={cx("n", st.mkt)}>{r.market ? `${pct1.format(r.market.purchShare)}%` : <span className="na">—</span>}</td>
                <td className={cx("n", st.mkt)}>{r.market?.rank ? `#${r.market.rank}` : <span className="na">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > LIMIT ? (
        <div className={st.more}>
          <button type="button" className="btn sm" onClick={() => setAll((a) => !a)}>
            {all ? `Show top ${LIMIT}` : `Show all ${int.format(list.length)}`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
