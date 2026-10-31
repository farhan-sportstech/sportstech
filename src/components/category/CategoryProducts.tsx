"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { Listing, Period, Product } from "@/lib/mock";
import type { Family } from "@/lib/category";
import { change, eur } from "@/lib/format";
import { cx } from "@/lib/cx";
import { useDeals } from "@/lib/deals";
import Delta from "../Delta";
import Icon from "../NavIcon";
import Info from "../Info";
import MultiSelect from "../MultiSelect";
import Segmented from "../Segmented";
import Select from "../Select";
import Switch from "../Switch";
import { PRODUCT_METRICS, extend, fmtCell, sumX, type XRow } from "@/lib/metrics";
import st from "./CategoryProducts.module.css";

type Mode = "weekly" | "monthly";
const DEFAULT = ["sales", "adSpend", "acos", "tacos", "deal"];

/** Three levels: family -> product -> ASIN. "Deal running" is filled in by hand per product and period. */
export default function CategoryProducts({ families, periods, mode, plural, listings }: { families: Family[]; periods: Period[]; mode: Mode; plural: string; listings: Listing[] }) {
  const unit = mode === "weekly" ? "week" : "month";
  const [view, setView] = useState<"week" | "trend">("trend");
  const [metrics, setMetrics] = useState(DEFAULT);
  const [picked, setPicked] = useState({ mode, i: 0 });
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const [shutFam, setShutFam] = useState<Set<string>>(new Set());
  const [openProd, setOpenProd] = useState<Set<string>>(new Set());
  const deals = useDeals();
  const wi = picked.mode === mode ? picked.i : 0;
  const weekOptions = periods.slice(0, -1).map((p) => `${p.kw} · ${p.label}`);

  const fams = useMemo(() => {
    const n = q.trim().toLowerCase();
    return families
      .map((f) => ({ ...f, products: f.products.filter((p) => !n || `${p.name} ${p.asin}`.toLowerCase().includes(n)).sort((a, b) => b[mode][0].sales - a[mode][0].sales) }))
      .filter((f) => f.products.length);
  }, [families, q, mode]);

  const toggle = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    apply(n);
  };

  // extended series per product and ASIN (traffic, ad and rank fields), families summed from their products
  const series = useMemo(() => {
    const bsr = new Map(listings.map((l) => [l.asin, { sub: l.bsrSub, main: l.bsrMain }]));
    const prod = new Map<string, XRow[]>();
    const asin = new Map<string, XRow[]>();
    for (const f of families)
      for (const p of f.products) {
        const b = bsr.get(p.asin);
        prod.set(p.asin, extend(p[mode], p.asin, mode, b));
        p.variants.forEach((v, n) => asin.set(v.sku, extend(v[mode], v.sku, mode, b && { sub: b.sub + n * 3, main: b.main + n * 40 })));
      }
    return { prod, asin };
  }, [families, listings, mode]);

  const metricOpts = [...PRODUCT_METRICS.map((m) => ({ value: m.key, label: m.label })), { value: "deal", label: "Deal running" }];
  const shown = PRODUCT_METRICS.filter((m) => metrics.includes(m.key));
  const showDeal = metrics.includes("deal");

  const dealCell = (p: Product | null, i: number, fam?: Product[]) => {
    const key = periods[i].key;
    if (fam) {
      const on = fam.filter((x) => deals.has(x.asin, key)).length;
      return on ? <span className={st.dealN}>{on} of {fam.length}</span> : <span className="na">—</span>;
    }
    if (!p) return null;
    const on = deals.has(p.asin, key);
    return (
      <button type="button" className={st.deal} aria-pressed={on} aria-label={`Deal running for ${p.name} in ${periods[i].kw}`} onClick={() => deals.toggle(p.asin, key)}>
        {on ? "Deal" : "–"}
      </button>
    );
  };

  const cells = (rows: XRow[], p: Product | null, fam?: Product[]): ReactNode =>
    view === "week" ? (
      <>
        <td className="n cur">{eur.format(rows[wi].sales)}</td>
        <td className="n">
          <Delta value={change(rows[wi].sales, rows[wi + 1].sales)} />
        </td>
        {PRODUCT_METRICS.slice(1).map((m) => (
          <td key={m.key} className="n">
            {fmtCell(m, rows[wi])}
          </td>
        ))}
        <td className="n">{dealCell(p, wi, fam)}</td>
      </>
    ) : (
      <>
        {shown.map((m) =>
          rows.map((r, i) => (
            <td key={m.key + i} className={cx("n", i === 0 && "cur", i === rows.length - 1 && st.end)}>
              {fmtCell(m, r)}
            </td>
          )),
        )}
        {showDeal
          ? periods.map((_, i) => (
              <td key={`d${i}`} className={cx("n", i === periods.length - 1 && st.end)}>
                {dealCell(p, i, fam)}
              </td>
            ))
          : null}
      </>
    );

  const blocks = view === "trend" ? [...shown.map((m) => ({ key: m.key, label: m.label, sub: m.sub })), ...(showDeal ? [{ key: "deal", label: "Deal running", sub: "you fill this in" }] : [])] : [];
  const colCount = 1 + (view === "week" ? PRODUCT_METRICS.length + 2 : blocks.length * periods.length);

  return (
    <section id="products" className="panel flush" aria-labelledby="cp-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="cp-h" className="ph">
            Products
          </h2>
          <Info label="Products">
            <p>Three levels: family, product, ASIN. Click a family or product row to expand it.</p>
            <p>“5-{unit} trend” shows the chosen metrics across all five {unit}s, each in its own block; “One {unit}” shows every metric for a single {unit}.</p>
            <p>Deal running is a metric like any other here, but Amazon&apos;s promotion API does not report which {unit} a deal ran, so its cells are yours to fill in. Entries are saved in this browser.</p>
          </Info>
          <span className="count">
            {fams.reduce((a, f) => a + f.products.length, 0)} products · {fams.reduce((a, f) => a + f.products.reduce((b, p) => b + p.variants.length, 0), 0)} ASINs
          </span>
        </div>
        <div className="filters">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product or ASIN" aria-label={`Search ${plural}`} />
        </div>
      </div>
      <div className="ph-row tools">
        <Segmented
          label="View"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "week", label: `One ${unit}` },
            { value: "trend", label: `5-${unit} trend` },
          ]}
        />
        {view === "week" ? (
          <Select size="sm" label={unit === "week" ? "Week" : "Month"} value={weekOptions[wi]} options={weekOptions} onChange={(v) => setPicked({ mode, i: weekOptions.indexOf(v) })} />
        ) : (
          <MultiSelect
            label="Metrics"
            value={metrics}
            onChange={setMetrics}
            options={metricOpts}
            presets={[
              { label: "All", value: metricOpts.map((o) => o.value) },
              { label: "None", value: [] },
              { label: "Default", value: DEFAULT },
            ]}
          />
        )}
        <span className="tools-gap" />
        <Switch checked={all} onChange={setAll}>
          Expand all ASINs
        </Switch>
      </div>
      <div className="tscroll tall">
        <table className={st.tree}>
          <thead>
            {view === "trend" ? (
              <tr className={st.grp}>
                <th scope="col" />
                {blocks.map((b) => (
                  <th key={b.key} scope="colgroup" colSpan={periods.length} className={st.gh}>
                    {b.label}
                    {b.sub ? <small>{b.sub}</small> : null}
                  </th>
                ))}
              </tr>
            ) : null}
            <tr>
              <th scope="col">Product</th>
              {view === "week" ? (
                <>
                  <th scope="col" className="n cur">
                    Total sales
                  </th>
                  <th scope="col" className="n">
                    vs {periods[wi + 1].kw}
                  </th>
                  {PRODUCT_METRICS.slice(1).map((m) => (
                    <th key={m.key} scope="col" className="n">
                      {m.label}
                    </th>
                  ))}
                  <th scope="col" className="n">
                    Deal running
                  </th>
                </>
              ) : (
                blocks.map((b) =>
                  periods.map((p, i) => (
                    <th key={b.key + p.key} scope="col" className={cx("n", i === 0 && "cur", i === periods.length - 1 && st.end)}>
                      {p.kw}
                    </th>
                  )),
                )
              )}
            </tr>
          </thead>
          <tbody key={`${view}${metrics.join()}${mode}`} className="swap">
            {fams.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="empty">
                  No products match “{q}”.
                </td>
              </tr>
            ) : null}
            {fams.map((f) => {
              const famOpen = !shutFam.has(f.name);
              return (
                <Fragment key={f.name}>
                  <tr className={st.fam}>
                    <th scope="row">
                      <button type="button" className={st.exp} aria-expanded={famOpen} onClick={() => toggle(shutFam, f.name, setShutFam)}>
                        <Icon name="chev" className="ic" />
                        <span>
                          {f.name}
                          <small>
                            {f.products.length} product{f.products.length === 1 ? "" : "s"}
                          </small>
                        </span>
                      </button>
                    </th>
                    {cells(sumX(f.products.map((p) => series.prod.get(p.asin)!)), null, f.products)}
                  </tr>
                  {famOpen
                    ? f.products.map((p) => {
                        const pOpen = all || openProd.has(p.asin);
                        return (
                          <Fragment key={p.asin}>
                            <tr className={st.prod}>
                              <th scope="row">
                                <button type="button" className={st.exp} aria-expanded={pOpen} disabled={all} onClick={() => toggle(openProd, p.asin, setOpenProd)}>
                                  <Icon name="chev" className="ic" />
                                  <span>
                                    {p.name}
                                    <small>{p.asin}</small>
                                  </span>
                                </button>
                              </th>
                              {cells(series.prod.get(p.asin)!, p)}
                            </tr>
                            {pOpen
                              ? p.variants.map((v) => (
                                  <tr key={v.sku} className={st.asin}>
                                    <th scope="row">
                                      <span className={st.ch}>
                                        {v.label}
                                        <small>{v.sku}</small>
                                      </span>
                                    </th>
                                    {cells(series.asin.get(v.sku)!, null)}
                                  </tr>
                                ))
                              : null}
                          </Fragment>
                        );
                      })
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
