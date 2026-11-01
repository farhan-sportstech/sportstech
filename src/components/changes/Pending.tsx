"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { ACTION_LABEL, entityOf, QUEUE_MAX, clearQueue, fmtValue, plansOf, removeChange, sendDemo, updateChange, useQueue, type Change } from "@/lib/queue";
import { cx } from "@/lib/cx";
import { useReveal } from "@/lib/motion";
import Info from "../Info";
import d from "../dash.module.css";
import st from "./changes.module.css";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The editable "New" cell: a number for bids and budgets, a state, or match type plus bid for new targets. */
function NewValue({ c }: { c: Change }) {
  if (c.action === "targeting.bid" || c.action === "campaign.budget") {
    const bid = c.action === "targeting.bid";
    return (
      <span className={st.money}>
        €
        <input
          type="number"
          className={st.num}
          step={bid ? 0.01 : 1}
          min={bid ? 0.02 : 1}
          value={c.proposed}
          aria-label={bid ? "New bid" : "New daily budget"}
          onChange={(e) => updateChange(c.id, Number(e.target.value))}
        />
      </span>
    );
  }
  if (c.action.endsWith(".state"))
    return (
      <select className={st.sel} value={String(c.proposed)} aria-label="New state" onChange={(e) => updateChange(c.id, e.target.value)}>
        <option value="ENABLED">Enabled</option>
        <option value="PAUSED">Paused</option>
      </select>
    );
  const [match, bid] = String(c.proposed).split("|");
  const neg = c.action === "targeting.create.negative";
  const matches = neg ? ["EXACT", "PHRASE"] : ["EXACT", "PHRASE", "BROAD", ...(match === "PAT" ? ["PAT"] : [])];
  return (
    <span className={st.pair}>
      <select className={st.sel} value={match} aria-label="Match type" onChange={(e) => updateChange(c.id, neg ? e.target.value : `${e.target.value}|${bid ?? "0.50"}`)}>
        {matches.map((m) => (
          <option key={m} value={m}>
            {m === "PAT" ? "Product" : m[0] + m.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      {neg ? null : (
        <span className={st.money}>
          €
          <input type="number" className={st.num} step={0.01} min={0.02} value={bid ?? "0.50"} aria-label="Bid" onChange={(e) => updateChange(c.id, `${match}|${e.target.value}`)} />
        </span>
      )}
    </span>
  );
}

export default function Pending() {
  const q = useQueue();
  const [preview, setPreview] = useState(false);
  const [ask, setAsk] = useState<"send" | "clear" | null>(null);
  const [sent, setSent] = useState(0);
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);
  const plans = plansOf(q);

  return (
    <div className="wdp" ref={page}>
      <header className={d["pg-head"]}>
        <div className="pg-title">
          <div className={d["pg-h"]}>
            <h1>Pending changes</h1>
            <span className={d["pg-kw"]}>
              {q.length}
              <small>of {QUEUE_MAX} queued</small>
            </span>
            <Info label="How changes are sent">
              <p>Queue changes from the Ads Hub, adjust the new values here, then preview the plans. Each plan holds up to 20 changes of one kind, the way tool4seller prepares them.</p>
              <p>Once tool4seller is connected, Send prepares each plan there and applies it to Amazon. Until then Send runs in demo mode: the plans go to Change history and nothing reaches Amazon.</p>
            </Info>
          </div>
          <p className={d.meta}>Queue → edit values → preview plans → send · the queue holds up to {QUEUE_MAX} changes</p>
        </div>
      </header>

      <div className={st.banner} role="status">
        <span className={st.bdot} aria-hidden="true" />
        <span>
          <b>Demo mode.</b> tool4seller isn&apos;t connected yet, so sending records the plans in Change history without touching Amazon.
        </span>
      </div>

      {sent ? (
        <div className={cx(st.banner, st.ok)} role="status">
          <span>
            <b>{sent} plan{sent === 1 ? "" : "s"} recorded.</b> <Link href="/writeback/history/">Open Change history</Link>
          </span>
        </div>
      ) : null}

      <section className="panel flush" aria-labelledby="pq-h">
        <div className="ph-row between">
          <h2 id="pq-h" className="ph">
            Queue
          </h2>
          <div className="filters">
            {ask === "clear" ? (
              <span className={st.confirm}>
                Remove all {q.length}?
                <button type="button" className="btn sm" onClick={() => (clearQueue(), setAsk(null), setPreview(false))}>
                  Yes, clear
                </button>
                <button type="button" className="btn sm" onClick={() => setAsk(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" className="btn sm" disabled={!q.length} onClick={() => setAsk("clear")}>
                Clear queue
              </button>
            )}
            <button type="button" className={cx("btn sm", st.primary)} disabled={!q.length} onClick={() => setPreview(true)}>
              Preview plans
            </button>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Change</th>
                <th scope="col">Campaign · ad group</th>
                <th scope="col">From</th>
                <th scope="col" className="n">
                  Current
                </th>
                <th scope="col">New</th>
                <th scope="col">Queued</th>
                <th scope="col" aria-label="Remove" />
              </tr>
            </thead>
            <tbody className={st.rows}>
              {q.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    Nothing queued. Use the Queue buttons in the <Link href="/hub/home/">Ads Hub</Link>.
                  </td>
                </tr>
              ) : null}
              {q.map((c, i) => (
                <tr key={c.id} style={{ "--i": i } as CSSProperties}>
                  <th scope="row" className={st.name}>
                    {entityOf(c)}
                    <small>{ACTION_LABEL[c.action]}</small>
                  </th>
                  <td className={st.name}>
                    {c.campaign}
                    {c.adGroup ? <small>{c.adGroup}</small> : <small>campaign level</small>}
                  </td>
                  <td className={st.muted}>{c.source}</td>
                  <td className="n">{fmtValue(c, c.current)}</td>
                  <td>
                    <NewValue c={c} />
                  </td>
                  <td className={st.muted}>{when(c.queuedAt)}</td>
                  <td>
                    <button type="button" className={st.x} aria-label={`Remove ${c.entity}`} onClick={() => removeChange(c.id)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {preview && plans.length ? (
        <section className="panel flush" aria-labelledby="pp-h">
          <div className="ph-row between">
            <h2 id="pp-h" className="ph">
              {plans.length} plan{plans.length === 1 ? "" : "s"} · {q.length} change{q.length === 1 ? "" : "s"}
            </h2>
            <div className="filters">
              {ask === "send" ? (
                <span className={st.confirm}>
                  Send {plans.length} plan{plans.length === 1 ? "" : "s"} in demo mode?
                  <button
                    type="button"
                    className={cx("btn sm", st.primary)}
                    onClick={() => {
                      sendDemo(plans);
                      setSent(plans.length);
                      setAsk(null);
                      setPreview(false);
                    }}
                  >
                    Yes, send
                  </button>
                  <button type="button" className="btn sm" onClick={() => setAsk(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" className={cx("btn sm", st.primary)} onClick={() => setAsk("send")}>
                  Send (demo)
                </button>
              )}
            </div>
          </div>
          <div className={st.plans}>
            {plans.map((p, i) => (
              <div key={`${p.tool}${i}`} className={st.plan} style={{ "--i": i } as CSSProperties}>
                <h3>
                  Plan {i + 1} <span>{p.tool}</span> <small>{p.changes.length} change{p.changes.length === 1 ? "" : "s"}</small>
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Entity</th>
                      <th scope="col">Campaign</th>
                      <th scope="col" className="n">
                        Old
                      </th>
                      <th scope="col" className="n">
                        New
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.changes.map((c) => (
                      <tr key={c.id}>
                        <th scope="row">{entityOf(c)}</th>
                        <td>{c.campaign}</td>
                        <td className="n">{fmtValue(c, c.current)}</td>
                        <td className="n strong">{fmtValue(c, c.proposed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <details className={st.args}>
                  <summary>Exact tool4seller arguments</summary>
                  <pre>{JSON.stringify(p.changes.map((c) => ({ campaign: c.campaign, adGroup: c.adGroup || undefined, entity: c.entity, value: c.proposed })), null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
