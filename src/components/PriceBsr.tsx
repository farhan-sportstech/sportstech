"use client";

import { useMemo, useState } from "react";
import { listings, snapshots, type Listing, type Period } from "@/lib/mock";
import { eur, eur2, int } from "@/lib/format";
import Icon from "./NavIcon";
import st from "./PriceBsr.module.css";
import { cx } from "@/lib/cx";
import { SampleTag } from "@/lib/homeData";
import Info from "./Info";
import Select from "./Select";

type SortKey = "bsrSub" | "bsrMain" | "price";

/** Rank change: lower is better, so a smaller number reads as an improvement. */
function Rank({ now, prev }: { now: number; prev: number }) {
  const d = prev - now;
  return (
    <span className={st.rank}>
      <b>#{int.format(now)}</b>
      {d === 0 ? (
        <span className="dl flat">±0</span>
      ) : (
        <span className={`dl ${d > 0 ? "good" : "bad"}`}>
          <Icon name="chev" className={cx("ic", st.rk, d > 0 && st.up)} />
          {int.format(Math.abs(d))}
        </span>
      )}
    </span>
  );
}

type Avg = { periods: Period[]; byAsin: Record<string, (number | null)[]> }; // avg selling price per period; null = no units sold

/** Listed price and BSR per product. Category pages pass their own `items` (no category filter then)
 *  and `avg` to add the average selling price per period. */
export default function PriceBsr({ items = listings, avg }: { items?: Listing[]; avg?: Avg }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All categories");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "bsrSub", dir: 1 });
  const categories = useMemo(() => ["All categories", ...Array.from(new Set(items.map((l) => l.category)))], [items]);
  const showCat = categories.length > 2;

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items
      .filter((l) => (cat === "All categories" || l.category === cat) && (!n || `${l.name} ${l.asin} ${l.category}`.toLowerCase().includes(n)))
      .sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir);
  }, [q, cat, sort, items]);

  const head = (key: SortKey, label: string, sub: string) => (
    <th scope="col" className={`n sortable${sort.key === key ? " sorted" : ""}`} aria-sort={sort.key === key ? (sort.dir === -1 ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))}>
        <span>
          {label}
          <small>{sub}</small>
        </span>
        <span className="arr" aria-hidden="true">
          <Icon name="chev" className="ic" />
        </span>
      </button>
    </th>
  );

  const price = (l: Listing) => {
    const d = l.price - l.pricePrev;
    return (
      <span className={st.rank}>
        <b>
          {eur2.format(l.price)}
          {l.fromReport ? <sup title={`Seller Central Active Listings Report, ${snapshots.report}`}>*</sup> : null}
        </b>
        {Math.abs(d) < 0.005 ? <span className="dl flat">±0</span> : <span className="dl flat">{`${d > 0 ? "+" : "−"}${eur2.format(Math.abs(d))}`}</span>}
      </span>
    );
  };

  return (
    <section id="price" className="panel flush" aria-labelledby="pb-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="pb-h" className="ph">
            Price &amp; BSR
          </h2>
          <SampleTag />
          <Info label="Price & BSR">
            {avg ? <p>Avg selling price = tool4seller sales ÷ units per period: what buyers paid on average after discounts and coupons. A dash means no units sold.</p> : null}
            <p>
              BSR (sub-category and main category) and listed price come from Agent Central catalog and listing snapshots: BSR as of {snapshots.bsr}, listed price (buyable SKU) as of {snapshots.price}.
            </p>
            <p>Where Agent Central has no buyable offer, the price comes from the Seller Central Active Listings Report of {snapshots.report}, marked *.</p>
            <p>
              Changes are against the previous snapshot (BSR {snapshots.bsrPrev}, price {snapshots.pricePrev}). A lower rank is better, so an upward chevron means the rank improved.
            </p>
          </Info>
        </div>
        <div className="filters">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product or ASIN" aria-label="Search products" />
          {showCat ? <Select label="Category" value={cat} onChange={setCat} options={categories} /> : null}
        </div>
      </div>
      <div className="tscroll tall">
        <table className="pb">
          <thead>
            <tr>
              <th scope="col">Product</th>
              {head("bsrSub", "BSR sub-category", `as of ${snapshots.bsr}`)}
              {head("bsrMain", "BSR main category", `as of ${snapshots.bsr}`)}
              {head("price", "Listed price", `as of ${snapshots.price}`)}
              {avg?.periods.map((p, i) => (
                <th key={p.key} scope="col" className={i === 0 ? "n cur" : "n"}>
                  Avg price
                  <small>{p.kw}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={`${cat}${sort.key}${sort.dir}`} className="swap">
            {list.length === 0 ? (
              <tr>
                <td colSpan={4 + (avg?.periods.length ?? 0)} className="empty">
                  No products match “{q}”.
                </td>
              </tr>
            ) : null}
            {list.map((l) => (
              <tr key={l.asin}>
                <th scope="row">
                  {l.name}
                  <small>
                    {l.asin} · {l.subCat}
                  </small>
                </th>
                <td className="n">
                  <Rank now={l.bsrSub} prev={l.bsrSubPrev} />
                </td>
                <td className="n">
                  <Rank now={l.bsrMain} prev={l.bsrMainPrev} />
                </td>
                <td className="n">{price(l)}</td>
                {avg?.byAsin[l.asin]?.map((v, i) => (
                  <td key={i} className={i === 0 ? "n cur" : "n"}>
                    {v === null ? <span className="na">—</span> : eur.format(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
