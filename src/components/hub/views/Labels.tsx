"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { tgtRows, type TgtRow } from "@/lib/hub";
import { acosD, addDay, cpcD, ctrD, cvrD, zeroDay } from "@/lib/account";
import { eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { cx } from "@/lib/cx";
import Info from "../../Info";
import Select from "../../Select";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import { useBaseCols } from "../cells";
import sw from "./Labels.module.css";
import st from "../hub.module.css";

const T = 30;
const LABELS =["Winner", "Converting", "High ACOS", "Spend no sales", "Low data", "Other"] as const;
type Label = (typeof LABELS)[number];
// a small swatch per label, the same marker the chart legends use
const HUE: Record<Label, string> = { Winner: "var(--good)", Converting: "var(--accent)", "High ACOS": "var(--warn)", "Spend no sales": "var(--bad)", "Low data": "color-mix(in srgb, var(--ink) 35%, transparent)", Other: "color-mix(in srgb, var(--ink) 18%, transparent)" };
const Swatch = ({ l }: { l: Label }) => (
  <span className={sw.sw}>
    <i style={{ background: HUE[l] }} />
    {l}
  </span>
);
const RULE: Record<Label, string> = {
  Winner: `3+ orders and ACOS under ${T}%`,
  Converting: `orders and ACOS up to ${T * 1.6}%`,
  "High ACOS": `orders but ACOS over ${T * 1.6}%`,
  "Spend no sales": "no orders, €20+ spend",
  "Low data": "no orders, under €20 spend",
  Other: "no clicks yet",
};

// first match wins
const labelOf = (r: TgtRow): Label => {
  const a = acosD(r.d);
  if (r.d.orders >= 3 && a !== null && a < T) return "Winner";
  if (r.d.orders > 0 && a !== null && a <= T * 1.6) return "Converting";
  if (r.d.orders > 0) return "High ACOS";
  if (r.d.spend >= 20) return "Spend no sales";
  if (r.d.spend > 0) return "Low data";
  return "Other";
};

type LRow = TgtRow & { label: Label };

export default function Labels() {
  const hub = useHub();
  const bc = useBaseCols();
  const [pick, setPick] = useState(0);
  const rows: LRow[] = hub.scope(useMemo(() => tgtRows(hub.period), [hub.period]), (r) => r.text).map((r) => ({ ...r, label: labelOf(r) }));
  const tot = rows.reduce((a, r) => addDay(a, r.d), zeroDay());
  const sum = LABELS.map((l) => {
    const xs = rows.filter((r) => r.label === l);
    return { l, n: xs.length, d: xs.reduce((a, r) => addDay(a, r.d), zeroDay()) };
  });

  const opts = [`All labels · ${rows.length}`, ...sum.map((s) => `${s.l} · ${s.n}`)];
  const cols: Col<LRow>[] = [
    { key: "text", label: "Keyword / target", name: true, get: (r) => r.text },
    { key: "match", label: "Match", get: (r) => (r.match === "PAT" ? "Product" : r.match) },
    { key: "label", label: "Label", get: (r) => r.label, render: (r) => <Swatch l={r.label} /> },
    { ...bc.campaign<LRow>(true) },
  ];
  const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null);

  return (
    <View>
      <section className="panel flush" aria-label="Labels">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 className="ph">Label summary</h2>
            <Info label="How targets are labelled">
              <p>Each target gets the first label that fits, with a fixed target ACOS of {T}%:</p>
              {LABELS.map((l) => (
                <p key={l}>
                  <b>{l}:</b> {RULE[l]}.
                </p>
              ))}
              <p>Click a label to list its targets below.</p>
            </Info>
          </div>
          <p className="tot">
            <b>{int.format(rows.length)}</b> targets
          </p>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col" className="n">Targets</th>
                <th scope="col" className="n">Impr.</th>
                <th scope="col" className="n">Clicks</th>
                <th scope="col" className="n">Orders</th>
                <th scope="col" className="n">Spend</th>
                <th scope="col" className="n">% Spend</th>
                <th scope="col" className="n">Sales</th>
                <th scope="col" className="n">% Sales</th>
                <th scope="col" className="n">ACOS</th>
                <th scope="col" className="n">CTR</th>
                <th scope="col" className="n">CPC</th>
                <th scope="col" className="n">CVR</th>
              </tr>
            </thead>
            <tbody key={hub.period} className={st.rows}>
              {sum.map(({ l, n, d }, i) => {
                const v = (x: number | null, f: (v: number) => string) => (x === null ? <span className="na">—</span> : f(x));
                return (
                  <tr key={l} style={{ "--i": i } as CSSProperties} className={cx(pick === i + 1 && "cur")}>
                    <th scope="row">
                      <button type="button" className="lnk" onClick={() => setPick(pick === i + 1 ? 0 : i + 1)} title={RULE[l]}>
                        <Swatch l={l} />
                      </button>
                    </th>
                    <td className="n strong">{int.format(n)}</td>
                    <td className="n">{int.format(d.impr)}</td>
                    <td className="n">{int.format(d.clicks)}</td>
                    <td className="n">{int.format(d.orders)}</td>
                    <td className="n">{eur2.format(d.spend)}</td>
                    <td className="n">{v(ratio(d.spend, tot.spend), (x) => `${pct1.format(x)}%`)}</td>
                    <td className="n">{eur.format(d.sales)}</td>
                    <td className="n">{v(ratio(d.sales, tot.sales), (x) => `${pct1.format(x)}%`)}</td>
                    <td className="n">{v(acosD(d), (x) => `${pct1.format(x)}%`)}</td>
                    <td className="n">{v(ctrD(d), (x) => `${pct2.format(x)}%`)}</td>
                    <td className="n">{v(cpcD(d), (x) => eur2.format(x))}</td>
                    <td className="n">{v(cvrD(d), (x) => `${pct1.format(x)}%`)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {/* the label switch is shared with the summary above: clicking a label there picks it here */}
      <HubTable
        id="labels"
        title="Targets by label"
        rows={pick ? rows.filter((r) => r.label === LABELS[pick - 1]) : rows}
        cols={cols}
        tools={<Select label="Label" value={opts[pick]} options={opts} onChange={(v) => setPick(opts.indexOf(v))} />}
      />
    </View>
  );
}
