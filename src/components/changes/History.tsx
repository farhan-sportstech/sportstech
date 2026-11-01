"use client";

import Link from "next/link";
import { Fragment, useRef, useState, type CSSProperties } from "react";
import { ACTION_LABEL, entityOf, fmtValue, useHistory } from "@/lib/queue";
import { cx } from "@/lib/cx";
import { useReveal } from "@/lib/motion";
import Select from "../Select";
import d from "../dash.module.css";
import st from "./changes.module.css";

const RESULTS = ["All results", "applied", "error"];
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function History() {
  const h = useHistory();
  const [q, setQ] = useState("");
  const [res, setRes] = useState(RESULTS[0]);
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);
  const needle = q.trim().toLowerCase();
  const rows = h.filter((p) => (res === RESULTS[0] || p.status === res) && (!needle || JSON.stringify(p).toLowerCase().includes(needle)));
  let i = 0;

  return (
    <div className="wdp" ref={page}>
      <header className={d["pg-head"]}>
        <div className="pg-title">
          <div className={d["pg-h"]}>
            <h1>Change history</h1>
            <span className={d["pg-kw"]}>
              {h.length}
              <small>plans sent</small>
            </span>
          </div>
          <p className={d.meta}>Every change sent from the dashboard: plan, old → new, result. Append-only.</p>
        </div>
      </header>

      <section className="panel flush" aria-labelledby="hi-h">
        <div className="ph-row between">
          <h2 id="hi-h" className="ph">
            Sent plans
          </h2>
          <div className="filters">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaign, keyword, plan…" aria-label="Search history" />
            <Select label="Result" value={res} options={RESULTS} onChange={setRes} />
          </div>
        </div>
        <div className="tscroll tall">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Change</th>
                <th scope="col">Campaign</th>
                <th scope="col" className="n">
                  Old → new
                </th>
                <th scope="col">Result</th>
                <th scope="col">Plan</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody className={st.rows}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    {h.length ? "No plans match." : <>No changes sent yet. Queue them in the <Link href="/hub/home/">Ads Hub</Link> and send them from <Link href="/writeback/pending/">Pending changes</Link>.</>}
                  </td>
                </tr>
              ) : null}
              {rows.map((p) => (
                <Fragment key={p.id}>
                  {p.changes.map((c, k) => (
                    <tr key={c.id} className={cx(k === 0 && st.first)} style={{ "--i": i++ } as CSSProperties}>
                      <td className={st.muted}>{k === 0 ? when(p.appliedAt) : ""}</td>
                      <th scope="row" className={st.name}>
                        {entityOf(c)}
                        <small>{ACTION_LABEL[c.action]}</small>
                      </th>
                      <td className={st.name}>{c.campaign}</td>
                      <td className="n">
                        {fmtValue(c, c.current)} → <b>{fmtValue(c, c.proposed)}</b>
                      </td>
                      <td>{k === 0 ? <span className={cx(st.res, p.status === "applied" ? st.good : st.bad)}>{p.status}</span> : null}</td>
                      <td className={st.muted}>{k === 0 ? p.planId : ""}</td>
                      <td className={st.muted}>{k === 0 ? p.note : ""}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
