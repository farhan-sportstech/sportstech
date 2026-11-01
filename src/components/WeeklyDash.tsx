"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { Dataset, Row } from "@/lib/mock";
import { useHomeData } from "@/lib/homeData";
import { acos, change, eur, eur2, int, pct1, pct2, sumRows, tacos } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import Bars from "./Bars";
import CountUp, { type CountKind } from "./CountUp";
import Delta from "./Delta";
import Comparisons from "./Comparisons";
import NoAdSales from "./NoAdSales";
import Notes from "./Notes";
import Overview from "./Overview";
import PriceBsr from "./PriceBsr";
import Products from "./Products";
import SectionNav from "./SectionNav";
import Wins from "./Wins";
import Segmented from "./Segmented";
import Icon from "./NavIcon";
import d from "./dash.module.css";
import Info from "./Info";
import { useFlip, useReveal } from "@/lib/motion";

type SortKey = "sales" | "delta" | "acos" | "tacos";

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "overview", label: "Overview" },
  { id: "comparisons", label: "Comparisons" },
  { id: "categories", label: "Categories" },
  { id: "products", label: "All products" },
  { id: "wins", label: "Wins & TACoS" },
  { id: "price", label: "Price & BSR" },
  { id: "nosales", label: "No ad sales" },
];

const CAT_HREF: Record<string, string> = {
  Treadmills: "/treadmills/",
  "Exercise bikes": "/exercise-bikes/",
  "Vibration plates": "/vibration-plates/",
  "Cross trainers": "/cross-trainers/",
  "Rowing machines": "/rowing-machines/",
  "Strength stations": "/strength-training/",
  "Benches & weights": "/benches-weights/",
  "Small equipment": "/small-equipment/",
  "Hoverboards & scooters": "/hoverboards-scooters/",
  Trampolines: "/trampolines/",
};

const pctFmt = (v: number) => `${pct1.format(v)}%`;

// The four secondary tiles beside the Sales lead; ratios compare in percentage points.
const MINIS: { label: string; kind: CountKind; get: (r: Row) => number; fmt: (v: number) => string; ratio?: boolean; goodWhen: "up" | "down" | "none" }[] = [
  { label: "Units", kind: "int", get: (r) => r.units, fmt: (v) => int.format(v), goodWhen: "up" },
  { label: "Ad spend", kind: "eur", get: (r) => r.adSpend, fmt: (v) => eur.format(v), goodWhen: "none" },
  { label: "ACOS", kind: "pct", get: acos, fmt: pctFmt, ratio: true, goodWhen: "down" },
  { label: "TACoS", kind: "pct", get: tacos, fmt: pctFmt, ratio: true, goodWhen: "down" },
];

export default function WeeklyDash() {
  const { meta, monthly, overview, products, sbsd, weekly, live } = useHomeData();
  const [mode, setMode] = useState<"weekly" | "monthly">("weekly");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "sales", dir: -1 });
  const data: Dataset = mode === "weekly" ? weekly : monthly;
  const [cur, prev] = data.periods;
  const page = useRef<HTMLDivElement>(null);
  const catBody = useRef<HTMLTableSectionElement>(null);
  useReveal(page);
  useFlip(catBody, `${sort.key}${sort.dir}${mode}`);

  const totals = useMemo(() => data.periods.map((_, i) => sumRows(data.categories.map((c) => c.rows[i]))), [data]);
  const t = totals[0];
  const p = totals[1];

  const rows = useMemo(() => {
    const list = data.categories.map((c) => ({
      name: c.name,
      series: c.rows,
      delta: change(c.rows[0].sales, c.rows[1].sales),
      acos: acos(c.rows[0]),
      tacos: tacos(c.rows[0]),
    }));
    const val = (r: (typeof list)[number]) => (sort.key === "sales" ? r.series[0].sales : r[sort.key]);
    return list.sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [data, sort]);

  const movers = useMemo(() => {
    const big = data.categories.filter((c) => c.rows[1].sales > 5000);
    const byDelta = [...big].sort((a, b) => change(b.rows[0].sales, b.rows[1].sales) - change(a.rows[0].sales, a.rows[1].sales));
    const spendy = data.categories.filter((c) => c.rows[0].adSpend > 500).sort((a, b) => acos(b.rows[0]) - acos(a.rows[0]));
    return { up: byDelta[0], down: byDelta[byDelta.length - 1], hot: spendy[0] };
  }, [data]);

  const [copied, setCopied] = useState(false);
  const summary = useRef<HTMLUListElement>(null);
  const ov = overview[mode][0];
  const parents = products.filter((pr) => pr[mode][0].sales > 0).length;
  const organic = t.sales ? (Math.max(0, t.sales - t.adSales) / t.sales) * 100 : 0;
  const hotProduct = products
    .filter((pr) => pr[mode][0].adSpend > 150)
    .sort((a, b) => acos(b[mode][0]) - acos(a[mode][0]))[0];
  const copySummary = async () => {
    const text = [`Summary · ${cur.kw} · ${cur.label} · whole account`, ...Array.from(summary.current?.children ?? []).map((li) => `• ${(li as HTMLElement).innerText.replace(/\s+/g, " ").trim()}`)].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  const exportCsv = () =>
    downloadCsv(`sportstech-${mode}-${cur.kw.replace(/\s+/g, "")}.csv`, [
      ["Product", "ASIN", "Category", ...data.periods.map((pd) => `Sales ${pd.kw}`), "Units", "Ad spend", "Ad sales", "ACOS %", "TACoS %"],
      ...products.map((pr) => {
        const r = pr[mode];
        return [pr.name, pr.asin, pr.category, ...r.map((x) => x.sales), r[0].units, r[0].adSpend, r[0].adSales, Math.round(acos(r[0]) * 10) / 10, Math.round(tacos(r[0]) * 10) / 10];
      }),
    ]);

  const top = [...data.categories].sort((a, b) => b.rows[0].sales - a.rows[0].sales)[0];
  const labels = data.periods.map((pd) => pd.kw);
  const maxCur = Math.max(...data.categories.map((c) => c.rows[0].sales));
  const up = t.sales >= p.sales;
  const periodWord = mode === "weekly" ? "week" : "month";

  const head = (key: SortKey, label: string) => (
    <th scope="col" className={`n sortable${sort.key === key ? " sorted" : ""}`} aria-sort={sort.key === key ? (sort.dir === -1 ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }))}>
        {label}
        <span className="arr" aria-hidden="true">
          <Icon name="chev" className="ic" />
        </span>
      </button>
    </th>
  );

  return (
    <div className="wdp" ref={page}>
      <header className={d['pg-head']}>
        <div className="pg-title">
          <div className={d['pg-h']}>
            <h1>Weekly Dash</h1>
            <span key={cur.key} className={d['pg-kw']}>
              {cur.kw}
              <small>{cur.label}</small>
            </span>
          </div>
          <p className={d.meta}>
            {meta.marketplace} · {meta.currency} · All products · Data through {meta.dataThrough} · {live ? `Loaded ${meta.lastRefresh}` : `Sample data, refreshed ${meta.lastRefresh}`}
          </p>
        </div>
        <div className={d['pg-ctl']}>
          <Notes />
          <button type="button" className="btn" onClick={exportCsv}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" />
            </svg>
            Download CSV
          </button>
          <Segmented
          label="Period"
          value={mode}
          onChange={setMode}
          options={[
            { value: "weekly", label: "Weekly · 5 wk" },
            { value: "monthly", label: "Monthly · 5 mo" },
          ]}
          />
        </div>
      </header>

      <SectionNav sections={SECTIONS} />

      <div id="summary" className="stack">
        <section className={d.glance} aria-label="Key numbers">
          <div className={d.lead}>
            <div className={d['lead-hd']}>
              <span className={d.l}>
                Sales <small>{cur.kw} · {cur.label}</small>
              </span>
              <span className={d.d}>
                <Delta value={change(t.sales, p.sales)} /> vs {prev.kw}
              </span>
            </div>
            <span className={d.v}>
              <CountUp value={t.sales} kind="eur" />
            </span>
            <Bars key={mode} values={totals.map((x) => x.sales)} labels={labels} format={eur.format} size="lg" />
          </div>
          <div className={d.minis}>
            {MINIS.map((k) => (
              <div key={k.label} className={d.kpi}>
                <span className={d.l}>{k.label}</span>
                <span className={d.v}>
                  <CountUp value={k.get(t)} kind={k.kind} />
                </span>
                <span className={d.d}>
                  <Delta value={k.ratio ? k.get(t) - k.get(p) : change(k.get(t), k.get(p))} unit={k.ratio ? " pp" : "%"} goodWhen={k.goodWhen} /> vs {prev.kw}
                </span>
                <Bars key={mode} className={d.kbars} values={totals.map(k.get)} labels={labels} format={k.fmt} />
              </div>
            ))}
          </div>
          <div className={d.sbsd}>
            <span className={d.l}>SB/SD not tied to a product</span>
            <b>{eur2.format(sbsd[mode][0].spend)}</b>
            <span>ad sales {eur.format(sbsd[mode][0].adSales)}</span>
            <span>store ads total {eur.format(t.adSpend + sbsd[mode][0].spend)}</span>
            <Info label="SB/SD not tied to a product">
              <p>Sponsored Brands and Display spend that tool4seller does not attribute to a product.</p>
              <p>It is not included in Ad spend, ACOS or TACoS above (tool4seller website basis). The store ads total includes it.</p>
            </Info>
          </div>
        </section>

        <section className="panel" aria-labelledby="sum-h">
          <div className={d['sum-hd']}>
            <h2 id="sum-h" className="ph">
              {cur.kw} · {cur.label}
            </h2>
            <button type="button" className="btn sm" onClick={copySummary} aria-live="polite">
              {copied ? "Copied" : "Copy as text"}
            </button>
          </div>
          <ul className={d.sum} ref={summary}>
            <li>
              <b>
                <CountUp value={t.sales} kind="eur" />
              </b>{" "}
              product sales from{" "}
              <b>
                <CountUp value={t.units} kind="int" />
              </b>{" "}
              units, {up ? "up" : "down"}{" "}
              <b className={up ? d.up : d.down}>
                <CountUp value={Math.abs(change(t.sales, p.sales))} kind="pct" />
              </b>{" "}
              on the {periodWord} before ({prev.kw}), across {parents} parents. Sessions <b>{ov.sessions === null ? "pending" : int.format(ov.sessions)}</b>, unit session{" "}
              <b>{ov.conversion === null ? "pending" : `${pct2.format(ov.conversion)}%`}</b>.
            </li>
            <li>
              Ad spend{" "}
              <b>
                <CountUp value={t.adSpend} kind="eur" />
              </b>{" "}
              (<Delta value={change(t.adSpend, p.adSpend)} goodWhen="none" />) for {eur.format(t.adSales)} ad sales. ACOS{" "}
              <b>
                <CountUp value={acos(t)} kind="pct" />
              </b>
              , TACoS{" "}
              <b>
                <CountUp value={tacos(t)} kind="pct" />
              </b>
              , organic share <b>{pct1.format(organic)}%</b>.
            </li>
            <li>
              <b>{top.name}</b> is {pct1.format((top.rows[0].sales / t.sales) * 100)}% of sales at {pct1.format(acos(top.rows[0]))}% ACOS.
            </li>
            <li>
              Biggest mover up: <b>{movers.up.name}</b> <Delta value={change(movers.up.rows[0].sales, movers.up.rows[1].sales)} />. Biggest down:{" "}
              <b>{movers.down.name}</b> <Delta value={change(movers.down.rows[0].sales, movers.down.rows[1].sales)} />.
            </li>
            <li>
              Highest ACOS with meaningful spend:{" "}
              {hotProduct ? (
                <>
                  <b>{hotProduct.name}</b> ({hotProduct.category}) at {pct1.format(acos(hotProduct[mode][0]))}% on {eur2.format(hotProduct[mode][0].adSpend)}.
                </>
              ) : (
                <>
                  <b>{movers.hot.name}</b> at {pct1.format(acos(movers.hot.rows[0]))}% on {eur.format(movers.hot.rows[0].adSpend)}.
                </>
              )}
            </li>
          </ul>
        </section>

      </div>

      <Overview />
      <Comparisons mode={mode} />

      <section id="categories" className="panel flush" aria-labelledby="cat-h">
        <div className="ph-row">
          <div className="ph-t">
            <h2 id="cat-h" className="ph">
              Categories
            </h2>
            <Info label="Categories">
              <p>Product sales per {periodWord}, current {periodWord} first. The bar under the current figure shows its size against the largest category.</p>
              <p>Click a category to open its page; click a column heading to sort.</p>
            </Info>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Category</th>
                {data.periods.map((pd, i) => (
                  <th key={pd.key} scope="col" className={`n${i === 0 ? " cur" : ""}`}>
                    {pd.kw}
                    <small>{pd.label}</small>
                  </th>
                ))}
                {head("delta", `vs ${prev.kw}`)}
                {head("acos", "ACOS")}
                {head("tacos", "TACoS")}
              </tr>
            </thead>
            <tbody ref={catBody}>
              {rows.map((r, ri) => (
                <tr key={r.name} data-flip={r.name}>
                  <th scope="row">
                    <Link href={CAT_HREF[r.name] ?? "/"} className="rowlink">
                      {r.name}
                    </Link>
                  </th>
                  {r.series.map((s, i) => (
                    <td key={i} className={`n${i === 0 ? " cur" : ""}`}>
                      {i === 0 ? <span key={mode} className={d.share} style={{ "--w": s.sales / maxCur, "--i": ri } as CSSProperties} aria-hidden="true" /> : null}
                      <span className={d.nv}>{eur.format(s.sales)}</span>
                    </td>
                  ))}
                  <td className="n">
                    <Delta value={r.delta} />
                  </td>
                  <td className="n">{pct1.format(r.acos)}%</td>
                  <td className="n">{pct1.format(r.tacos)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {totals.map((s, i) => (
                  <td key={i} className={`n${i === 0 ? " cur" : ""}`}>
                    {eur.format(s.sales)}
                  </td>
                ))}
                <td className="n">
                  <Delta value={change(t.sales, p.sales)} />
                </td>
                <td className="n">{pct1.format(acos(t))}%</td>
                <td className="n">{pct1.format(tacos(t))}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <Products mode={mode} prevLabel={prev.kw} />
      <Wins mode={mode} />
      <PriceBsr />
      <NoAdSales mode={mode} />
    </div>
  );
}
