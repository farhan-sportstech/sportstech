"use client";

import { useState } from "react";
import { monthly, noAdSales, weekly, type NoSale, type Period } from "@/lib/mock";

export type NoSaleSet = { products: NoSale[]; campaigns: NoSale[]; keywords: NoSale[] };
import { eur, eur2, int } from "@/lib/format";
import { SampleTag } from "@/lib/homeData";
import Info from "./Info";
import Segmented from "./Segmented";
import Select from "./Select";

type View = "products" | "campaigns" | "keywords";
type SortKey = "adSpend" | "clicks" | "impressions" | "sales";
const sum = (a: NoSale[]) => a.reduce((t, z) => t + z.adSpend, 0);
const MIN = ["Any spend", "€5+ spend", "€20+ spend", "€50+ spend"];
const minOf = (s: string) => Number(s.replace(/\D/g, "")) || 0;

/** Whole account by default; category pages pass their own periods and sets. */
export default function NoAdSales({ mode, source, scope }: { mode: "weekly" | "monthly"; source?: { periods: Period[]; sets: NoSaleSet[] }; scope?: string }) {
  const periods = source?.periods ?? (mode === "weekly" ? weekly : monthly).periods;
  const sets = source?.sets ?? noAdSales[mode];
  const unit = mode === "weekly" ? "week" : "month";
  const options = periods.map((p) => `${p.kw} · ${p.label}`);
  const [picked, setPicked] = useState({ mode, i: 0 });
  const [view, setView] = useState<View>("products");
  const [q, setQ] = useState("");
  const [min, setMin] = useState(MIN[0]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "adSpend", dir: -1 });
  const i = picked.mode === mode ? picked.i : 0;
  const set = sets[i];
  const needle = q.trim().toLowerCase();
  const val = (z: NoSale) => (sort.key === "sales" ? (z.sales ?? -1) : z[sort.key]);
  const rows = set[view].filter((z) => z.adSpend >= minOf(min) && (!needle || `${z.name} ${z.sub}`.toLowerCase().includes(needle))).sort((a, b) => (val(a) - val(b)) * sort.dir);
  const total = sum(rows);
  const filtered = needle !== "" || minOf(min) > 0;
  const head = (k: SortKey, label: string, sub?: string) => (
    <th scope="col" className={`n sortable${sort.key === k ? " sorted" : ""}`} aria-sort={sort.key === k ? (sort.dir === -1 ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => (s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: -1 }))}>
        {label}
        <span className="arr" aria-hidden="true">
          {sort.key === k ? (sort.dir === -1 ? "↓" : "↑") : ""}
        </span>
      </button>
      {sub ? <small>{sub}</small> : null}
    </th>
  );

  return (
    <section id="nosales" className="panel flush" aria-labelledby="ns-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="ns-h" className="ph">
            Ad spend with no ad sales
          </h2>
          <SampleTag />
          <Info label="Ad spend with no ad sales">
            <p>
              {scope ? `${scope}: ad` : "Ad"} spend above €0 with €0 tool4seller ad sales in the selected {unit}.
            </p>
            <p>Total sales are all sales of that product (organic and ads, all channels), so a product can sell while its ads sold nothing.</p>
            <p>Campaigns are own campaigns only; shared catch-all campaigns are not split by product.</p>
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
            { value: "products", label: `Products · ${set.products.length}` },
            { value: "campaigns", label: `Campaigns · ${set.campaigns.length}` },
            { value: "keywords", label: `Keywords · ${set.keywords.length}` },
          ]}
        />
        <span className="tools-gap" />
        <div className="filters">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={view === "products" ? "Search product or ASIN" : view === "campaigns" ? "Search campaign" : "Search keyword"} aria-label="Search" />
          <Select label="Minimum ad spend" value={min} onChange={setMin} options={MIN} />
        </div>
      </div>
      <p className="tot" style={{ padding: "0 24px 14px" }}>
        {filtered ? (
          <>
            <b>{rows.length}</b> shown · <b>{eur2.format(total)}</b> of {eur2.format(sum(set[view]))} with €0 ad sales this {unit}
          </>
        ) : (
          <>
            <b>{eur2.format(sum(set.products) + sum(set.campaigns) + sum(set.keywords))}</b> spent with €0 ad sales this {unit}
          </>
        )}
      </p>
      <div className="tscroll">
        <table className="ns">
          <thead>
            <tr>
              <th scope="col">{view === "products" ? "Product (child ASIN)" : view === "campaigns" ? "Campaign" : "Keyword"}</th>
              {head("adSpend", "Ad spend")}
              <th scope="col" className="n">
                Ad sales
              </th>
              {head("clicks", "Clicks")}
              {head("impressions", "Impr.")}
              {view === "products" ? head("sales", "Total sales", "all channels") : null}
            </tr>
          </thead>
          <tbody key={`${mode}${i}${view}`} className="swap">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  {filtered ? "Nothing matches the search or minimum spend." : `None this ${unit}.`}
                </td>
              </tr>
            ) : null}
            {rows.map((z, n) => (
              <tr key={`${z.name}${n}`}>
                <th scope="row">
                  {z.name}
                  <small>{z.sub}</small>
                </th>
                <td className="n strong">{eur2.format(z.adSpend)}</td>
                <td className="n zero">€0,00</td>
                <td className="n">{int.format(z.clicks)}</td>
                <td className="n">{int.format(z.impressions)}</td>
                {view === "products" ? <td className="n">{z.sales === null ? <span className="na">—</span> : eur.format(z.sales)}</td> : null}
              </tr>
            ))}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className="n">{eur2.format(total)}</td>
                <td className="n">€0,00</td>
                <td className="n">{int.format(rows.reduce((t, z) => t + z.clicks, 0))}</td>
                <td className="n">{int.format(rows.reduce((t, z) => t + z.impressions, 0))}</td>
                {view === "products" ? <td /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}
