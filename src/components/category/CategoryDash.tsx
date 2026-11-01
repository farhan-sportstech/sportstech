"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { getCategory, type Mode, type OverallRow } from "@/lib/category";
import type { CatRaw } from "@/lib/data/category";
import { meta } from "@/lib/mock";
import { acos, change, eur, eur2, int, pct1, pct2, tacos } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { cx } from "@/lib/cx";
import { useReveal } from "@/lib/motion";
import Bars from "../Bars";
import Comparisons from "../Comparisons";
import CountUp, { type CountKind } from "../CountUp";
import Delta from "../Delta";
import Info from "../Info";
import Notes from "../Notes";
import Overview from "../Overview";
import PriceBsr from "../PriceBsr";
import SectionNav from "../SectionNav";
import Segmented from "../Segmented";
import d from "../dash.module.css";
import AdTypes from "./AdTypes";
import CategoryProducts from "./CategoryProducts";
import KeywordCoverage from "./KeywordCoverage";
import SearchQueries from "./SearchQueries";
import BrandedSplit from "./BrandedSplit";
import Campaigns from "./Campaigns";
import Placements from "./Placements";
import OrganicRank from "./OrganicRank";
import NoAdSales from "../NoAdSales";
import KeywordGaps from "./KeywordGaps";
import ProductDetail from "./ProductDetail";
import ReportBuilder from "./ReportBuilder";
import { categoryNoSales } from "@/lib/ads";
import KeywordsTargets from "./KeywordsTargets";
import Matrix from "./Matrix";
import Overall from "./Overall";
import { organicShare } from "@/lib/metrics";
import st from "./CategoryDash.module.css";

// four groups in page order: sales, advertising, keywords and search, then one product in detail
const SECTIONS = [
  { id: "summary", label: "Summary", group: "Sales" },
  { id: "overview", label: "Overview", group: "Sales" },
  { id: "overall", label: "Overall", group: "Sales" },
  { id: "comparisons", label: "Comparisons", group: "Sales" },
  { id: "products", label: "Products", group: "Sales" },
  { id: "price", label: "Price & BSR", group: "Sales" },
  { id: "matrix", label: "Weekly matrix", group: "Sales" },
  { id: "adtype", label: "Ad types", group: "Advertising" },
  { id: "campaigns", label: "Campaigns", group: "Advertising" },
  { id: "placements", label: "Placements", group: "Advertising" },
  { id: "branded", label: "Branded", group: "Advertising" },
  { id: "nosales", label: "No ad sales", group: "Advertising" },
  { id: "keywords", label: "Keywords", group: "Keywords" },
  { id: "coverage", label: "Coverage", group: "Keywords" },
  { id: "queries", label: "Search queries", group: "Keywords" },
  { id: "rank", label: "Organic rank", group: "Keywords" },
  { id: "kwgaps", label: "Keyword gaps", group: "Keywords" },
  { id: "detail", label: "Product detail", group: "Product" },
];

const pctFmt = (v: number) => `${pct1.format(v)}%`;
const MINIS: { label: string; kind: CountKind; get: (r: OverallRow) => number; fmt: (v: number) => string; ratio?: boolean; goodWhen: "up" | "down" | "none" }[] = [
  { label: "Ad spend", kind: "eur", get: (r) => r.adSpend, fmt: (v) => eur.format(v), goodWhen: "none" },
  { label: "ACOS", kind: "pct", get: acos, fmt: pctFmt, ratio: true, goodWhen: "down" },
  { label: "TACoS", kind: "pct", get: tacos, fmt: pctFmt, ratio: true, goodWhen: "down" },
  { label: "Sessions", kind: "int", get: (r) => r.sessions, fmt: (v) => int.format(v), goodWhen: "up" },
  { label: "Organic share", kind: "pct", get: organicShare, fmt: pctFmt, ratio: true, goodWhen: "up" },
  { label: "Units", kind: "int", get: (r) => r.units, fmt: (v) => int.format(v), goodWhen: "up" },
];

export default function CategoryDash({ slug, raw }: { slug: string; raw?: CatRaw | null }) {
  const data = useMemo(() => getCategory(slug, raw)!, [slug, raw]);
  const { def } = data;
  const [mode, setMode] = useState<Mode>("weekly");
  const [family, setFamily] = useState("");
  const [copied, setCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const summary = useRef<HTMLUListElement>(null);
  useReveal(page);

  const periods = data.periods[mode];
  const noSales = useMemo(() => categoryNoSales(data, mode, family), [data, mode, family]);
  const [cur, prev] = periods;
  const totals = data.totals(family, mode);
  const t = totals[0];
  const p = totals[1];
  const unit = mode === "weekly" ? "week" : "month";
  const scopeName = family || `All ${def.plural}`;
  const products = data.pick(family);
  const families = family ? data.families.filter((f) => f.name === family) : data.families;
  const labels = periods.map((x) => x.kw);
  const up = t.sales >= p.sales;
  const sb = data.adTypes(family, mode).find((a) => !a.perAsin)!;
  const aov = data.aov(family);

  const breakdown = (family || data.families.length === 1 ? products.map((x) => ({ name: x.name, row: x[mode][0] })) : data.families.map((f) => ({ name: f.name, row: data.totals(f.name, mode)[0] })))
    .sort((a, b) => b.row.sales - a.row.sales)
    .slice(0, 3);
  const movers = products
    .filter((x) => x[mode][1].sales > 0)
    .map((x) => ({ name: x.name, d: change(x[mode][0].sales, x[mode][1].sales) }))
    .sort((a, b) => b.d - a.d);

  const copySummary = async () => {
    const text = [`Summary · ${cur.kw} (${cur.label}) · ${scopeName}`, ...Array.from(summary.current?.children ?? []).map((li) => `• ${(li as HTMLElement).innerText.replace(/\s+/g, " ").trim()}`)].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  const exportCsv = () =>
    downloadCsv(`sportstech-${def.slug}-${mode}-${cur.kw.replace(/\s+/g, "")}.csv`, [
      ["Family", "Product", "ASIN", ...periods.map((x) => `Sales ${x.kw}`), "Units", "Ad spend", "Ad sales", "ACOS %", "TACoS %"],
      ...families.flatMap((f) =>
        f.products.map((x) => {
          const r = x[mode];
          return [f.name, x.name, x.asin, ...r.map((y) => y.sales), r[0].units, r[0].adSpend, r[0].adSales, Math.round(acos(r[0]) * 10) / 10, Math.round(tacos(r[0]) * 10) / 10];
        }),
      ),
    ]);

  const avg = {
    periods,
    byAsin: Object.fromEntries(products.map((x) => [x.asin, x[mode].map((r) => (r.units ? r.sales / r.units : null))])),
  };

  return (
    <div className="wdp" ref={page}>
      <header className={d["pg-head"]}>
        <div className="pg-title">
          <Link href="/" className={st.back}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
            All products
          </Link>
          <div className={d["pg-h"]}>
            <h1>{def.title}</h1>
            <span key={cur.key} className={d["pg-kw"]}>
              {cur.kw}
              <small>{cur.label}</small>
            </span>
            <Info label={def.title}>
              <p>
                The Sportstech {def.plural} line-up on Amazon.de: {data.products.length} products, {data.products.reduce((a, x) => a + x.variants.length, 0)} ASINs (same category mapping as the main page), over the five most recent ISO {unit}s. Data through {meta.dataThrough}.
              </p>
              <p>Where a product has several ASINs they are summed per {unit}, so a relisted ASIN keeps the trend continuous. Pick a family to narrow every section to it.</p>
            </Info>
          </div>
          <p className={d.meta}>
            {meta.marketplace} · {meta.currency} · Category ·{" "}
            {raw?.asOf ? `live data, loaded ${new Date(raw.asOf).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}` : `sample data · Data through ${meta.dataThrough}`}
          </p>
        </div>
        <div className={d["pg-ctl"]}>
          <button type="button" className="btn" aria-expanded={reportOpen} aria-controls="report" onClick={() => setReportOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />
            </svg>
            {reportOpen ? "Close report builder" : "Build report"}
          </button>
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

      <ReportBuilder key={`rb${family}${mode}`} data={data} family={family} mode={mode} open={reportOpen} />

      {data.families.length > 1 ? (
        <div className={st.fams}>
          <Segmented label="Family" size="sm" value={family} onChange={setFamily} options={[{ value: "", label: `All ${def.plural}` }, ...data.families.map((f) => ({ value: f.name, label: f.name }))]} />
        </div>
      ) : null}

      <SectionNav sections={SECTIONS} />

      <div id="summary" className="stack">
        <section className="panel" aria-labelledby="sum-h">
          <div className={d["sum-hd"]}>
            <h2 id="sum-h" className="ph">
              {cur.kw} · {cur.label} · {scopeName}
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
              sales from <b>{int.format(t.units)}</b> units, {up ? "up" : "down"} <b className={up ? d.up : d.down}>{pct1.format(Math.abs(change(t.sales, p.sales)))}%</b> on the {unit} before ({prev.kw}). Sessions{" "}
              <b>{int.format(t.sessions)}</b>, unit session <b>{pct2.format(t.sessions ? (t.units / t.sessions) * 100 : 0)}%</b>.
            </li>
            <li>
              Ad spend <b>{eur2.format(t.adSpend)}</b> (<Delta value={change(t.adSpend, p.adSpend)} goodWhen="none" />
              ). ACOS <b>{pct1.format(acos(t))}%</b>, TACoS <b>{pct2.format(tacos(t))}%</b>, organic share <b>{pct1.format(organicShare(t))}%</b>.
            </li>
            <li>
              By {family || data.families.length === 1 ? "product" : "family"}:{" "}
              {breakdown.map((b, i) => (
                <span key={b.name}>
                  <b>{b.name}</b> {eur.format(b.row.sales)} (ACOS {pct1.format(acos(b.row))}%){i < breakdown.length - 1 ? ", " : "."}
                </span>
              ))}
            </li>
            {movers.length > 1 ? (
              <li>
                Biggest mover up: <b>{movers[0].name}</b> <Delta value={movers[0].d} />. Biggest down: <b>{movers[movers.length - 1].name}</b> <Delta value={movers[movers.length - 1].d} />.
              </li>
            ) : null}
            <li>
              Sponsored Brands, kept out of the product numbers: <b>{eur2.format(sb.spend[0])}</b> spend for {eur.format(sb.sales[0])} campaign-attributed sales.
            </li>
          </ul>
        </section>

        <section className={d.glance} aria-label="Key numbers">
          <div className={d.lead}>
            <div className={d["lead-hd"]}>
              <span className={d.l}>
                Total sales <small>{cur.kw} · {cur.label}</small>
              </span>
              <span className={d.d}>
                <Delta value={change(t.sales, p.sales)} /> vs {prev.kw}
              </span>
            </div>
            <span className={d.v}>
              <CountUp value={t.sales} kind="eur" />
            </span>
            <Bars key={mode + family} values={totals.map((x) => x.sales)} labels={labels} format={eur.format} size="lg" />
          </div>
          <div className={cx(d.minis, st.minis3)}>
            {MINIS.map((k) => (
              <div key={k.label} className={d.kpi}>
                <span className={d.l}>{k.label}</span>
                <span className={d.v}>
                  <CountUp value={k.get(t)} kind={k.kind} />
                </span>
                <span className={d.d}>
                  <Delta value={k.ratio ? k.get(t) - k.get(p) : change(k.get(t), k.get(p))} unit={k.ratio ? " pp" : "%"} goodWhen={k.goodWhen} /> vs {prev.kw}
                </span>
                <Bars key={mode + family} className={d.kbars} values={totals.map(k.get)} labels={labels} format={k.fmt} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <Overview
        key={`ov${family}`}
        data={data.overview(family)}
        scope={family ? `${family} only` : "This category"}
        extended
        extra={
          <details className={st.aov}>
            <summary>
              <span>Active products &amp; High / Low AOV</span>
              <span className={st.pill}>{aov.active} active</span>
              {aov.inactive ? <span className={cx(st.pill, st.off)}>{aov.inactive} inactive</span> : null}
              <span className={st.aovNote}>
                AOV cut {eur.format(aov.cut)} · High {aov.high} / Low {aov.low} · last 30 days
              </span>
            </summary>
            <div className={st.aovBody}>
              <table className={st.aovT}>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    {data.families.length > 1 ? <th scope="col">Family</th> : null}
                    <th scope="col" className="n">
                      Orders
                    </th>
                    <th scope="col" className="n">
                      Sales
                    </th>
                    <th scope="col" className="n">
                      Ad spend
                    </th>
                    <th scope="col" className="n">
                      AOV
                    </th>
                    <th scope="col">Band</th>
                  </tr>
                </thead>
                <tbody>
                  {aov.items.map((x, i) => (
                    <tr key={x.asin} className={cx(!x.active && st.dim)} style={{ "--i": i } as CSSProperties}>
                      <th scope="row">
                        {x.name}
                        <small>{x.asin}</small>
                      </th>
                      {data.families.length > 1 ? <td>{x.family}</td> : null}
                      <td className="n">{int.format(x.orders)}</td>
                      <td className="n">{eur.format(x.sales)}</td>
                      <td className="n">{eur2.format(x.adSpend)}</td>
                      <td className="n strong">{x.aov === null ? <span className="na">—</span> : eur.format(x.aov)}</td>
                      <td>{x.active ? <span className={cx(st.band, x.band === "High" ? st.hi : st.lo)}>{x.band}</span> : <span className={cx(st.pill, st.off)}>inactive</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Active means sales or ad spend in the last 30 days. AOV is sales ÷ orders per listing. The cut ({eur.format(aov.cut)}) is the median AOV of active listings with orders: at or above it is High, below it is Low.
              </p>
            </div>
          </details>
        }
      />
      <Overall title={scopeName} periods={periods} rows={totals} mode={mode} />
      <Comparisons
        key={`cmp${family}`}
        mode={mode}
        scope={family ? `${family}` : "This category"}
        source={{ periods, totals, ly: data.lastYear(family, mode), deals: data.deals[mode] }}
        toDate={data.toDate(family)}
        sample={data.live ? "per-period last year is sample; the to-date view is real" : undefined}
      />
      <CategoryProducts families={families} periods={periods} mode={mode} plural={def.plural} listings={data.listings(family)} />
      <PriceBsr key={`pb${family}`} items={data.listings(family)} avg={avg} snapshots={raw?.snapshots} />
      <Matrix data={data} family={family} mode={mode} />
      {/* advertising */}
      <AdTypes
        periods={periods}
        types={data.adTypes(family, mode)}
        mode={mode}
        sample={data.live && !(data.real.adTypes && !family) ? (data.real.adTypes ? "the ad-type report covers the whole category only" : "no ad-type report for this category yet") : undefined}
      />
      <Campaigns data={data} family={family} mode={mode} periods={periods} />
      <Placements data={data} family={family} mode={mode} />
      <BrandedSplit data={data} family={family} mode={mode} periods={periods} />
      <NoAdSales mode={mode} scope={family || `All ${def.plural}`} source={{ periods, sets: noSales }} sample={data.live ? "not connected to the database yet" : undefined} />
      {/* keywords and search */}
      <KeywordsTargets data={data} family={family} mode={mode} periods={periods} />
      <KeywordCoverage data={data} family={family} mode={mode} />
      <SearchQueries data={data} family={family} mode={mode} periods={periods} />
      <OrganicRank key={`rank${family}`} data={data} family={family} />
      <KeywordGaps key={`kg${family}`} data={data} family={family} />
      {/* one product, all of the above */}
      <ProductDetail key={`pd${family}`} data={data} family={family} mode={mode} periods={periods} />
    </div>
  );
}
