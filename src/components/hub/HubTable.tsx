"use client";

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DAYS, acosD, addDay, cpcD, ctrD, cvrD, roasD, zeroDay, type Day } from "@/lib/account";
import { change, eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { cx } from "@/lib/cx";
import { useReveal } from "@/lib/motion";
import Delta from "../Delta";
import Info from "../Info";
import MultiSelect from "../MultiSelect";
import Segmented from "../Segmented";
import Select from "../Select";
import { useHub } from "./HubContext";
import st from "./hub.module.css";

/** A view's page: its own reveal-on-scroll column inside the hub layout. */
export function View({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);
  return (
    <div className={cx("wdp", st.view)} ref={ref}>
      {children}
    </div>
  );
}

export type Col<R> = {
  key: string;
  label: string;
  sub?: string;
  /** the sort and CSV value */
  get: (r: R) => number | string | null;
  fmt?: (v: number) => string;
  render?: (r: R) => ReactNode;
  num?: boolean;
  /** the row label column: wraps and holds a second line */
  name?: boolean;
  total?: ReactNode;
};
export type Filt<R> = { label: string; test: (r: R) => boolean };
type Metric = { key: string; label: string; get: (d: Day, tot: Day) => number | null; fmt: (v: number) => string; heat?: "up" | "down" };

const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null);
export const METRICS: Metric[] = [
  { key: "impr", label: "Impr.", get: (d) => d.impr, fmt: (v) => int.format(v) },
  { key: "clicks", label: "Clicks", get: (d) => d.clicks, fmt: (v) => int.format(v) },
  { key: "orders", label: "Orders", get: (d) => d.orders, fmt: (v) => int.format(v) },
  { key: "spend", label: "Spend", get: (d) => d.spend, fmt: (v) => eur2.format(v), heat: "up" },
  { key: "spendPct", label: "% Spend", get: (d, t) => ratio(d.spend, t.spend), fmt: (v) => `${pct1.format(v)}%` },
  { key: "sales", label: "Sales", get: (d) => d.sales, fmt: (v) => eur.format(v), heat: "up" },
  { key: "salesPct", label: "% Sales", get: (d, t) => ratio(d.sales, t.sales), fmt: (v) => `${pct1.format(v)}%` },
  { key: "acos", label: "ACOS", get: acosD, fmt: (v) => `${pct1.format(v)}%`, heat: "down" },
  { key: "roas", label: "ROAS", get: roasD, fmt: (v) => pct2.format(v) },
  { key: "ctr", label: "CTR", get: ctrD, fmt: (v) => `${pct2.format(v)}%` },
  { key: "cpc", label: "CPC", get: cpcD, fmt: (v) => eur2.format(v) },
  { key: "cvr", label: "CVR", get: cvrD, fmt: (v) => `${pct1.format(v)}%`, heat: "up" },
];
const PAGE = ["25", "50", "100", "250"];

/**
 * The table every hub view shares: tabs and quick filters with counts, sortable headers, the standard metric
 * columns (picked once for the whole hub), heat shading, a totals row, paging and CSV export.
 */
export default function HubTable<R extends { key: string; d?: Day; prev?: Day | null }>({
  id,
  title,
  info,
  lead,
  rows,
  cols,
  metrics = true,
  deltas = false,
  tabs,
  chips,
  sort: sort0,
  actions,
  actionsLabel = "Queue",
  tools,
  rowClass,
  empty = "No rows match the filters.",
}: {
  id: string;
  title: ReactNode;
  info?: ReactNode;
  lead?: ReactNode;
  rows: R[];
  cols: Col<R>[];
  metrics?: boolean;
  deltas?: boolean;
  tabs?: Filt<R>[];
  chips?: Filt<R>[];
  sort?: { key: string; dir: 1 | -1 };
  actions?: (r: R) => ReactNode;
  actionsLabel?: string;
  tools?: ReactNode;
  rowClass?: (r: R) => string | false | undefined;
  empty?: string;
}) {
  const hub = useHub();
  const [tab, setTab] = useState(0);
  const [on, setOn] = useState<string[]>([]);
  const [sort, setSort] = useState(sort0 ?? { key: "spend", dir: -1 as 1 | -1 });
  const [per, setPer] = useState("50");
  const [pageN, setPageN] = useState(0);

  const shownM = metrics ? METRICS.filter((m) => hub.metrics.includes(m.key)) : [];
  const tabRows = tabs ? rows.filter(tabs[Math.min(tab, tabs.length - 1)].test) : rows;
  const active = (chips ?? []).filter((c) => on.includes(c.label));
  const filtered = tabRows.filter((r) => active.every((c) => c.test(r)));
  const tot = filtered.reduce((a, r) => addDay(a, r.d ?? zeroDay()), zeroDay());
  const prevTot = deltas ? filtered.reduce((a, r) => addDay(a, r.prev ?? zeroDay()), zeroDay()) : null;

  const valOf = (r: R, key: string): number | string | null => {
    const c = cols.find((x) => x.key === key);
    if (c) return c.get(r);
    const m = METRICS.find((x) => x.key === key);
    if (m && r.d) return m.get(r.d, tot);
    if (key === "spendD") return r.d && r.prev ? r.d.spend - r.prev.spend : null;
    if (key === "salesD") return r.d && r.prev ? r.d.sales - r.prev.sales : null;
    return null;
  };
  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      const x = valOf(a, sort.key);
      const y = valOf(b, sort.key);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number)) * sort.dir;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, cols]);
  const size = Number(per);
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const pg = Math.min(pageN, pages - 1);
  const view = sorted.slice(pg * size, pg * size + size);

  // heat: each shaded metric scaled between its 5th and 95th percentile across the filtered rows
  const heat = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const m of shownM.filter((x) => x.heat)) {
      const vs = filtered.map((r) => (r.d ? m.get(r.d, tot) : null)).filter((v): v is number => v !== null).sort((a, b) => a - b);
      if (vs.length > 3) out[m.key] = [vs[Math.floor(vs.length * 0.05)], vs[Math.floor(vs.length * 0.95)]];
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, hub.metrics]);
  const shade = (m: Metric, v: number | null): CSSProperties | undefined => {
    const h = heat[m.key];
    if (!h || v === null || h[1] <= h[0]) return undefined;
    const t = Math.max(0, Math.min(1, (v - h[0]) / (h[1] - h[0])));
    const tone = m.heat === "down" ? "var(--bad)" : m.key === "cvr" ? "var(--good)" : "var(--accent)";
    return { "--heat": tone, "--ha": `${Math.round(t * 16)}%` } as CSSProperties;
  };

  const head = (key: string, label: string, num: boolean, sub?: string) => (
    <th key={key} scope="col" className={cx(num && "n", "sortable", sort.key === key && "sorted")} aria-sort={sort.key === key ? (sort.dir === -1 ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: num ? -1 : 1 }))}>
        {label}
        <span className="arr" aria-hidden="true">
          {sort.key === key ? (sort.dir === -1 ? "↓" : "↑") : ""}
        </span>
      </button>
      {sub ? <small>{sub}</small> : null}
    </th>
  );
  const fmtCol = (c: Col<R>, r: R) => {
    if (c.render) return c.render(r);
    const v = c.get(r);
    if (v === null || v === "") return <span className="na">—</span>;
    return typeof v === "number" && c.fmt ? c.fmt(v) : v;
  };

  const exportCsv = () => {
    const headers = [...cols.map((c) => c.label), ...shownM.map((m) => m.label), ...(deltas ? ["Spend Δ", "Sales Δ"] : [])];
    const body = sorted.map((r) => [
      ...cols.map((c) => c.get(r) ?? ""),
      ...shownM.map((m) => {
        const v = r.d ? m.get(r.d, tot) : null;
        return v === null ? "" : Math.round(v * 100) / 100;
      }),
      ...(deltas ? [valOf(r, "spendD") ?? "", valOf(r, "salesD") ?? ""] : []),
    ]);
    downloadCsv(`${id}-${DAYS[0].iso}.csv`, [headers, ...body] as (string | number)[][]);
  };
  const colCount = cols.length + shownM.length + (deltas ? 2 : 0) + (actions ? 1 : 0);
  const reset = () => setPageN(0);

  return (
    <section className="panel flush" aria-label={typeof title === "string" ? title : id}>
      <div className="ph-row between">
        <div className="ph-t">
          <h2 className="ph">{title}</h2>
          {info ? <Info label={typeof title === "string" ? title : id}>{info}</Info> : null}
        </div>
        <p className="tot">
          <b>{int.format(filtered.length)}</b> rows{lead ? <> · {lead}</> : null}
        </p>
      </div>
      <div className={st.tbar}>
        <div className="filters">
          {tabs ? (
            <Segmented
              label="View"
              size="sm"
              value={String(tab)}
              onChange={(v) => {
                setTab(Number(v));
                reset();
              }}
              options={tabs.map((t, i) => ({ value: String(i), label: `${t.label} · ${rows.filter(t.test).length}` }))}
            />
          ) : null}
          {chips?.length ? (
            <MultiSelect
              label="Quick filters"
              value={on}
              onChange={(v) => {
                setOn(v);
                reset();
              }}
              options={chips.map((c) => ({ value: c.label, label: `${c.label} · ${tabRows.filter(c.test).length}` }))}
            />
          ) : null}
          {tools}
        </div>
        <div className="filters">
          {metrics ? (
            <MultiSelect
              label="Columns"
              value={hub.metrics}
              onChange={hub.setMetrics}
              options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
              presets={[
                { label: "Default", value: ["clicks", "orders", "spend", "sales", "acos", "cpc", "cvr"] },
                { label: "All", value: METRICS.map((m) => m.key) },
              ]}
            />
          ) : null}
          <button type="button" className="btn sm" onClick={exportCsv}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
            </svg>
            CSV
          </button>
        </div>
      </div>
      <div className="tscroll tall">
        <table className={st.t}>
          <thead>
            <tr>
              {cols.map((c) => head(c.key, c.label, !!c.num, c.sub))}
              {shownM.map((m) => head(m.key, m.label, true))}
              {deltas ? (
                <>
                  {head("spendD", "Spend Δ", true, "vs prior 7 days")}
                  {head("salesD", "Sales Δ", true, "vs prior 7 days")}
                </>
              ) : null}
              {actions ? <th scope="col">{actionsLabel}</th> : null}
            </tr>
          </thead>
          <tbody key={`${tab}${on.join()}${sort.key}${sort.dir}${pg}${per}${hub.period}`} className={st.rows}>
            {view.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="empty">
                  {empty}
                </td>
              </tr>
            ) : null}
            {view.map((r, i) => (
              <tr key={r.key} className={cx(rowClass?.(r))} style={{ "--i": i } as CSSProperties}>
                {cols.map((c, ci) =>
                  ci === 0 ? (
                    <th key={c.key} scope="row" className={cx(c.num && "n", c.name && st.name)}>
                      {fmtCol(c, r)}
                    </th>
                  ) : (
                    <td key={c.key} className={cx(c.num && "n", c.name && st.name)}>
                      {fmtCol(c, r)}
                    </td>
                  ),
                )}
                {shownM.map((m) => {
                  const v = r.d ? m.get(r.d, tot) : null;
                  return (
                    <td key={m.key} className={cx("n", st.heat)} style={shade(m, v)}>
                      {v === null ? <span className="na">—</span> : m.fmt(v)}
                    </td>
                  );
                })}
                {deltas ? (
                  <>
                    <td className="n">{r.d && r.prev ? <Delta value={change(r.d.spend, r.prev.spend)} goodWhen="none" /> : <span className="na">—</span>}</td>
                    <td className="n">{r.d && r.prev ? <Delta value={change(r.d.sales, r.prev.sales)} /> : <span className="na">—</span>}</td>
                  </>
                ) : null}
                {actions ? <td className={st.act}>{actions(r)}</td> : null}
              </tr>
            ))}
          </tbody>
          {filtered.length && metrics ? (
            <tfoot>
              <tr>
                {cols.map((c, ci) =>
                  ci === 0 ? (
                    <th key={c.key} scope="row">
                      Total · {int.format(filtered.length)}
                    </th>
                  ) : (
                    <td key={c.key} className={cx(c.num && "n")}>
                      {c.total ?? ""}
                    </td>
                  ),
                )}
                {shownM.map((m) => {
                  const v = m.get(tot, tot);
                  return (
                    <td key={m.key} className="n">
                      {v === null ? "—" : m.fmt(v)}
                    </td>
                  );
                })}
                {deltas && prevTot ? (
                  <>
                    <td className="n">
                      <Delta value={change(tot.spend, prevTot.spend)} goodWhen="none" />
                    </td>
                    <td className="n">
                      <Delta value={change(tot.sales, prevTot.sales)} />
                    </td>
                  </>
                ) : null}
                {actions ? <td /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {sorted.length > 25 ? (
        <div className={st.pager}>
          <Select
            label="Rows per page"
            value={per}
            options={PAGE}
            onChange={(v) => {
              setPer(v);
              reset();
            }}
          />
          <span>
            {int.format(pg * size + 1)}–{int.format(Math.min(sorted.length, pg * size + size))} of {int.format(sorted.length)}
          </span>
          <button type="button" className="btn sm" disabled={pg === 0} onClick={() => setPageN(pg - 1)}>
            Previous
          </button>
          <button type="button" className="btn sm" disabled={pg >= pages - 1} onClick={() => setPageN(pg + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
