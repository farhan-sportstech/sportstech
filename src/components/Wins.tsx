"use client";

import { useMemo, useState } from "react";
import { campaigns, dealPeriods, keywords, monthly as sampleMonthly, weekly as sampleWeekly } from "@/lib/mock";
import { SampleTag, useHomeData } from "@/lib/homeData";
import { eur, eur2, pct1, pct2, sumRows } from "@/lib/format";
import Segmented from "./Segmented";
import Info from "./Info";
import st from "./Wins.module.css";
import Select from "./Select";

const TH = 15; // TACoS below this is Good; exactly 15% counts as Bad
type View = "products" | "campaigns" | "keywords";
type Side = "good" | "bad";
type Line = { key: string; name: string; sub: string; deal?: boolean; prev: number | null; now: number | null; spend: number; spendPct: number; sales: number; salesPct: number };

const pp = (v: number | null) => (v === null ? "no sales" : `${pct2.format(v)}%`);
const ALL_CATS = "All categories";
type SortKey = "now" | "change" | "spend" | "sales";

export default function Wins({ mode }: { mode: "weekly" | "monthly" }) {
  const { weekly, monthly, products, live, wins } = useHomeData();
  const data = mode === "weekly" ? weekly : monthly;
  const unit = mode === "weekly" ? "week" : "month";
  const options = data.periods.slice(0, -1).map((p) => `${p.kw} · ${p.label}`);
  const [picked, setPicked] = useState({ mode, i: 0 });
  const [view, setView] = useState<View>("products");
  const [side, setSide] = useState<Side>("good");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [cat, setCat] = useState(ALL_CATS);
  const i = picked.mode === mode ? picked.i : 0;
  const cats = useMemo(() => [ALL_CATS, ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  const lines = useMemo<Line[]>(() => {
    // campaign and keyword lines are still sample data, so they are measured against the sample totals
    const base = view === "products" || !live ? data : mode === "weekly" ? sampleWeekly : sampleMonthly;
    const tot = sumRows(base.categories.map((c) => c.rows[i]));
    if (view === "products") {
      // deal weeks aren't in the database yet, so live rows carry no deal flag
      const deal = !live && (dealPeriods[mode][i] || dealPeriods[mode][i + 1]);
      return products
        .map((p) => ({ p, a: p[mode][i], b: p[mode][i + 1] }))
        .filter(({ a, b }) => a.adSpend >= 20 && a.sales > 0 && b.sales > 0)
        .map(({ p, a, b }, n) => ({
          key: p.asin,
          name: p.name,
          sub: `${p.asin} · ${p.category}`,
          deal: deal && n % 4 === 0,
          prev: (b.adSpend / b.sales) * 100,
          now: (a.adSpend / a.sales) * 100,
          spend: a.adSpend,
          spendPct: (a.adSpend / tot.adSpend) * 100,
          sales: a.sales,
          salesPct: (a.sales / tot.sales) * 100,
        }));
    }
    // weekly campaign and keyword lines come straight from the database, with its stored shares and previous ACOS
    const stored = live && mode === "weekly" ? wins?.[view]?.[i] : undefined;
    if (stored)
      return stored.map((c, n) => ({
        key: `${c.name}${n}`,
        name: c.name,
        sub: c.sub,
        prev: c.prevAcos,
        now: c.sales ? (c.spend / c.sales) * 100 : null,
        spend: c.spend,
        spendPct: c.spendPct,
        sales: c.sales,
        salesPct: c.salesPct,
      }));
    const src = (view === "campaigns" ? campaigns : keywords)[mode];
    return src.map((c, n) => ({
      key: `${c.name}${n}`,
      name: c.name,
      sub: c.sub,
      prev: c.adSales[i + 1] ? (c.adSpend[i + 1] / c.adSales[i + 1]) * 100 : null,
      now: c.adSales[i] ? (c.adSpend[i] / c.adSales[i]) * 100 : null,
      spend: c.adSpend[i],
      spendPct: (c.adSpend[i] / tot.adSpend) * 100,
      sales: c.adSales[i],
      salesPct: (c.adSales[i] / tot.sales) * 100,
    }));
  }, [data, mode, i, view, products, live, wins]);

  // search and category narrow both sides, so the Good / Bad counts follow the filters
  const needle = q.trim().toLowerCase();
  const kept = lines.filter((l) => (!needle || `${l.name} ${l.sub}`.toLowerCase().includes(needle)) && (view !== "products" || cat === ALL_CATS || l.sub.endsWith(`· ${cat}`)));
  const good = kept.filter((l) => l.now !== null && l.now < TH);
  const bad = kept.filter((l) => !(l.now !== null && l.now < TH));
  // default: products by biggest improvement (Good) or worsening (Bad); campaigns and keywords by spend
  const val = (l: Line, k: SortKey) => (k === "change" ? (l.now !== null && l.prev !== null ? l.now - l.prev : -Infinity) : k === "now" ? (l.now ?? Infinity) : l[k]);
  const key: SortKey = sort?.key ?? (view === "products" ? "change" : "spend");
  const dir = sort?.dir ?? (view === "products" ? (side === "good" ? 1 : -1) : -1);
  const shown = (side === "good" ? good : bad).slice().sort((a, b) => (val(a, key) - val(b, key)) * dir);
  const head = (k: SortKey, label: string) => (
    <th scope="col" className={`n sortable${key === k ? " sorted" : ""}`} aria-sort={key === k ? (dir === -1 ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort({ key: k, dir: key === k ? ((dir * -1) as 1 | -1) : -1 })}>
        {label}
        <span className="arr" aria-hidden="true">
          {key === k ? (dir === -1 ? "↓" : "↑") : ""}
        </span>
      </button>
    </th>
  );
  const metric = view === "products" ? "TACoS" : "ACOS";

  return (
    <section id="wins" className="panel flush" aria-labelledby="wins-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="wins-h" className="ph">
            Wins &amp; TACoS
          </h2>
          <SampleTag when={view !== "products" && !(wins && mode === "weekly")} reason={wins ? "monthly campaign and keyword lists aren't stored" : undefined} />
          <Info label="Wins & TACoS">
            <p>
              Parents with at least €20 ad spend in the selected {unit} and sales in both {unit}s. TACoS = ad spend ÷ total sales; change in points vs the {unit} before. Good = below 15%, Bad = 15% or higher. Spend % and Sales % are shares of the account total.
            {view !== "products" ? " Campaigns and keywords use ACOS as the TACoS proxy, with the same 15% line." : ""}
            </p>
          </Info>
        </div>
        <div className="filters">
          <Select label={unit === "week" ? "Week" : "Month"} value={options[i]} options={options} onChange={(v) => setPicked({ mode, i: options.indexOf(v) })} />
        </div>
      </div>
      <div className="ph-row tools">
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "products", label: "Products" },
            { value: "campaigns", label: "Campaigns" },
            { value: "keywords", label: "Keywords" },
          ]}
        />
        <Segmented
          label="Side"
          value={side}
          onChange={setSide}
          options={[
            { value: "good", label: `Good · ${good.length}` },
            { value: "bad", label: `Bad · ${bad.length}` },
          ]}
        />
        <span className="tools-gap" />
        <div className="filters">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={view === "products" ? "Search product or ASIN" : view === "campaigns" ? "Search campaign" : "Search keyword"} aria-label="Search" />
          {view === "products" ? <Select label="Category" value={cat} onChange={setCat} options={cats} /> : null}
        </div>
      </div>
      <div className="tscroll tall">
        <table className="wins">
          <thead>
            <tr>
              <th scope="col">{view === "products" ? "Product (parent)" : view === "campaigns" ? "Campaign" : "Keyword"}</th>
              <th scope="col" className="n">
                {metric} prev
              </th>
              {head("now", metric)}
              {head("change", "Change")}
              {head("spend", "Ad spend")}
              <th scope="col" className="n">
                Spend %
              </th>
              {head("sales", view === "products" ? "Sales" : "Ad sales")}
              <th scope="col" className="n">
                Sales %
              </th>
            </tr>
          </thead>
          <tbody key={`${mode}${i}${view}${side}`} className="swap">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  {needle || cat !== ALL_CATS ? "Nothing matches the search or category." : `Nothing on the ${side} side this ${unit}.`}
                </td>
              </tr>
            ) : null}
            {shown.map((l) => {
              const d = l.now !== null && l.prev !== null ? l.now - l.prev : null;
              return (
                <tr key={l.key}>
                  <th scope="row">
                    <span className={st.nm}>
                      {l.name}
                      {l.deal ? <span className={st.tag}>Prime Day deal</span> : null}
                    </span>
                    <small>{l.sub}</small>
                  </th>
                  <td className="n">{pp(l.prev)}</td>
                  <td className="n strong">{pp(l.now)}</td>
                  <td className="n">{d === null ? <span className="na">–</span> : <span className={`dl ${d < 0 ? "good" : "bad"}`}>{`${d > 0 ? "+" : d < 0 ? "−" : ""}${pct2.format(Math.abs(d))} pp`}</span>}</td>
                  <td className="n">{eur2.format(l.spend)}</td>
                  <td className="n">{pct1.format(l.spendPct)}%</td>
                  <td className="n">{eur.format(l.sales)}</td>
                  <td className="n">{pct1.format(l.salesPct)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
