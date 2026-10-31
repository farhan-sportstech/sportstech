"use client";

import { useMemo, useState } from "react";
import type { CategoryData } from "@/lib/category";
import { GAPS, productGaps, type Gap, type GapRow } from "@/lib/kwgaps";
import { eur2, int } from "@/lib/format";
import { cx } from "@/lib/cx";
import Info from "../Info";
import Select from "../Select";
import st from "./KeywordGaps.module.css";

type SortKey = "q" | "sv" | "trend" | "org" | "ks" | "sqp" | "spend" | "orders" | "gaps";
const PAGE = 40;
const GAP_KEY: Record<Gap, string> = {
  "Not targeted": "g1",
  "No Exact": "g2",
  "Converting, no own Exact": "g3",
  "Weak organic, no ads": "g4",
  "Spend, no sales": "g5",
};

export default function KeywordGaps({ data, family }: { data: CategoryData; family: string }) {
  const products = data.pick(family);
  const labels = products.map((p) => `${p.name} · ${p.asin}`);
  const [picked, setPicked] = useState(labels[0]);
  const [gap, setGap] = useState<Gap | "">("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "sv", dir: -1 });
  const [all, setAll] = useState(false);
  const idx = Math.max(0, labels.indexOf(picked));
  const product = products[idx];

  const rows = useMemo(() => (product ? productGaps(data, product.asin) : []), [data, product]);
  const count = (g: Gap) => rows.filter((r) => r.gaps.includes(g)).length;
  // the gap filter is a dropdown like every other filter; each option carries its count
  const gapLabel = (g: Gap | "") => (g ? `${g} · ${count(g)}` : `All gap types · ${rows.length}`);
  const gapOptions = ["", ...GAPS].map((g) => gapLabel(g as Gap | ""));
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const val = (r: GapRow): number | string | null => (sort.key === "gaps" ? r.gaps.length : r[sort.key]);
    return rows
      .filter((r) => (!gap || r.gaps.includes(gap)) && (!needle || r.q.includes(needle)))
      .sort((a, b) => {
        const x = val(a);
        const y = val(b);
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
      });
  }, [rows, gap, q, sort]);
  const shown = all ? list : list.slice(0, PAGE);

  const head = (k: SortKey, label: string, title?: string, left = false) => (
    <th scope="col" title={title} className={cx(!left && "n", "sortable", sort.key === k && "sorted")} aria-sort={sort.key === k ? (sort.dir === -1 ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => (s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: k === "q" || k === "org" ? 1 : -1 }))}>
        {label}
        <span className="arr" aria-hidden="true">
          {sort.key === k ? (sort.dir === -1 ? "↓" : "↑") : ""}
        </span>
      </button>
    </th>
  );

  return (
    <section id="kwgaps" className="panel flush" aria-labelledby="kg-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="kg-h" className="ph">
            Keyword gaps per product
          </h2>
          <Info label="Keyword gaps">
            <p>Every keyword a product is shown for (Helium 10 Cerebro and the SQP ASIN view) against what its own campaigns target today.</p>
            <p>
              <b>Not targeted</b>: no own keyword at all. <b>No Exact</b>: only Phrase or Broad. <b>Converting, no own Exact</b>: it sells through Phrase or Broad, so an Exact keyword would control the bid. <b>Weak organic, no ads</b>: not on page 1 and not advertised. <b>Spend, no sales</b>: ad spend over 5 weeks with no order.
            </p>
            <p>Ad figures come only from ad groups that advertise this product alone; shared ad groups are never split.</p>
          </Info>
        </div>
        <p className="tot">
          <b>{int.format(rows.length)}</b> keywords · <b>{int.format(rows.filter((r) => r.gaps.length).length)}</b> with a gap
        </p>
      </div>

      <div className="ph-row tools">
        <div className="filters">
          <Select label="Product" value={labels[idx]} options={labels} onChange={(v) => { setPicked(v); setGap(""); }} />
          <Select label="Gap type" value={gapLabel(gap)} options={gapOptions} onChange={(v) => setGap(GAPS.find((g) => gapLabel(g) === v) ?? "")} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search keyword" aria-label="Search keywords" />
        </div>
      </div>

      <div className="tscroll tall">
        <table className={st.kg}>
          <thead>
            <tr>
              {head("q", "Keyword", undefined, true)}
              {head("sv", "Search vol.", "Helium 10 Cerebro, monthly estimate")}
              {head("trend", "Trend", "Search volume trend, %")}
              {head("org", "Org. rank", "Cerebro organic rank")}
              <th scope="col" className="n" title="Cerebro sponsored rank">
                Spons. rank
              </th>
              {head("ks", "Kw sales", "Cerebro keyword sales, monthly estimate")}
              <th scope="col" className="n" title="Giveaways over 8 days to reach page 1">
                CPR
              </th>
              <th scope="col" className="n" title="Competing products">
                Competing
              </th>
              {head("sqp", "SQP vol.", "SQP ASIN view, latest week")}
              <th scope="col">Targeted as</th>
              {head("spend", "Ad spend", "Own ad groups, 5 weeks")}
              {head("orders", "Ad orders", "Own ad groups, 5 weeks")}
              {head("gaps", "Gap", undefined, true)}
            </tr>
          </thead>
          <tbody key={`${product?.asin}${gap}`} className="swap">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={13} className="empty">
                  No keywords match this filter.
                </td>
              </tr>
            ) : null}
            {shown.map((r) => (
              <tr key={r.q}>
                <th scope="row" className={st.kw}>
                  {r.q}
                </th>
                <td className="n">{int.format(r.sv)}</td>
                <td className={cx("n", r.trend > 0 ? st.up : r.trend < 0 ? st.down : undefined)}>
                  {r.trend > 0 ? "+" : r.trend < 0 ? "−" : ""}
                  {Math.abs(r.trend)}%
                </td>
                <td className="n">{r.org === null ? <span className="na">not ranked</span> : <span className={cx(st.rk, r.org <= 20 ? st.p1 : r.org <= 40 ? st.p2 : st.p3)}>#{r.org}</span>}</td>
                <td className="n">{r.spr === null ? <span className="na">—</span> : `#${r.spr}`}</td>
                <td className="n">{int.format(r.ks)}</td>
                <td className="n">{int.format(r.cpr)}</td>
                <td className="n">{int.format(r.comp)}</td>
                <td className="n">{r.sqp === null ? <span className="na">not in SQP</span> : int.format(r.sqp)}</td>
                <td>{r.match.length ? <span className={st.mt}>{r.match.map((m) => (m === "Product (PAT)" ? "PAT" : m)).join(" · ")}</span> : <span className="na">not targeted</span>}</td>
                <td className="n">{r.spend ? eur2.format(r.spend) : <span className="na">—</span>}</td>
                <td className="n">{r.spend ? int.format(r.orders) : <span className="na">—</span>}</td>
                <td>
                  {r.gaps.length ? (
                    <span className={st.tags}>
                      {r.gaps.map((g) => (
                        <span key={g} className={cx(st.tag, st[GAP_KEY[g]])}>
                          {g}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="na">no gap</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > PAGE ? (
        <div className={st.more}>
          <button type="button" className="btn sm" onClick={() => setAll((a) => !a)}>
            {all ? `Show top ${PAGE}` : `Show all ${int.format(list.length)}`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
