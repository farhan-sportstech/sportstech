"use client";

import { Fragment, useMemo, useState, type CSSProperties } from "react";
import type { CategoryData, Mode } from "@/lib/category";
import { categoryAds, scopeRows, total, type Cell, type KwRow, type MatchType } from "@/lib/ads";
import { eur, eur2, int, pct1 } from "@/lib/format";
import { cx } from "@/lib/cx";
import { SampleTag } from "@/lib/homeData";
import Info from "../Info";
import Switch from "../Switch";
import st from "./KeywordCoverage.module.css";

const COLS: { key: MatchType; label: string }[] = [
  { key: "Exact", label: "Exact" },
  { key: "Phrase", label: "Phrase" },
  { key: "Broad", label: "Broad" },
  { key: "Product (PAT)", label: "Product targets" },
  { key: "Auto", label: "Auto targets" },
];
type Row = KwRow & { t: Cell };
type Line = { id: string; name: string; asin: string | null; campaigns: number; by: Record<MatchType, Row[]>; spend: number; gap: string | null };
const spendOf = (rs: Row[]) => rs.reduce((a, r) => a + r.t.spend, 0);

/** The keywords behind one count: share of the group's spend per keyword, ACOS against the group's own ACOS. */
function Drawer({ label, product, list, colSpan, onClose }: { label: string; product: string; list: Row[]; colSpan: number; onClose: () => void }) {
  const spend = spendOf(list);
  const sales = list.reduce((a, r) => a + r.t.sales, 0);
  const orders = list.reduce((a, r) => a + r.t.orders, 0);
  const avg = sales ? (spend / sales) * 100 : null;
  const tone = (acos: number) => (avg === null ? "" : acos <= avg * 0.9 ? st.good : acos >= avg * 1.1 ? st.bad : "");
  return (
    <tr className={st.drawer}>
      <td colSpan={colSpan}>
        <div className={st.drawIn}>
          <div className={st.card}>
            <div className={st.cardHd}>
              <div className={st.cardT}>
                <b>
                  {label} · {product}
                </b>
                <span className={st.stats}>
                  <span>
                    <em>{int.format(list.length)}</em> {list.length === 1 ? "keyword" : "keywords"}
                  </span>
                  <span>
                    <em>{eur2.format(spend)}</em> spend
                  </span>
                  <span>
                    <em>{eur.format(sales)}</em> sales
                  </span>
                  <span>
                    ACOS <em>{avg === null ? "—" : `${pct1.format(avg)}%`}</em>
                  </span>
                  <span>
                    <em>{int.format(orders)}</em> orders
                  </span>
                </span>
              </div>
              <button type="button" className={st.close} onClick={onClose} aria-label="Close keyword list">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <table className={st.mini}>
              <thead>
                <tr>
                  <th scope="col">Keyword or target</th>
                  <th scope="col">Campaign</th>
                  <th scope="col" className="n">
                    Spend
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
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => {
                  const acos = r.t.sales ? (r.t.spend / r.t.sales) * 100 : null;
                  return (
                    <tr key={r.id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms`, "--w": spend ? r.t.spend / spend : 0 } as CSSProperties}>
                      <th scope="row">
                        <span className={st.kw}>{r.sub ? `${r.term} · ${r.sub.split(" · ")[1]}` : r.term}</span>
                        <span className={st.share} aria-hidden="true">
                          <i />
                        </span>
                      </th>
                      <td className={st.camp}>{r.campaign}</td>
                      <td className="n">
                        {eur2.format(r.t.spend)}
                        <small className={st.pctOf}>{pct1.format(spend ? (r.t.spend / spend) * 100 : 0)}%</small>
                      </td>
                      <td className="n">{eur.format(r.t.sales)}</td>
                      <td className="n">{acos === null ? <span className="na">no sales</span> : <span className={cx(st.acos, tone(acos))}>{pct1.format(acos)}%</span>}</td>
                      <td className="n">{int.format(r.t.orders)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}

/** One row per product: how many keywords and targets of each match type it has, with their spend. */
export default function KeywordCoverage({ data, family, mode }: { data: CategoryData; family: string; mode: Mode }) {
  const [open, setOpen] = useState<{ id: string; m: MatchType } | null>(null);
  const [q, setQ] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const unit = mode === "weekly" ? "week" : "month";

  const lines = useMemo(() => {
    const asins = family ? data.pick(family).map((p) => p.asin) : null;
    const rows: Row[] = scopeRows(categoryAds(data, mode), asins).map((r) => ({ ...r, t: total(r.w) }));
    const make = (id: string, name: string, asin: string | null, rs: Row[]): Line => {
      const by = Object.fromEntries(COLS.map((c) => [c.key, rs.filter((r) => r.match === c.key).sort((a, b) => b.t.spend - a.t.spend)])) as Record<MatchType, Row[]>;
      const noEx = !by.Exact.length;
      const noPh = !by.Phrase.length;
      return { id, name, asin, campaigns: new Set(rs.map((r) => r.campaign)).size, by, spend: spendOf(rs), gap: asin && (noEx || noPh) ? (noEx && noPh ? "no Exact, no Phrase" : noEx ? "no Exact" : "no Phrase") : null };
    };
    const out = data.pick(family).map((p) => make(p.asin, p.name, p.asin, rows.filter((r) => r.asin === p.asin)));
    const multi = rows.filter((r) => r.asin === null);
    if (multi.length) out.push(make("multi", "Multi-product campaigns", null, multi));
    return out.sort((a, b) => b.spend - a.spend);
  }, [data, family, mode]);

  const gaps = lines.filter((l) => l.gap).length;
  const needle = q.trim().toLowerCase();
  const shown = lines.filter((l) => (!onlyGaps || l.gap) && (!needle || `${l.name} ${l.asin ?? ""}`.toLowerCase().includes(needle)));
  const toggle = (id: string, m: MatchType) => setOpen((o) => (o && o.id === id && o.m === m ? null : { id, m }));

  return (
    <section id="coverage" className="panel flush" aria-labelledby="kc-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="kc-h" className="ph">
            Keyword coverage by match type
          </h2>
          <SampleTag live={data.live} reason="not connected to the database yet" />
          <Info label="Keyword coverage">
            <p>Enabled keywords and targets in own campaigns over the last 5 {unit}s; targets in paused or archived campaigns are left out. Each count shows its 5-{unit} spend underneath.</p>
            <p>A campaign belongs to a product when the campaign map or its name says so. Campaigns covering several products are grouped as multi-product.</p>
            <p>Red rows are products with no Exact or no Phrase keyword: the usual gap to close first. Click a count to list those keywords.</p>
          </Info>
        </div>
        <p className="tot">
          {gaps ? (
            <>
              <b className={st.warnTxt}>{gaps}</b> {gaps === 1 ? "product has" : "products have"} a gap
            </>
          ) : (
            "Every product has Exact and Phrase keywords"
          )}
        </p>
      </div>
      <div className="ph-row tools">
        <Switch checked={onlyGaps} onChange={setOnlyGaps}>
          Only products with a gap{gaps ? ` · ${gaps}` : ""}
        </Switch>
        <span className="tools-gap" />
        <div className="filters">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product or ASIN" aria-label="Search products" />
        </div>
      </div>
      <div className="tscroll">
        <table className={st.cov}>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col" className="n">
                Campaigns
              </th>
              {COLS.map((c) => (
                <th key={c.key} scope="col" className="n">
                  {c.label}
                </th>
              ))}
              <th scope="col" className={cx("n", st.split)}>
                Spend · 5 {unit}s
              </th>
            </tr>
          </thead>
          <tbody key={`${mode}${family}${onlyGaps}`} className="swap">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={3 + COLS.length} className="empty">
                  {onlyGaps && !needle ? "No product has a gap: every one runs Exact and Phrase keywords." : "No product matches the search."}
                </td>
              </tr>
            ) : null}
            {shown.map((l) => {
              const isOpen = open?.id === l.id;
              const list = isOpen ? l.by[open.m] : [];
              return (
                <Fragment key={l.id}>
                  <tr className={cx(l.gap && st.gap, isOpen && st.openRow)}>
                    <th scope="row">
                      <span className={st.name}>
                        {l.name}
                        {l.gap ? <span className={st.flag}>{l.gap}</span> : null}
                      </span>
                      <small>{l.asin ?? "spend shared across products"}</small>
                    </th>
                    <td className="n">{int.format(l.campaigns)}</td>
                    {COLS.map((c) => {
                      const rs = l.by[c.key];
                      const on = isOpen && open.m === c.key;
                      const zero = !rs.length && l.asin && (c.key === "Exact" || c.key === "Phrase");
                      const spend = spendOf(rs);
                      return (
                        <td key={c.key} className="n">
                          {rs.length ? (
                            <button
                              type="button"
                              className={cx(st.count, on && st.on)}
                              aria-expanded={on}
                              onClick={() => toggle(l.id, c.key)}
                              title={`Show the ${rs.length} ${c.label.toLowerCase()} · ${pct1.format(l.spend ? (spend / l.spend) * 100 : 0)}% of this product's spend`}
                              style={{ "--w": l.spend ? spend / l.spend : 0 } as CSSProperties}
                            >
                              <span className={st.top}>
                                <b>{int.format(rs.length)}</b>
                                <svg className={st.chev} viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="m9 6 6 6-6 6" />
                                </svg>
                              </span>
                              <span className={st.track} aria-hidden="true">
                                <i />
                              </span>
                              <span className={st.amt}>{eur2.format(spend)}</span>
                            </button>
                          ) : zero ? (
                            <span className={st.missing}>missing</span>
                          ) : (
                            <span className={st.none}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className={cx("n strong", st.split)}>{eur2.format(l.spend)}</td>
                  </tr>
                  {isOpen ? <Drawer label={COLS.find((c) => c.key === open.m)!.label} product={l.name} list={list} colSpan={3 + COLS.length} onClose={() => setOpen(null)} /> : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
