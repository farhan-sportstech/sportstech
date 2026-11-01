"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { DAYS, account, acosD, cpcD, sumDays, type Day } from "@/lib/account";
import { eur, eur2, int, pct1 } from "@/lib/format";
import { cx } from "@/lib/cx";
import { useReveal } from "@/lib/motion";
import CountUp from "../CountUp";
import Info from "../Info";
import Segmented from "../Segmented";
import d from "../dash.module.css";
import st from "./ppc.module.css";

// lower bound inclusive; the last ACOS row holds entities that spent without any sale
const ACOS_T = [
  { label: "<10%", lo: 0 },
  { label: "10–20%", lo: 10 },
  { label: "20–30%", lo: 20 },
  { label: "30–50%", lo: 30 },
  { label: "50–100%", lo: 50 },
  { label: "≥100%", lo: 100 },
];
const CPC_T = [
  { label: "<0,40", lo: 0 },
  { label: "0,40–0,70", lo: 0.4 },
  { label: "0,70–1,00", lo: 0.7 },
  { label: "1,00–1,50", lo: 1 },
  { label: "1,50–2,50", lo: 1.5 },
  { label: "≥2,50", lo: 2.5 },
];
const NO_SALES = ACOS_T.length;
const tierOf = (tiers: { lo: number }[], v: number) => tiers.reduce((k, t, i) => (v >= t.lo ? i : k), 0);

type Src = "campaigns" | "targets";
type Ent = { id: string; name: string; sub: string; type: string; t: Day };

export default function Tiers() {
  const [src, setSrc] = useState<Src>("campaigns");
  const [type, setType] = useState("all");
  const [pick, setPick] = useState<{ a: number; c: number } | null>(null);
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);

  const camps: Ent[] = useMemo(() => account.campaigns.map((c) => ({ id: c.id, name: c.name, sub: `${c.portfolio} · ${c.strategy}`, type: c.type, t: sumDays(c.days) })).filter((e) => e.t.clicks > 0), []);
  const tgts: Ent[] = useMemo(() => {
    const typeOf = new Map(account.campaigns.map((c) => [c.id, c.type]));
    return account.targets
      .filter((t) => t.t.clicks > 0)
      .sort((a, b) => b.t.spend - a.t.spend)
      .slice(0, 300)
      .map((t) => ({ id: t.id, name: t.text, sub: `${t.match} · ${t.campaign}`, type: typeOf.get(t.campaignId) ?? "SP", t: t.t }));
  }, []);
  const ents = (src === "campaigns" ? camps : tgts).filter((e) => type === "all" || e.type === type);

  // bucket every entity, spend-weighted: each cell sums spend, sales and clicks of the entities in it
  const grid = useMemo(() => {
    const g = Array.from({ length: ACOS_T.length + 1 }, () => CPC_T.map(() => ({ spend: 0, sales: 0, clicks: 0, n: 0, ents: [] as Ent[] })));
    for (const e of ents) {
      const cpc = cpcD(e.t) ?? 0;
      const a = acosD(e.t);
      const cell = g[a === null ? NO_SALES : tierOf(ACOS_T, a)][tierOf(CPC_T, cpc)];
      cell.spend += e.t.spend;
      cell.sales += e.t.sales;
      cell.clicks += e.t.clicks;
      cell.n += 1;
      cell.ents.push(e);
    }
    return g;
  }, [ents]);
  const total = grid.flat().reduce((s, c) => s + c.spend, 0);
  const colTot = CPC_T.map((_, c) => grid.reduce((s, row) => s + row[c].spend, 0));
  const store = account.campaigns.reduce((s, c) => s + sumDays(c.days).spend, 0);
  const covered = ents.reduce((s, e) => s + e.t.spend, 0);
  const picked = pick ? grid[pick.a][pick.c] : null;
  const pickedRows = picked ? [...picked.ents].sort((a, b) => b.t.spend - a.t.spend) : [];
  // the share of spend that sits in the expensive corner: ACOS 50%+ or no sales
  const risky = grid.slice(4).flat().reduce((s, c) => s + c.spend, 0);
  const typeLabel = type === "all" ? "All" : type;

  return (
    <div className="wdp" ref={page}>
      <header className={d["pg-head"]}>
        <div className="pg-title">
          <div className={d["pg-h"]}>
            <h1>ACOS &amp; CPC tiers</h1>
            <span className={d["pg-kw"]}>
              Last 30 days
              <small>
                {DAYS[DAYS.length - 1].label} – {DAYS[0].label}
              </small>
            </span>
          </div>
          <p className={d.meta}>Amazon.de · EUR · spend-weighted buckets of ACOS × CPC</p>
        </div>
        <div className={d["pg-ctl"]}>
          <Segmented
            label="Source"
            value={src}
            onChange={(v) => {
              setSrc(v);
              setPick(null);
            }}
            options={[
              { value: "campaigns", label: `Campaigns · ${camps.length}` },
              { value: "targets", label: `Targets · ${tgts.length}` },
            ]}
          />
          <Segmented
            label="Ad type"
            value={type}
            onChange={(v) => {
              setType(v);
              setPick(null);
            }}
            options={["all", "SP", "SB", "SD"].map((v) => ({ value: v, label: v === "all" ? "All" : v }))}
          />
        </div>
      </header>

      <section className="panel flush" aria-labelledby="ti-h">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 id="ti-h" className="ph">
              Spend by ACOS (rows) × CPC (columns)
            </h2>
            <Info label="How the matrix is built">
              <p>Each campaign or target lands in one cell from its 30-day CPC (spend ÷ clicks) and ACOS (spend ÷ ad sales); a lower bound belongs to its tier. Entities with spend and no sales sit in the last row.</p>
              <p>Cells show spend and its share of the selected total; the deeper the blue, the bigger the share. Targets are keyword and product targets with clicks, the top 300 by spend. Click a cell to list what is in it.</p>
            </Info>
          </div>
          <p className="tot">
            {typeLabel} {src} · <b>{eur.format(total)}</b> · <b className={risky / (total || 1) > 0.25 ? st.warnT : undefined}>{pct1.format((risky / (total || 1)) * 100)}%</b> at ACOS 50%+ or no sales
          </p>
        </div>
        <p className={st.note}>
          Coverage: {src} hold <b>{eur.format(covered)}</b> ({pct1.format((covered / store) * 100)}%) of the account&apos;s <b>{eur.format(store)}</b> ad spend in the window.
        </p>
        <div className="tscroll">
          <table className={st.matrix}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left" }}>
                  ACOS \ CPC €
                </th>
                {CPC_T.map((c) => (
                  <th key={c.label} scope="col" className="n">
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="n">
                  Total
                </th>
              </tr>
            </thead>
            <tbody key={`${src}${type}`} className={st.rows}>
              {[...ACOS_T.map((a) => a.label), "no sales"].map((label, a) => {
                const rowTot = grid[a].reduce((s, c) => s + c.spend, 0);
                return (
                  <tr key={label} style={{ "--i": a } as CSSProperties}>
                    <th scope="row" style={{ textAlign: "left" }}>
                      {label}
                    </th>
                    {grid[a].map((cell, c) => {
                      const share = total ? cell.spend / total : 0;
                      const on = pick?.a === a && pick.c === c;
                      return cell.n === 0 ? (
                        <td key={c} className="n">
                          <span className={st.dot}>·</span>
                        </td>
                      ) : (
                        <td
                          key={c}
                          className={cx("n", st.cell, share > 0.12 && st.hot, on && st.picked)}
                          style={{ "--a": Math.min(80, share * 250) } as CSSProperties}
                          title={`${cell.n} ${src}, ACOS ${cell.sales ? `${pct1.format((cell.spend / cell.sales) * 100)}%` : "no sales"}`}
                          tabIndex={0}
                          aria-pressed={on}
                          onClick={() => setPick(on ? null : { a, c })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setPick(on ? null : { a, c });
                            }
                          }}
                        >
                          <b>{eur.format(cell.spend)}</b>
                          <small>
                            {pct1.format(share * 100)}% · {cell.n}
                          </small>
                        </td>
                      );
                    })}
                    <td className="n strong">{rowTot ? eur.format(rowTot) : <span className={st.dot}>·</span>}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" style={{ textAlign: "left" }}>
                  Total
                </th>
                {colTot.map((v, c) => (
                  <td key={c} className="n">
                    {v ? eur.format(v) : "·"}
                  </td>
                ))}
                <td className="n">
                  <CountUp value={total} kind="eur" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {picked ? (
        <section className="panel flush" aria-labelledby="tp-h">
          <div className="ph-row between">
            <h2 id="tp-h" className="ph">
              ACOS {pick!.a === NO_SALES ? "no sales" : ACOS_T[pick!.a].label} · CPC €{CPC_T[pick!.c].label}
            </h2>
            <p className="tot">
              <b>{picked.n}</b> {src} · {eur.format(picked.spend)} spend
              <button type="button" className="btn sm" style={{ marginLeft: 12 }} onClick={() => setPick(null)}>
                Close
              </button>
            </p>
          </div>
          <div className="tscroll tall">
            <table>
              <thead>
                <tr>
                  <th scope="col">{src === "campaigns" ? "Campaign" : "Target"}</th>
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
                    Clicks
                  </th>
                  <th scope="col" className="n">
                    CPC
                  </th>
                  <th scope="col" className="n">
                    Orders
                  </th>
                </tr>
              </thead>
              <tbody key={`${pick!.a}${pick!.c}${src}${type}`} className={st.rows}>
                {pickedRows.map((e, i) => {
                  const a = acosD(e.t);
                  return (
                    <tr key={e.id} style={{ "--i": i } as CSSProperties}>
                      <th scope="row" className={st.name}>
                        {e.name}
                        <small>
                          {e.type} · {e.sub}
                        </small>
                      </th>
                      <td className="n strong">{eur2.format(e.t.spend)}</td>
                      <td className="n">{eur.format(e.t.sales)}</td>
                      <td className="n">{a === null ? <span className="na">—</span> : `${pct1.format(a)}%`}</td>
                      <td className="n">{int.format(e.t.clicks)}</td>
                      <td className="n">{eur2.format(cpcD(e.t) ?? 0)}</td>
                      <td className="n">{int.format(e.t.orders)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
