"use client";

import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { DAYS, acosD } from "@/lib/account";
import { eur2, int, pct1 } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { cx } from "@/lib/cx";
import Info from "../../Info";
import Segmented from "../../Segmented";
import Select from "../../Select";
import { useHub } from "../HubContext";
import { View } from "../HubTable";
import QueueButton from "../QueueButton";
import { Tag } from "../cells";
import { FROM, PRIORITIES, STEPS, improvements, type Item, type Step } from "./improvementRules";
import st from "../hub.module.css";

// status and notes live in this browser only, read through an external-store subscription
type Mark = { status: "marked" | "skipped" | "done"; step?: Step; note?: string };
const KEY = "hub:impr";
const EVT = "hub:impr";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
};
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const memo = new Map<string, Record<string, Mark>>();
const EMPTY: Record<string, Mark> = {};
const parse = (raw: string | null) => {
  if (!raw) return EMPTY;
  if (!memo.has(raw)) {
    try {
      memo.set(raw, JSON.parse(raw));
    } catch {
      memo.set(raw, EMPTY);
    }
  }
  return memo.get(raw)!;
};
const save = (id: string, patch: Partial<Mark> | null) => {
  const cur = { ...parse(read()) };
  if (patch === null) delete cur[id];
  else cur[id] = { ...(cur[id] ?? { status: "marked" }), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    // storage blocked: marks last until reload
  }
  window.dispatchEvent(new Event(EVT));
};

const SHOW = [
  { value: "todo", label: "To do" },
  { value: "marked", label: "Marked" },
  { value: "closed", label: "Skipped / done" },
];
const ALL_FROM = "All sources";
const ALL_PRI = "Any priority";
const TONE = { High: "bad", Medium: "warn", Low: undefined } as const;

export default function Improvements() {
  const hub = useHub();
  const marks = parse(useSyncExternalStore(subscribe, read, () => null));
  const [from, setFrom] = useState(ALL_FROM);
  const [pri, setPri] = useState(ALL_PRI);
  const [show, setShow] = useState("todo");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(100);

  const all = useMemo(() => improvements(hub.period, hub.target), [hub.period, hub.target]);
  const scoped = all.filter((i) => (!hub.f.pf || i.pf === hub.f.pf) && (!hub.f.campaign || i.where === hub.f.campaign || i.item === hub.f.campaign));
  const stateOf = (i: Item): Mark["status"] | "todo" => marks[i.id]?.status ?? "todo";
  const inShow = (i: Item) => (show === "todo" ? stateOf(i) === "todo" : show === "marked" ? stateOf(i) === "marked" : stateOf(i) === "skipped" || stateOf(i) === "done");
  const needles = q
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const base = scoped.filter((i) => inShow(i) && (pri === ALL_PRI || i.priority === pri) && (!needles.length || needles.some((n) => `${i.item} ${i.where} ${i.why}`.toLowerCase().includes(n))));
  const rows = base.filter((i) => from === ALL_FROM || i.from === from.replace(/ · \d+$/, ""));
  const count = (p: string) => scoped.filter((i) => stateOf(i) === "todo" && i.priority === p).length;

  const setStep = (i: Item, step: string) => {
    const s = step as Step;
    save(i.id, { step: s, status: s === "Skipped" ? "skipped" : s === "Done" ? "done" : "marked" });
  };
  const exportCsv = () =>
    downloadCsv(`improvements-${DAYS[0].iso}.csv`, [
      ["Item", "Kind", "Priority", "From", "Where", "Spend", "Orders", "ACOS", "Why", "Next step", "Note"],
      ...rows.map((i) => [i.item, i.kind, i.priority, i.from, i.where, i.d ? Math.round(i.d.spend * 100) / 100 : "", i.d?.orders ?? "", i.d ? (acosD(i.d) ?? "") : "", i.why, marks[i.id]?.step ?? i.step, marks[i.id]?.note ?? ""]),
    ]);

  return (
    <View>
      <section className="panel" aria-label="Open improvements by priority">
        <div className={st.tiles} style={{ "--cols": 4 } as CSSProperties}>
          {PRIORITIES.map((p, k) => (
            <button key={p} type="button" className={cx(st.tile, pri === p && st.on)} aria-pressed={pri === p} onClick={() => setPri(pri === p ? ALL_PRI : p)} style={{ "--i": k } as CSSProperties}>
              <span className={st.tl}>{p} priority</span>
              <span className={st.tv}>{int.format(count(p))}</span>
              <span className={st.td}>to do</span>
            </button>
          ))}
          <div className={st.tile} style={{ "--i": 3 } as CSSProperties}>
            <span className={st.tl}>Target ACOS</span>
            <span className={st.tv}>
              <input className={st.numIn} inputMode="numeric" value={hub.target} onChange={(e) => hub.setTarget(Math.max(1, Math.min(200, Number(e.target.value.replace(/\D/g, "")) || 1)))} aria-label="Target ACOS in percent" /> %
            </span>
            <span className={st.td}>drives the bid rules</span>
          </div>
        </div>
      </section>

      <section className="panel flush" aria-labelledby="im-h">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 id="im-h" className="ph">
              Improvements
            </h2>
            <Info label="How items are found">
              <p>
                <b>Coverage:</b> search terms with 2+ orders not targeted as Exact (or as a product, for ASINs); High from 5 orders. <b>Negatives:</b> search terms with €40+ spend and no order; High from €100.
              </p>
              <p>
                <b>Bids:</b> keywords and product targets with ACOS over 1,6× target and €50+ spend get a lower bid (High over 2,5×); 3+ orders under half the target get a higher one. Suggested bid = CPC × target ÷ ACOS, within ±30%.
              </p>
              <p>
                <b>Budget:</b> SP campaigns at budget on 3+ of the last 7 days; High when their ACOS is at or under the account&apos;s. <b>Campaigns:</b> €150+ spend without an order. <b>SQP:</b> queries where our conversion is under half the market&apos;s with 20+ clicks.
              </p>
              <p>Next step and notes are kept in this browser. The portfolio and campaign filters above apply here too.</p>
            </Info>
          </div>
          <p className="tot">
            <b>{int.format(rows.length)}</b> items
          </p>
        </div>
        <div className={st.tbar}>
          <div className="filters">
            <Select label="From" value={from === ALL_FROM ? ALL_FROM : `${from.replace(/ · \d+$/, "")} · ${base.filter((i) => i.from === from.replace(/ · \d+$/, "")).length}`} options={[ALL_FROM, ...FROM.map((f) => `${f} · ${base.filter((i) => i.from === f).length}`)]} onChange={setFrom} />
            <Select label="Priority" value={pri} options={[ALL_PRI, ...PRIORITIES]} onChange={setPri} />
            <Segmented label="Show" size="sm" value={show} onChange={setShow} options={SHOW} />
            <input type="search" className={st.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, comma for several" aria-label="Search improvements" />
          </div>
          <div className="filters">
            <button type="button" className="btn sm" onClick={exportCsv}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
              </svg>
              CSV
            </button>
          </div>
        </div>
        <div className="tscroll tall">
          <table>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Priority</th>
                <th scope="col">From</th>
                <th scope="col">Where</th>
                <th scope="col" className="n">
                  Spend
                </th>
                <th scope="col" className="n">
                  Orders
                </th>
                <th scope="col" className="n">
                  ACOS
                </th>
                <th scope="col">Why</th>
                <th scope="col">Next step</th>
                <th scope="col">Note</th>
                <th scope="col">Queue</th>
              </tr>
            </thead>
            <tbody key={`${from}${pri}${show}${hub.period}${hub.target}`} className={st.rows}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty">
                    {show === "todo" ? "Nothing left to do with these filters." : "No items here yet."}
                  </td>
                </tr>
              ) : null}
              {rows.slice(0, limit).map((i, k) => {
                const m = marks[i.id];
                const a = i.d ? acosD(i.d) : null;
                return (
                  <tr key={i.id} style={{ "--i": k } as CSSProperties}>
                    <th scope="row" className={st.name}>
                      {i.item}
                      <small>{i.kind}</small>
                    </th>
                    <td>
                      <Tag tone={TONE[i.priority]}>{i.priority}</Tag>
                    </td>
                    <td>{i.from}</td>
                    <td className={st.name}>
                      {i.where}
                      <small>{i.pf}</small>
                    </td>
                    <td className="n">{i.d ? eur2.format(i.d.spend) : <span className="na">—</span>}</td>
                    <td className="n">{i.d ? int.format(i.d.orders) : <span className="na">—</span>}</td>
                    <td className="n">{a === null ? <span className="na">—</span> : `${pct1.format(a)}%`}</td>
                    <td className={st.name}>{i.why}</td>
                    <td>
                      <select className={st.cellSelect} value={m?.step ?? ""} onChange={(e) => (e.target.value ? setStep(i, e.target.value) : save(i.id, null))} aria-label={`Next step for ${i.item}`}>
                        <option value="">{i.step} (suggested)</option>
                        {STEPS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input className={st.cellInput} value={m?.note ?? ""} onChange={(e) => save(i.id, { note: e.target.value, status: m?.status ?? "marked" })} placeholder="Add a note" aria-label={`Note for ${i.item}`} />
                    </td>
                    <td className={st.act}>{i.change ? <QueueButton source="improvements" label={i.change.label} change={i.change} /> : <span className="na">outside Ads</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > limit ? (
          <div className={st.pager}>
            <span>
              Showing {int.format(limit)} of {int.format(rows.length)}
            </span>
            <button type="button" className="btn sm" onClick={() => setLimit(limit + 100)}>
              Show 100 more
            </button>
          </div>
        ) : null}
      </section>
    </View>
  );
}
