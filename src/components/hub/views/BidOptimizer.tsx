"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { tgtRows, type TgtRow } from "@/lib/hub";
import { acosD, cpcD } from "@/lib/account";
import { eur2, int, pct1 } from "@/lib/format";
import Delta from "../../Delta";
import Segmented from "../../Segmented";
import Select from "../../Select";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import QueueButton from "../QueueButton";
import { StateTag, Tag, useBaseCols } from "../cells";
import st from "../hub.module.css";

const R_CONV = "Converting: CPC × target ÷ ACOS (±30% cap)";
const R_NONE = "No orders after 15+ clicks: −30%";
const R_LOW = "Not enough data (no orders, <15 clicks)";
type BidRow = TgtRow & { cpc: number; base: number; suggested: number | null; delta: number | null; op: "Up" | "Down" | "No change"; rule: string };

const SHOW = ["Changes", "No change", "All"];
const VIEWS = [
  { value: "rows", label: "Rows" },
  { value: "rule", label: "By rule" },
  { value: "pf", label: "By portfolio" },
];

export default function BidOptimizer() {
  const hub = useHub();
  const bc = useBaseCols();
  const [show, setShow] = useState(SHOW[0]);
  const [mode, setMode] = useState("rows");
  const T = hub.target;

  const all = useMemo<BidRow[]>(
    () =>
      tgtRows(hub.period)
        .filter((r) => r.d.clicks > 0)
        .map((r) => {
          const cpc = cpcD(r.d) ?? 0;
          const a = acosD(r.d);
          let suggested: number | null = null;
          let rule = R_LOW;
          if (r.d.orders > 0 && a) {
            suggested = Math.min(1.3 * cpc, Math.max(0.7 * cpc, (cpc * T) / a));
            rule = R_CONV;
          } else if (r.d.clicks >= 15) {
            suggested = 0.7 * cpc;
            rule = R_NONE;
          }
          if (suggested !== null) suggested = Math.max(0.02, Math.round(suggested * 100) / 100);
          const base = r.bid || cpc;
          const delta = suggested === null || !base ? null : ((suggested - base) / base) * 100;
          const op = delta === null || Math.abs(delta) <= 0.5 ? "No change" : delta > 0 ? "Up" : "Down";
          return { ...r, cpc, base, suggested, delta, op, rule };
        }),
    [hub.period, T],
  );
  const scoped = hub.scope(all, (r) => r.text);
  const rows = scoped.filter((r) => (show === "All" ? true : show === "Changes" ? r.op !== "No change" : r.op === "No change"));

  // grouped summary for the "By rule" and "By portfolio" views
  const byGroup = new Map<string, BidRow[]>();
  for (const r of rows) {
    const k = mode === "rule" ? r.rule : r.pf;
    byGroup.set(k, [...(byGroup.get(k) ?? []), r]);
  }
  const groups = [...byGroup.entries()]
    .map(([k, rs]) => ({ k, n: rs.filter((r) => r.op !== "No change").length, up: rs.filter((r) => r.op === "Up").length, down: rs.filter((r) => r.op === "Down").length, same: rs.filter((r) => r.op === "No change").length, spend: rs.reduce((a, r) => a + r.d.spend, 0), camps: new Set(rs.map((r) => r.campaignId)).size }))
    .sort((a, b) => b.spend - a.spend);

  const cols: Col<BidRow>[] = [
    { key: "op", label: "Operation", get: (r) => r.op, render: (r) => <Tag tone={r.op === "Up" ? "good" : r.op === "Down" ? "bad" : undefined}>{r.op === "Up" ? "▲ Up" : r.op === "Down" ? "▼ Down" : "No change"}</Tag> },
    { key: "text", label: "Keyword / target", name: true, get: (r) => r.text },
    { key: "entity", label: "Entity", get: (r) => r.entity },
    { key: "match", label: "Match", get: (r) => (r.match === "PAT" ? "Product" : r.match) },
    { ...bc.campaign<BidRow>(true) },
    bc.adGroup<BidRow>(),
    bc.pf<BidRow>(),
    { key: "state", label: "State", get: (r) => r.state, render: (r) => <StateTag s={r.state} /> },
    { key: "bid", label: "Current bid", num: true, get: (r) => r.bid, fmt: (v) => eur2.format(v) },
    { key: "cpc", label: "Avg. CPC", num: true, get: (r) => r.cpc, fmt: (v) => eur2.format(v) },
    { key: "suggested", label: "Suggested bid", num: true, get: (r) => r.suggested, render: (r) => (r.suggested === null ? <span className="na">—</span> : <b>{eur2.format(r.suggested)}</b>) },
    { key: "delta", label: "Change", num: true, get: (r) => r.delta, render: (r) => (r.delta === null ? <span className="na">—</span> : <Delta value={r.delta} goodWhen="none" />) },
    { key: "rule", label: "Rule", get: (r) => r.rule, render: (r) => <span className={st.muted}>{r.rule}</span> },
  ];

  const tools = (
    <>
      <Select label="Show" value={show} options={SHOW} onChange={setShow} />
      <label className={st.lbl}>
        Target ACOS %
        <input className={st.numIn} inputMode="decimal" value={T} onChange={(e) => hub.setTarget(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))} aria-label="Target ACOS in percent" />
      </label>
    </>
  );

  return (
    <View>
      <section className="panel">
        <div className={st.ctlRow}>
          <Segmented label="View" value={mode} onChange={setMode} options={VIEWS} />
          <span className="tot">
            <b>{int.format(scoped.filter((r) => r.op === "Up").length)}</b> to raise · <b>{int.format(scoped.filter((r) => r.op === "Down").length)}</b> to lower · {int.format(scoped.filter((r) => r.suggested === null).length)} without enough data · target ACOS {pct1.format(T)}%
          </span>
        </div>
      </section>
      {mode === "rows" ? (
        <HubTable
          id="bid-optimizer"
          title="Suggested bids"
          info={
            <>
              <p>
                <b>Converting:</b> suggested bid = average CPC × target ACOS ÷ ACOS, kept within ±30% of the CPC.
              </p>
              <p>
                <b>No orders after 15+ clicks:</b> 30% below the average CPC. Targets with no orders and fewer than 15 clicks get no suggestion.
              </p>
              <p>Change compares the suggestion with the current bid (or the CPC when there is no bid). Within ±0,5% counts as no change.</p>
            </>
          }
          rows={rows}
          cols={cols}
          metrics
          sort={{ key: "spend", dir: -1 }}
          tabs={[
            { label: "All", test: () => true },
            { label: "Raise", test: (r) => r.op === "Up" },
            { label: "Lower", test: (r) => r.op === "Down" },
          ]}
          tools={tools}
          actions={(r) =>
            r.suggested !== null && r.op !== "No change" ? (
              <QueueButton source="bid-optimizer" label={`Apply ${eur2.format(r.suggested)}`} change={{ action: "targeting.bid", campaign: r.campaign, adGroup: r.adGroup, entity: r.text, current: r.bid, proposed: r.suggested }} />
            ) : null
          }
        />
      ) : (
        <section className="panel flush" aria-label="Bid changes grouped">
          <div className="ph-row between">
            <h2 className="ph">{mode === "rule" ? "By rule" : "By portfolio"}</h2>
            <div className="filters">{tools}</div>
          </div>
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{mode === "rule" ? "Rule" : "Portfolio"}</th>
                  <th scope="col" className="n">
                    Campaigns
                  </th>
                  <th scope="col" className="n">
                    Updates
                  </th>
                  <th scope="col" className="n">
                    ▲ Up
                  </th>
                  <th scope="col" className="n">
                    ▼ Down
                  </th>
                  <th scope="col" className="n">
                    No change
                  </th>
                  <th scope="col" className="n">
                    Spend
                  </th>
                </tr>
              </thead>
              <tbody key={`${mode}${show}${T}`} className={st.rows}>
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">
                      No targets match the filters.
                    </td>
                  </tr>
                ) : null}
                {groups.map((g, i) => (
                  <tr key={g.k} style={{ "--i": i } as CSSProperties}>
                    <th scope="row">{g.k}</th>
                    <td className="n">{int.format(g.camps)}</td>
                    <td className="n strong">{int.format(g.n)}</td>
                    <td className="n">{int.format(g.up)}</td>
                    <td className="n">{int.format(g.down)}</td>
                    <td className="n">{int.format(g.same)}</td>
                    <td className="n">{eur2.format(g.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </View>
  );
}
