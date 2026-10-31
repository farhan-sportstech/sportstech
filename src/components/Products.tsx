"use client";

import { Fragment, useMemo, useRef, useState, type CSSProperties } from "react";
import { monthly, products, weekly, type Row } from "@/lib/mock";
import { acos, change, eur, tacos } from "@/lib/format";
import Delta from "./Delta";
import { HOME_PRODUCT_METRICS, extend, fmtCell, type XRow } from "@/lib/metrics";
import Icon from "./NavIcon";
import st from "./Products.module.css";
import { cx } from "@/lib/cx";
import Select from "./Select";
import Info from "./Info";
import MultiSelect from "./MultiSelect";
import Segmented from "./Segmented";
import Switch from "./Switch";
import { useFlip } from "@/lib/motion";

type SortKey = "sales" | "delta" | "acos" | "tacos";
type Line = { key: string; name: string; sub: string; rows: XRow[] };
type View = "week" | "trend";
type Limit = "5" | "12" | "all";

const METRICS = HOME_PRODUCT_METRICS;
const DEFAULT_METRICS = ["sales", "adSpend", "acos", "tacos"];
// in the one-period view these headings sort the table
const SORTABLE: Partial<Record<string, SortKey>> = { acos: "acos", tacos: "tacos" };
const LIMITS: Record<Limit, string> = { "5": "5 rows", "12": "12 rows", all: "All rows" };

export default function Products({ mode, prevLabel }: { mode: "weekly" | "monthly"; prevLabel: string }) {
  const periods = (mode === "weekly" ? weekly : monthly).periods;
  const unit = mode === "weekly" ? "week" : "month";
  const [view, setView] = useState<View>("week");
  const [metrics, setMetrics] = useState<string[]>(DEFAULT_METRICS);
  const [picked, setPicked] = useState({ mode, i: 0 });
  const [kids, setKids] = useState<"parents" | "children">("parents");
  const [limit, setLimit] = useState<Limit>("12");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All categories");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "sales", dir: -1 });
  const body = useRef<HTMLTableSectionElement>(null);
  const wi = picked.mode === mode ? picked.i : 0; // period shown in the one-period view
  const weekOptions = periods.slice(0, -1).map((p) => `${p.kw} · ${p.label}`);
  useFlip(body, `${sort.key}${sort.dir}${mode}${wi}`);

  const categories = useMemo(() => ["All categories", ...Array.from(new Set(products.map((p) => p.category)))], []);

  const all = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const metric = (rows: Row[]) => ({ sales: rows[wi].sales, delta: change(rows[wi].sales, rows[wi + 1].sales), acos: acos(rows[wi]), tacos: tacos(rows[wi]) });
    return products
      .filter((p) => (cat === "All categories" || p.category === cat) && (!needle || `${p.name} ${p.asin} ${p.category}`.toLowerCase().includes(needle)))
      .map((p) => ({ p, rows: extend(p[mode], p.asin, mode), m: metric(p[mode]) }))
      .sort((a, b) => (a.m[sort.key] - b.m[sort.key]) * sort.dir);
  }, [q, cat, mode, sort, wi]);
  const list = limit === "all" ? all : all.slice(0, Number(limit));
  const shownMetrics = METRICS.filter((m) => metrics.includes(m.key));

  // closing plays the variants' exit (see .child.closing) before they unmount
  const toggle = (asin: string) => {
    if (!open.has(asin)) {
      setOpen((s) => new Set(s).add(asin));
      return;
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setClosing((s) => new Set(s).add(asin));
    setTimeout(() => {
      setOpen((s) => {
        const n = new Set(s);
        n.delete(asin);
        return n;
      });
      setClosing((s) => {
        const n = new Set(s);
        n.delete(asin);
        return n;
      });
    }, reduce ? 120 : 170);
  };

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

  const cells = (rows: XRow[]) =>
    view === "week" ? (
      <>
        <td className="n cur">{eur.format(rows[wi].sales)}</td>
        <td className="n">
          <Delta value={change(rows[wi].sales, rows[wi + 1].sales)} />
        </td>
        {METRICS.slice(1).map((m) => (
          <td key={m.key} className="n">
            {fmtCell(m, rows[wi])}
          </td>
        ))}
      </>
    ) : (
      shownMetrics.map((m) =>
        rows.map((r, i) => (
          <td key={`${m.key}${i}`} className={cx("n", i === 0 && "cur", i === rows.length - 1 && st["grp-end"])}>
            {fmtCell(m, r)}
          </td>
        )),
      )
    );
  const colCount = 2 + (view === "week" ? METRICS.length + 1 : shownMetrics.length * periods.length);

  return (
    <section id="products" className="panel flush" aria-labelledby="pr-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="pr-h" className="ph">
            All products
          </h2>
          <Info label="All products">
            <p>Every parent ASIN with sales in the period. Open a parent, or switch to Parents + children, to see its variants.</p>
            <p>“One {unit}” shows every metric for a single {unit}; “Metrics × 5” shows the chosen metrics across all five {unit}s.</p>
            <p>Sales, units and sessions are per child ASIN, summed to parents. Ad spend and ad sales are tool4seller advertising by ASIN.</p>
          </Info>
          <span className="count">{all.length} parents</span>
        </div>
        <div className="filters">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product or ASIN" aria-label="Search products" />
          <Select label="Category" value={cat} onChange={setCat} options={categories} />
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
                options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
                presets={[
                  { label: "All", value: METRICS.map((m) => m.key) },
                  { label: "None", value: [] },
                  { label: "Default", value: DEFAULT_METRICS },
                ]}
              />
            )}
            <span className="tools-gap" />
            <Switch checked={kids === "children"} onChange={(on) => setKids(on ? "children" : "parents")}>
              Show variants
            </Switch>
            <Select size="sm" label="Rows" value={LIMITS[limit]} options={Object.values(LIMITS)} onChange={(v) => setLimit((Object.keys(LIMITS) as Limit[]).find((k) => LIMITS[k] === v)!)} />
          </div>
          <div className="tscroll tall">
            <table className="pt">
              <thead>
                {view === "trend" ? (
                  <tr className={st.grp}>
                    <th scope="col" colSpan={2} />
                    {shownMetrics.map((m) => (
                      <th key={m.key} scope="colgroup" colSpan={periods.length} className={st["grp-h"]}>
                        {m.label}
                      </th>
                    ))}
                  </tr>
                ) : null}
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  {view === "week" ? (
                    <>
                      {head("sales", "Sales")}
                      {head("delta", `vs ${wi === 0 ? prevLabel : periods[wi + 1].kw}`)}
                      {METRICS.slice(1).map((m) =>
                        SORTABLE[m.key] ? (
                          <Fragment key={m.key}>{head(SORTABLE[m.key]!, m.label)}</Fragment>
                        ) : (
                          <th key={m.key} scope="col" className="n">
                            {m.label}
                          </th>
                        ),
                      )}
                    </>
                  ) : (
                    shownMetrics.map((m) =>
                      periods.map((p, i) => (
                        <th key={`${m.key}${p.key}`} scope="col" className={cx("n", i === 0 && "cur", i === periods.length - 1 && st["grp-end"])}>
                          {p.kw}
                        </th>
                      )),
                    )
                  )}
                </tr>
              </thead>
              <tbody ref={body} key={`${view}${metrics.join()}`} className="swap">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="empty">
                      No products match “{q}”.
                    </td>
                  </tr>
                ) : null}
                {view === "trend" && shownMetrics.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="empty">
                      Pick at least one metric.
                    </td>
                  </tr>
                ) : null}
                {list.map(({ p, rows }) => {
                  const expanded = kids === "children" || open.has(p.asin);
                  const shutting = kids === "parents" && closing.has(p.asin);
                  const lines: Line[] = p.variants.map((v) => ({ key: v.sku, name: v.label, sub: v.sku, rows: extend(v[mode], v.sku, mode) }));
                  return (
                    <Fragment key={p.asin}>
                      <tr className={st.parent} data-flip={p.asin}>
                        <th scope="row">
                          <button type="button" className={st.exp} aria-expanded={expanded && !shutting} disabled={kids === "children"} onClick={() => toggle(p.asin)}>
                            <Icon name="chev" className="ic" />
                            <span>
                              {p.name}
                              <small>{p.asin}</small>
                            </span>
                          </button>
                        </th>
                        <td className={st.cat}>{p.category}</td>
                        {cells(rows)}
                      </tr>
                      {expanded
                        ? lines.map((l, li) => (
                            <tr key={l.key} className={cx(st.child, shutting && st.closing)} data-flip={l.key} style={{ "--i": li } as CSSProperties}>
                              <th scope="row">
                                <span className={st.ch}>
                                  {l.name}
                                  <small>{l.sub}</small>
                                </span>
                              </th>
                              <td />
                              {cells(l.rows)}
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {limit !== "all" && all.length > list.length ? (
            <div className={st.more}>
              <button type="button" className="btn sm" onClick={() => setLimit("all")}>
                Show all {all.length}
              </button>
            </div>
          ) : null}
    </section>
  );
}
