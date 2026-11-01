"use client";

import { useMemo, type CSSProperties } from "react";
import type { Period } from "@/lib/mock";
import type { CategoryData, Embed, Mode } from "@/lib/category";
import { BUCKETS, addCell, categoryAds, scopeRows, zero, type Bucket, type Cell } from "@/lib/ads";
import { eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { cx } from "@/lib/cx";
import { SampleTag } from "@/lib/homeData";
import Info from "../Info";
import st from "./BrandedSplit.module.css";

const NOTE: Record<Bucket, string> = {
  Branded: "typed Sportstech or a model name",
  "Non-branded": "generic demand and competitor brands",
  Defensive: "ads on our own product pages",
  Offensive: "ads on competitor product pages",
};
const KEY: Record<Bucket, string> = { Branded: "br", "Non-branded": "nb", Defensive: "df", Offensive: "of" };
const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null);

/** Where own-campaign spend went: our brand, generic demand, our own pages, competitor pages. */
export default function BrandedSplit({ data, family, mode, periods, embed }: { data: CategoryData; family: string; mode: Mode; periods: Period[]; embed?: Embed }) {
  const uid = embed?.uid ?? "";
  const unit = mode === "weekly" ? "week" : "month";

  const { grid, totals } = useMemo(() => {
    const asins = family ? data.pick(family).map((p) => p.asin) : null;
    const rows = scopeRows(categoryAds(data, mode), asins);
    const grid = BUCKETS.map((b) => ({ bucket: b, cells: periods.map((_, i) => rows.filter((r) => r.bucket === b).reduce((a, r) => addCell(a, r.w[i]), zero())) }));
    const totals = periods.map((_, i) => grid.reduce((a, g) => addCell(a, g.cells[i]), zero()));
    return { grid, totals };
  }, [data, family, mode, periods]);

  const share = (c: Cell, i: number) => (totals[i].spend ? c.spend / totals[i].spend : 0);

  return (
    <section id={`${uid}branded`} className="panel flush" aria-labelledby={`${uid}bk-h`}>
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id={`${uid}bk-h`} className="ph">
            {embed?.title ?? "Branded vs non-branded · defensive vs offensive"}
          </h2>
          <SampleTag live={data.live} reason="not connected to the database yet" />
          <Info label="Branded vs non-branded">
            <p>Where own-campaign ad spend went, from the search-term report: one row per bucket, {unit}s across.</p>
            <p>
              <b>Branded</b>: the shopper typed Sportstech or a model name. <b>Non-branded</b>: generic demand and competitor brand names. <b>Defensive</b>: ads shown on our own product pages. <b>Offensive</b>: ads shown on competitor product pages.
            </p>
            <p>Each cell: spend and its share of that {unit}&apos;s spend, then CVR, ACOS, sales and orders.</p>
          </Info>
        </div>
        <div className={st.legend} aria-hidden="true">
          {BUCKETS.map((b) => (
            <span key={b}>
              <i className={st[KEY[b]]} />
              {b}
            </span>
          ))}
        </div>
      </div>
      <div className="tscroll">
        <table className={st.bk}>
          <thead>
            <tr>
              <th scope="col">Bucket</th>
              {periods.map((p, i) => (
                <th key={p.key} scope="col" className={cx(i === 0 && "cur")}>
                  <span className={st.ph}>
                    {p.kw}
                    <small>{p.label}</small>
                  </span>
                  {/* the four-way split of this period's spend */}
                  <span className={st.stack} aria-label={BUCKETS.map((b, k) => `${b} ${pct1.format(share(grid[k].cells[i], i) * 100)}%`).join(", ")}>
                    {grid.map((g) => (
                      <i key={g.bucket} className={st[KEY[g.bucket]]} style={{ flexGrow: share(g.cells[i], i) || 0.0001 }} />
                    ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={`${mode}${family}`} className="swap">
            {grid.map((g) => (
              <tr key={g.bucket}>
                <th scope="row">
                  <span className={st.bn}>
                    <i className={st[KEY[g.bucket]]} />
                    {g.bucket}
                  </span>
                  <small>{NOTE[g.bucket]}</small>
                </th>
                {g.cells.map((c, i) => {
                  const acos = ratio(c.spend, c.sales);
                  return (
                    <td key={i} className={cx(i === 0 && "cur")}>
                      {c.spend ? (
                        <span className={st.c} style={{ "--w": share(c, i) } as CSSProperties}>
                          <span className={st.top}>
                            <b>{eur.format(c.spend)}</b>
                            <span className={st.sh}>{pct1.format(share(c, i) * 100)}%</span>
                          </span>
                          <span className={cx(st.bar, st[KEY[g.bucket]])} aria-hidden="true">
                            <i />
                          </span>
                          <span className={st.meta}>
                            CVR {c.clicks ? `${pct2.format((c.orders / c.clicks) * 100)}%` : "—"} · ACOS <b>{acos === null ? "—" : `${pct1.format(acos)}%`}</b>
                            <br />
                            {eur.format(c.sales)} · {int.format(c.orders)} orders
                          </span>
                        </span>
                      ) : (
                        <span className="na">no spend</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {totals.map((t, i) => (
                <td key={i} className={cx(i === 0 && "cur")}>
                  <span className={st.c}>
                    <span className={st.top}>
                      <b>{eur2.format(t.spend)}</b>
                    </span>
                    <span className={st.meta}>
                      ACOS <b>{t.sales ? `${pct1.format((t.spend / t.sales) * 100)}%` : "—"}</b> · {eur.format(t.sales)}
                    </span>
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
