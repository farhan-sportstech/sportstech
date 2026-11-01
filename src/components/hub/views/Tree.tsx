"use client";

import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { DAYS, acosD, addDay, cpcD, ctrD, cvrD, zeroDay, type Day } from "@/lib/account";
import { eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { cx } from "@/lib/cx";
import Info from "../../Info";
import st from "../hub.module.css";

export type Node = { id: string; label: string; sub?: string; d: Day; count: number; children?: Node[] };

const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null);
const COLS: { label: string; get: (d: Day, t: Day) => number | null; fmt: (v: number) => string }[] = [
  { label: "Impr.", get: (d) => d.impr, fmt: (v) => int.format(v) },
  { label: "Clicks", get: (d) => d.clicks, fmt: (v) => int.format(v) },
  { label: "Orders", get: (d) => d.orders, fmt: (v) => int.format(v) },
  { label: "Spend", get: (d) => d.spend, fmt: (v) => eur2.format(v) },
  { label: "% Spend", get: (d, t) => ratio(d.spend, t.spend), fmt: (v) => `${pct1.format(v)}%` },
  { label: "Sales", get: (d) => d.sales, fmt: (v) => eur.format(v) },
  { label: "% Sales", get: (d, t) => ratio(d.sales, t.sales), fmt: (v) => `${pct1.format(v)}%` },
  { label: "ACOS", get: acosD, fmt: (v) => `${pct1.format(v)}%` },
  { label: "CTR", get: ctrD, fmt: (v) => `${pct2.format(v)}%` },
  { label: "CPC", get: cpcD, fmt: (v) => eur2.format(v) },
  { label: "CVR", get: cvrD, fmt: (v) => `${pct1.format(v)}%` },
];

/** Builds a node from children, summing their metrics and counts. */
export const group = (id: string, label: string, children: Node[], sub?: string): Node => ({
  id,
  label,
  sub,
  children: children.sort((a, b) => b.d.spend - a.d.spend),
  d: children.reduce((a, c) => addDay(a, c.d), zeroDay()),
  count: children.reduce((a, c) => a + c.count, 0),
});

const ids = (ns: Node[]): string[] => ns.flatMap((n) => (n.children?.length ? [n.id, ...ids(n.children)] : []));

/** Collapsible tree table: groups fold open, leaves sit indented under them, a totals row closes it. */
export default function Tree({ id, title, info, nodes, countLabel, tools, depth0 = 1 }: { id: string; title: string; info?: ReactNode; nodes: Node[]; countLabel: string; tools?: ReactNode; depth0?: number }) {
  // groups down to depth0 start open
  const initial = (ns: Node[], dep: number): string[] => (dep >= depth0 ? [] : ns.flatMap((n) => (n.children?.length ? [n.id, ...initial(n.children, dep + 1)] : [])));
  const [open, setOpen] = useState<Set<string>>(() => new Set(initial(nodes, 0)));
  const tot = nodes.reduce((a, n) => addDay(a, n.d), zeroDay());
  const count = nodes.reduce((a, n) => a + n.count, 0);
  const all = ids(nodes);

  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const exportCsv = () => {
    const out: (string | number)[][] = [["Level", "Name", countLabel, ...COLS.map((c) => c.label)]];
    const walk = (ns: Node[], dep: number) =>
      ns.forEach((n) => {
        out.push([dep, n.label, n.count, ...COLS.map((c) => {
          const v = c.get(n.d, tot);
          return v === null ? "" : Math.round(v * 100) / 100;
        })]);
        if (n.children) walk(n.children, dep + 1);
      });
    walk(nodes, 0);
    downloadCsv(`${id}-${DAYS[0].iso}.csv`, out);
  };

  let ri = 0;
  const rows = (ns: Node[], dep: number): ReactNode =>
    ns.map((n) => {
      const kids = !!n.children?.length;
      const isOpen = open.has(n.id);
      return (
        <Fragment key={n.id}>
          <tr style={{ "--i": ri++, "--depth": dep } as CSSProperties}>
            <th scope="row" className={st.name}>
              {kids ? (
                <button type="button" className={st.fold} aria-expanded={isOpen} onClick={() => toggle(n.id)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                  {n.label}
                </button>
              ) : (
                <span className={st.leaf}>{n.label}</span>
              )}
              {n.sub ? <small>{n.sub}</small> : null}
            </th>
            <td className="n">{int.format(n.count)}</td>
            {COLS.map((c) => {
              const v = c.get(n.d, tot);
              return (
                <td key={c.label} className={cx("n", c.label === "Spend" && "strong")}>
                  {v === null ? <span className="na">—</span> : c.fmt(v)}
                </td>
              );
            })}
          </tr>
          {kids && isOpen ? rows(n.children!, dep + 1) : null}
        </Fragment>
      );
    });

  return (
    <section className="panel flush" aria-label={title}>
      <div className="ph-row between">
        <div className="ph-t">
          <h2 className="ph">{title}</h2>
          {info ? <Info label={title}>{info}</Info> : null}
        </div>
        <p className="tot">
          <b>{int.format(count)}</b> {countLabel.toLowerCase()}
        </p>
      </div>
      <div className={st.tbar}>
        <div className="filters">{tools}</div>
        <div className="filters">
          <button type="button" className="btn sm" onClick={() => setOpen(new Set(all))}>
            Expand all
          </button>
          <button type="button" className="btn sm" onClick={() => setOpen(new Set())}>
            Collapse all
          </button>
          <button type="button" className="btn sm" onClick={exportCsv}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
            </svg>
            CSV
          </button>
        </div>
      </div>
      <div className="tscroll tall">
        <table className={st.tree}>
          <thead>
            <tr>
              <th scope="col">Segment</th>
              <th scope="col" className="n">
                {countLabel}
              </th>
              {COLS.map((c) => (
                <th key={c.label} scope="col" className="n">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={st.rows}>
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 2} className="empty">
                  No rows match the filters.
                </td>
              </tr>
            ) : (
              rows(nodes, 0)
            )}
          </tbody>
          {nodes.length ? (
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className="n">{int.format(count)}</td>
                {COLS.map((c) => {
                  const v = c.get(tot, tot);
                  return (
                    <td key={c.label} className="n">
                      {v === null ? "—" : c.fmt(v)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}
