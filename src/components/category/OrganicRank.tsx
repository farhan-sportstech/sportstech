"use client";

import { useMemo, useState } from "react";
import type { CategoryData } from "@/lib/category";
import { RANK_DATES, productRanks } from "@/lib/ranks";
import { int } from "@/lib/format";
import { cx } from "@/lib/cx";
import { SampleTag } from "@/lib/homeData";
import Info from "../Info";
import Select from "../Select";
import st from "./OrganicRank.module.css";

// page 1 = top 20, page 2 = 21–40, page 3 or worse beyond
const page = (r: number) => (r <= 20 ? st.p1 : r <= 40 ? st.p2 : st.p3);
const last = (rs: (number | null)[]) => [...rs].reverse().find((x) => x !== null) ?? null;
const first = (rs: (number | null)[]) => rs.find((x) => x !== null) ?? null;

export default function OrganicRank({ data, family }: { data: CategoryData; family: string }) {
  const products = data.pick(family);
  const labels = products.map((p) => `${p.name} · ${p.asin}`);
  const [picked, setPicked] = useState(labels[0]);
  const [q, setQ] = useState("");
  const idx = Math.max(0, labels.indexOf(picked));
  const product = products[idx];

  const rows = useMemo(() => {
    if (!product) return [];
    const needle = q.trim().toLowerCase();
    return productRanks(data, product.asin)
      .filter((r) => !needle || r.q.includes(needle))
      .sort((a, b) => (last(a.ranks) ?? 999) - (last(b.ranks) ?? 999));
  }, [data, product, q]);

  const p1 = rows.filter((r) => (last(r.ranks) ?? 999) <= 20).length;
  const better = rows.filter((r) => {
    const f = first(r.ranks);
    const l = last(r.ranks);
    return f !== null && l !== null && l < f;
  }).length;

  return (
    <section id="rank" className="panel flush" aria-labelledby="rk-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="rk-h" className="ph">
            Organic rank
          </h2>
          <SampleTag live={data.live} reason="not connected to the database yet" />
          <Info label="Organic rank">
            <p>Organic position per tracked query on amazon.de, one reading per week (Tuesdays): Helium 10 Keyword Tracker where it tracks the product, otherwise Agent Central rank (top 60).</p>
            <p>Green is page 1 (top 20), amber page 2 (21–40), red page 3 or worse. “Not in top 60” means the query is tracked for this product but it was not found that week. The change compares the first and last reading; up means a better position.</p>
          </Info>
        </div>
        <p className="tot">
          <b>{int.format(rows.length)}</b> queries · <b className={st.goodTxt}>{p1}</b> on page 1 · <b>{better}</b> improved since {RANK_DATES[0]}
        </p>
      </div>
      <div className="ph-row tools">
        <div className="filters">
          <Select label="Product" value={labels[idx]} options={labels} onChange={setPicked} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search query" aria-label="Search queries" />
        </div>
        <span className="tools-gap" />
        <div className={st.legend} aria-hidden="true">
          <span>
            <i className={st.p1} /> Page 1
          </span>
          <span>
            <i className={st.p2} /> Page 2
          </span>
          <span>
            <i className={st.p3} /> Page 3+
          </span>
        </div>
      </div>
      <div className="tscroll tall">
        <table className={st.rk}>
          <thead>
            <tr>
              <th scope="col">Search query</th>
              {RANK_DATES.map((d, i) => (
                <th key={d} scope="col" className={cx("n", i === RANK_DATES.length - 1 && "cur")}>
                  {d}
                </th>
              ))}
              <th scope="col" className="n">
                Change
                <small>first → last</small>
              </th>
            </tr>
          </thead>
          <tbody key={`${product?.asin}${family}`} className="swap">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={RANK_DATES.length + 2} className="empty">
                  {q ? "No tracked query matches." : "No organic rank data for this product."}
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const f = first(r.ranks);
              const l = last(r.ranks);
              const d = f !== null && l !== null ? f - l : null;
              return (
                <tr key={r.q}>
                  <th scope="row">{r.q}</th>
                  {r.ranks.map((x, i) => (
                    <td key={i} className={cx("n", i === r.ranks.length - 1 && "cur")}>
                      {x === null ? <span className={st.nt}>not in top 60</span> : <span className={cx(st.chip, page(x))}>#{x}</span>}
                    </td>
                  ))}
                  <td className="n">
                    {d === null ? (
                      <span className="na">—</span>
                    ) : d === 0 ? (
                      <span className={cx(st.d, st.flat)}>±0</span>
                    ) : (
                      <span className={cx(st.d, d > 0 ? st.up : st.down)}>
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                          <path d={d > 0 ? "M6 10V2M2.5 5.5 6 2l3.5 3.5" : "M6 2v8M2.5 6.5 6 10l3.5-3.5"} />
                        </svg>
                        {Math.abs(d)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
