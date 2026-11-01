"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { OvRow } from "@/lib/mock";
import { useHomeData } from "@/lib/homeData";
import { acosOf, eur, eur2, int, pct1, pct2, tacosOf } from "@/lib/format";
import Segmented from "./Segmented";
import Info from "./Info";

type Mode = "daily" | "weekly" | "monthly";
const LABEL: Record<Mode, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
// [label, source] per column; the source shows on hover
const HEADS: [string, string][] = [
  ["Orders", "tool4seller"],
  ["Units", "tool4seller"],
  ["Sales", "tool4seller"],
  ["Profit", "tool4seller"],
  ["Ads", "tool4seller advertising by ASIN"],
  ["ACOS", "tool4seller advertising by ASIN"],
  ["TACoS", "tool4seller"],
  ["Organic orders", "tool4seller"],
  ["PPC sales", "tool4seller advertising by ASIN"],
  ["PPC orders", "tool4seller advertising by ASIN"],
  ["Sessions", "Agent Central"],
  ["Conversion", "Agent Central"],
  ["Avg price", "tool4seller"],
];
const COLS = [170, 92, 92, 132, 122, 122, 84, 84, 132, 132, 108, 100, 108, 104];
const EXT_HEADS: [string, string][] = [
  ["Margin", "tool4seller profit ÷ sales"],
  ["Refunds", "tool4seller"],
  ["Refund rate", "refunds ÷ sales"],
  ["Payout", "tool4seller settlement estimate"],
];
const EXT_COLS = [96, 112, 104, 120];
const SPAN: Record<Mode, string> = { daily: "30 days", weekly: "5 weeks", monthly: "5 months" };

function total(rows: OvRow[]): OvRow {
  const s = (f: (r: OvRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const withSessions = rows.filter((r) => r.sessions !== null);
  const sessions = withSessions.reduce((a, r) => a + (r.sessions ?? 0), 0);
  const units = s((r) => r.units);
  const sales = s((r) => r.sales);
  const ads = s((r) => r.ads);
  const ppcSales = s((r) => r.ppcSales);
  return {
    label: "Sum",
    sub: SPAN.daily,
    orders: s((r) => r.orders),
    units,
    sales,
    profit: s((r) => r.profit),
    ads,
    acos: acosOf(ads, ppcSales),
    tacos: tacosOf(ads, sales),
    organicOrders: s((r) => r.organicOrders),
    ppcSales,
    ppcOrders: s((r) => r.ppcOrders),
    sessions,
    conversion: sessions ? (withSessions.reduce((a, r) => a + r.units, 0) / sessions) * 100 : null,
    avgPrice: units ? sales / units : 0,
    margin: sales ? (s((r) => r.profit) / sales) * 100 : 0,
    refunds: s((r) => r.refunds ?? 0),
    refundRate: sales ? (s((r) => r.refunds ?? 0) / sales) * 100 : 0,
    payout: s((r) => r.payout ?? 0),
  };
}

function Cells({ r, extended }: { r: OvRow; extended?: boolean }) {
  const pending = <span className="na">pending</span>;
  return (
    <>
      <td className="n">{int.format(r.orders)}</td>
      <td className="n">{int.format(r.units)}</td>
      <td className="n">{eur.format(r.sales)}</td>
      <td className={`n${r.profit < 0 ? " neg" : ""}`}>{eur.format(r.profit)}</td>
      <td className="n">{eur.format(r.ads)}</td>
      <td className="n">{pct1.format(r.acos)}%</td>
      <td className="n">{pct1.format(r.tacos)}%</td>
      <td className="n">{int.format(r.organicOrders)}</td>
      <td className="n">{eur.format(r.ppcSales)}</td>
      <td className="n">{int.format(r.ppcOrders)}</td>
      <td className="n">{r.sessions === null ? pending : int.format(r.sessions)}</td>
      <td className="n">{r.conversion === null ? pending : `${pct2.format(r.conversion)}%`}</td>
      <td className="n">{eur2.format(r.avgPrice)}</td>
      {extended ? (
        <>
          <td className={`n${(r.margin ?? 0) < 0 ? " neg" : ""}`}>{pct1.format(r.margin ?? 0)}%</td>
          <td className="n">{eur.format(r.refunds ?? 0)}</td>
          <td className="n">{pct2.format(r.refundRate ?? 0)}%</td>
          <td className={`n${(r.payout ?? 0) < 0 ? " neg" : ""}`}>{eur.format(r.payout ?? 0)}</td>
        </>
      ) : null}
    </>
  );
}

type Props = {
  data?: Record<Mode, OvRow[]>;
  scope?: string; // "Whole account" or "This category"
  extended?: boolean; // margin, refunds, refund rate, payout
  extra?: ReactNode; // rendered under the table (category pages: active products and AOV split)
};

export default function Overview({ data: given, scope = "Whole account", extended = false, extra }: Props) {
  const home = useHomeData();
  const data = given ?? home.overview;
  const [mode, setMode] = useState<Mode>("daily");
  const rows = data[mode];
  const heads = extended ? [...HEADS, ...EXT_HEADS] : HEADS;
  const cols = extended ? [...COLS, ...EXT_COLS] : COLS;
  const sum = useMemo(() => ({ ...total(rows), sub: SPAN[mode] }), [rows, mode]);

  return (
    <section id="overview" className="panel flush" aria-labelledby="ov-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="ov-h" className="ph">
            Overview
          </h2>
          <Info label="Overview">
            <p>{scope}. Sum row first, then one row per period.</p>
            <p>Data from tool4seller and Agent Central; hover a column heading for its source.</p>
            <p>Sessions for the newest days arrive late, so those rows show “pending” until the traffic is in.</p>
          </Info>
        </div>
        <Segmented label="Overview period" value={mode} onChange={setMode} options={(Object.keys(LABEL) as Mode[]).map((m) => ({ value: m, label: LABEL[m] }))} />
      </div>
      <div className="tscroll tall">
        <table className="ov" style={{ minWidth: cols.reduce((a, b) => a + b, 0) }}>
          {/* fixed column widths: switching Daily / Weekly / Monthly must not reflow the columns */}
          <colgroup>
            {cols.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{mode === "daily" ? "Date" : mode === "weekly" ? "Week" : "Month"}</th>
              {heads.map(([h, src]) => (
                <th key={h} scope="col" className="n" title={`Source: ${src}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={mode} className="swap">
            <tr className="sumrow">
              <th scope="row">
                {sum.label}
                <small>{sum.sub}</small>
              </th>
              <Cells r={sum} extended={extended} />
            </tr>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">
                  {r.label}
                  {r.sub ? <small>{r.sub}</small> : null}
                </th>
                <Cells r={r} extended={extended} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {extra}
    </section>
  );
}
