"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ITEMS_PER_ORDER, isBranded, termRows, tgtRows } from "@/lib/hub";
import { DAYS, acosD, addDay, cpcD, ctrD, cvrD, zeroDay, type Day } from "@/lib/account";
import { eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { cx } from "@/lib/cx";
import Select from "../../Select";
import { useHub } from "../HubContext";
import { View } from "../HubTable";
import st from "../hub.module.css";
import os from "./OrderSpread.module.css";

type Item = { d: Day; text: string; match: string; type: string; pf: string };
type Grp = { label: string; test: (x: Item) => boolean; sep?: boolean };
const GROUPS: Grp[] = [
  { label: "All", test: () => true },
  { label: "With orders", test: (x) => x.d.orders > 0, sep: true },
  { label: "No orders", test: (x) => x.d.orders === 0 },
  { label: "1 order", test: (x) => x.d.orders === 1, sep: true },
  { label: "2 orders", test: (x) => x.d.orders === 2 },
  { label: "3+ orders", test: (x) => x.d.orders >= 3 },
  { label: "1–4 clicks", test: (x) => x.d.clicks >= 1 && x.d.clicks <= 4, sep: true },
  { label: "5–9 clicks", test: (x) => x.d.clicks >= 5 && x.d.clicks <= 9 },
  { label: "10+ clicks", test: (x) => x.d.clicks >= 10 },
  { label: "Branded", test: (x) => isBranded(x.text), sep: true },
  { label: "Non-branded", test: (x) => !isBranded(x.text) },
];
const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null);
const COLS: { label: string; get: (d: Day, n: number, t: Day, tn: number) => number | null; fmt: (v: number) => string }[] = [
  { label: "Count", get: (_, n) => n, fmt: (v) => int.format(v) },
  { label: "% Count", get: (_, n, __, tn) => ratio(n, tn), fmt: (v) => `${pct1.format(v)}%` },
  { label: "Impr.", get: (d) => d.impr, fmt: (v) => int.format(v) },
  { label: "Clicks", get: (d) => d.clicks, fmt: (v) => int.format(v) },
  { label: "Orders", get: (d) => d.orders, fmt: (v) => int.format(v) },
  { label: "Spend", get: (d) => d.spend, fmt: (v) => eur2.format(v) },
  { label: "Sales", get: (d) => d.sales, fmt: (v) => eur.format(v) },
  { label: "CTR", get: ctrD, fmt: (v) => `${pct2.format(v)}%` },
  { label: "CPC", get: cpcD, fmt: (v) => eur2.format(v) },
  { label: "CVR", get: cvrD, fmt: (v) => `${pct1.format(v)}%` },
  { label: "ACOS", get: acosD, fmt: (v) => `${pct1.format(v)}%` },
  { label: "% Spend", get: (d, _, t) => ratio(d.spend, t.spend), fmt: (v) => `${pct1.format(v)}%` },
  { label: "% Sales", get: (d, _, t) => ratio(d.sales, t.sales), fmt: (v) => `${pct1.format(v)}%` },
];

function Spread({ id, title, unit, items }: { id: string; title: string; unit: string; items: Item[] }) {
  const tot = items.reduce((a, x) => addDay(a, x.d), zeroDay());
  const rows = GROUPS.map((g) => {
    const xs = items.filter(g.test);
    return { g, n: xs.length, d: xs.reduce((a, x) => addDay(a, x.d), zeroDay()) };
  });
  const exportCsv = () =>
    downloadCsv(`${id}-${DAYS[0].iso}.csv`, [
      ["Group", ...COLS.map((c) => c.label)],
      ...rows.map((r) => [
        r.g.label,
        ...COLS.map((c) => {
          const v = c.get(r.d, r.n, tot, items.length);
          return v === null ? "" : Math.round(v * 100) / 100;
        }),
      ]),
    ]);
  return (
    <section className="panel flush" aria-label={title}>
      <div className="ph-row between">
        <h2 className="ph">{title}</h2>
        <p className="tot">
          <b>{int.format(items.length)}</b> {unit}
          <button type="button" className="btn sm" style={{ marginLeft: 12 }} onClick={exportCsv}>
            CSV
          </button>
        </p>
      </div>
      <div className="tscroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Group</th>
              {COLS.map((c) => (
                <th key={c.label} scope="col" className="n">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={items.length} className={st.rows}>
            {rows.map((r, i) => (
              <tr key={r.g.label} className={cx(r.g.sep && os.sep, i === 0 && os.lead)} style={{ "--i": i } as CSSProperties}>
                <th scope="row">{r.g.label}</th>
                {COLS.map((c) => {
                  const v = c.get(r.d, r.n, tot, items.length);
                  return (
                    <td key={c.label} className={cx("n", c.label === "Count" && "strong")}>
                      {v === null ? <span className="na">—</span> : c.fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const BY = ["Match type", "Ad type", "Portfolio"];

export default function OrderSpread() {
  const hub = useHub();
  const [by, setBy] = useState(BY[0]);
  const terms = hub.scope(useMemo(() => termRows(hub.period), [hub.period]), (r) => `${r.term} ${r.target}`);
  const targets = hub.scope(useMemo(() => tgtRows(hub.period), [hub.period]), (r) => r.text).filter((r) => r.d.impr > 0);

  // search terms are summed by their text across campaigns, so each term counts once
  const termItems = useMemo(() => {
    const m = new Map<string, Item>();
    for (const t of terms) {
      const k = t.term.toLowerCase();
      const cur = m.get(k);
      m.set(k, cur ? { ...cur, d: addDay(cur.d, t.d) } : { d: t.d, text: t.term, match: t.match, type: t.type, pf: t.pf });
    }
    return [...m.values()];
  }, [terms]);
  const tgtItems = useMemo<Item[]>(() => targets.map((t) => ({ d: t.d, text: t.text, match: t.match === "PAT" ? "Product" : t.match, type: t.type, pf: t.pf })), [targets]);

  const waste = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tgtItems) {
      if (t.d.orders > 0) continue;
      const k = by === "Match type" ? t.match : by === "Ad type" ? t.type : t.pf;
      m.set(k, (m.get(k) ?? 0) + t.d.spend);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [tgtItems, by]);
  const wMax = Math.max(...waste.map((w) => w[1]), 1);
  const ipoTot = ITEMS_PER_ORDER.reduce((a, x) => a + x.count, 0);
  const ipoMax = Math.max(...ITEMS_PER_ORDER.map((x) => x.count));

  return (
    <View>
      <Spread id="order-spread-terms" title="Search terms" unit="terms" items={termItems} />
      <Spread id="order-spread-targets" title="Targets" unit="targets with impressions" items={tgtItems} />
      <div className={st.split}>
        <section className="panel" aria-label="Spend without orders">
          <div className={os.hd}>
            <h2 className="ph">Without orders, spend by</h2>
            <Select label="Spend without orders by" value={by} options={BY} onChange={setBy} />
          </div>
          {waste.length === 0 ? (
            <p className="empty">Every target with spend has an order.</p>
          ) : (
            <div key={by} className={os.list}>
              {waste.map(([k, v], i) => (
                <div key={k} className={cx(os.item, os.warm)} style={{ "--i": i } as CSSProperties}>
                  <span title={k}>{k}</span>
                  <span className={os.track}>
                    <i style={{ "--w": v / wMax, "--i": i } as CSSProperties} />
                  </span>
                  <span className={os.val}>{eur.format(v)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel" aria-label="Items per order">
          <div className={os.hd}>
            <h2 className="ph">All orders by items per order</h2>
            <span className="tot">last 28 days · {int.format(ipoTot)} orders</span>
          </div>
          <div className={os.list}>
            {ITEMS_PER_ORDER.map((x, i) => (
              <div key={x.items} className={os.item} style={{ "--i": i } as CSSProperties}>
                <span>{x.items}</span>
                <span className={os.track}>
                  <i style={{ "--w": x.count / ipoMax, "--i": i } as CSSProperties} />
                </span>
                <span className={os.val}>
                  {int.format(x.count)} <span className="na">· {pct1.format((x.count / ipoTot) * 100)}%</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </View>
  );
}
