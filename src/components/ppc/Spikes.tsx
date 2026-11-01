"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ALERT_DAYS, RULES, RULE_TEXT, alertsFor, type Alert, type Rule } from "@/lib/spikes";
import { DAYS, PORTFOLIOS } from "@/lib/account";
import { eur, eur2, pct1 } from "@/lib/format";
import { cx } from "@/lib/cx";
import { useReveal } from "@/lib/motion";
import Bars from "../Bars";
import CountUp from "../CountUp";
import Info from "../Info";
import Select from "../Select";
import d from "../dash.module.css";
import st from "./ppc.module.css";

const TYPES = ["All ad types", "SP", "SB", "SD"];
const SEV = ["Any severity", "High only"];

const fmtNow = (a: Alert, v: number) => (a.unit === "eur" ? eur2.format(v) : a.unit === "pct" ? `${pct1.format(v)}%` : `${v} of 7 days`);
const baseLabel = (a: Alert) =>
  a.rule === "Spend spike" || a.rule === "Spend, no sales" ? `avg ${eur2.format(a.base)}/day` : a.rule === "ACOS spike" ? `14-day ${pct1.format(a.base)}%` : a.rule === "Budget capped" ? `budget ${eur.format(a.c.budget)}/day` : `prior 7 days ${eur.format(a.base)}`;

export default function Spikes() {
  const [day, setDay] = useState(0);
  const [rule, setRule] = useState<Rule | null>(null);
  const [type, setType] = useState(TYPES[0]);
  const [pf, setPf] = useState("All portfolios");
  const [sev, setSev] = useState(SEV[0]);
  const [q, setQ] = useState("");
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);

  // alerts for the 7 days ending at the checked day feed the tiles' bars; index 0 is the checked day
  const week = useMemo(() => Array.from({ length: 7 }, (_, k) => alertsFor(day + k)), [day]);
  const all = week[0];
  const keep = (a: Alert) => (type === TYPES[0] || a.c.type === type) && (pf === "All portfolios" || a.c.portfolio === pf) && (sev === SEV[0] || a.high) && (!q.trim() || a.c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const scoped = all.filter(keep);
  const rows = rule ? scoped.filter((a) => a.rule === rule) : scoped;
  const count = (r: Rule) => scoped.filter((a) => a.rule === r).length;
  const at = DAYS[day];
  const campaigns = new Set(rows.map((a) => a.c.id)).size;

  return (
    <div className="wdp" ref={page}>
      <header className={d["pg-head"]}>
        <div className="pg-title">
          <div className={d["pg-h"]}>
            <h1>Spike alerts</h1>
            <span key={at.iso} className={d["pg-kw"]}>
              {at.label}
              <small>{at.dow}</small>
            </span>
            <Info label="How alerts are raised">
              {RULES.map((r) => (
                <p key={r}>
                  <b>{r}:</b> {RULE_TEXT[r]}
                </p>
              ))}
              <p>The bars in each tile count that rule&apos;s alerts on each of the 7 days up to the day checked, with the filters applied.</p>
              <p>Only enabled campaigns are checked. Rows are ranked by the euros at stake: excess spend, spend without sales, or lost ad sales. High = €40 or more at stake.</p>
            </Info>
          </div>
          <p className={d.meta}>Amazon.de · EUR · campaign daily reports · {at.dow} {at.label} against the 14 days before</p>
        </div>
        <div className={d["pg-ctl"]}>
          <div className={st.stepper} role="group" aria-label="Day checked">
            <button type="button" aria-label="Day before" onClick={() => setDay(day + 1)} disabled={day >= ALERT_DAYS.length - 1}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <span>
              Day <b>{at.dow} {at.label}</b>
            </span>
            <button type="button" aria-label="Day after" onClick={() => setDay(day - 1)} disabled={day <= 0}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* rule tiles double as the filter: click one to list only that rule, click again for all */}
      <section className="panel" aria-label="Alerts by rule">
        <div key={day} className={st.ruleGrid}>
          {RULES.map((r, i) => {
            const n = count(r);
            return (
              <button key={r} type="button" className={cx(st.ruleTile, rule === r && st.on, n === 0 && st.quiet)} aria-pressed={rule === r} onClick={() => setRule(rule === r ? null : r)} style={{ "--i": i } as CSSProperties}>
                <span className={st.rl}>{r}</span>
                <span className={st.rv}>
                  <CountUp value={n} kind="int" />
                </span>
                <span className={st.rd}>{n === 0 ? "nothing flagged" : `€${Math.round(scoped.filter((a) => a.rule === r).reduce((s, a) => s + a.impact, 0)).toLocaleString("de-DE")} at stake`}</span>
                <Bars className={st.tb} values={week.map((w) => w.filter((a) => a.rule === r && keep(a)).length)} labels={week.map((_, k) => `${DAYS[day + k].dow} ${DAYS[day + k].label}`)} format={(v) => `${v} alerts`} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel flush" aria-labelledby="sp-h">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 id="sp-h" className="ph">
              {rule ?? "All alerts"}
            </h2>
            {rule ? <span className="na">{RULE_TEXT[rule]}</span> : null}
          </div>
          <p className="tot">
            <b>{rows.length}</b> alerts · {campaigns} campaigns · {rows.filter((a) => a.high).length} high
          </p>
        </div>
        <div className={st.bar}>
          <div className="filters">
            <input type="search" className={st.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaign" aria-label="Search campaigns" />
            <Select label="Ad type" value={type} options={TYPES} onChange={setType} />
            <Select label="Portfolio" value={pf} options={["All portfolios", ...PORTFOLIOS]} onChange={setPf} />
            <Select label="Severity" value={sev} options={SEV} onChange={setSev} />
          </div>
        </div>
        <div className="tscroll tall">
          <table>
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                <th scope="col">Alert</th>
                <th scope="col" className="n">
                  On the day
                </th>
                <th scope="col" className="n">
                  Compared with
                </th>
                <th scope="col" className="n">
                  At stake
                </th>
                <th scope="col">
                  14 days<small>spend, or sales for a drop</small>
                </th>
              </tr>
            </thead>
            <tbody key={`${day}${rule}${type}${pf}${sev}`} className={st.rows}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No alerts for {at.dow} {at.label} with these filters.
                  </td>
                </tr>
              ) : null}
              {rows.map((a, i) => (
                <tr key={a.key} style={{ "--i": i } as CSSProperties}>
                  <th scope="row" className={st.name}>
                    {a.c.name}
                    <small>
                      {a.c.portfolio} · {a.c.type} · budget {eur.format(a.c.budget)}/day
                    </small>
                  </th>
                  <td>
                    <span className={cx(st.sev, a.high && st.high)}>{a.high ? "High" : "Medium"}</span> {a.rule}
                  </td>
                  <td className="n strong">{fmtNow(a, a.now)}</td>
                  <td className="n">{baseLabel(a)}</td>
                  <td className="n">{eur.format(a.impact)}</td>
                  <td>
                    <Bars className={st.spark} values={a.spark} labels={DAYS.slice(day, day + 14).map((x) => x.label)} format={(v) => eur2.format(v)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
