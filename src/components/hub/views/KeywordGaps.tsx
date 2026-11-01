"use client";

import { useMemo, useSyncExternalStore } from "react";
import { RANK_DATES, gapRows, type GapRow } from "@/lib/hub";
import { acosD, cpcD } from "@/lib/account";
import { int } from "@/lib/format";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import QueueButton from "../QueueButton";
import { Tag, useBaseCols } from "../cells";
import st from "../hub.module.css";

const STATUSES = ["Not reviewed", "To launch", "Launched", "Ignore"];
type Mark = { s: string; note: string };

// review status and notes per term, kept in this browser
const KEY = "hub:kgs";
const EVT = "hub:kgs";
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
const save = (marks: Record<string, Mark>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(marks));
  } catch {
    // storage blocked: nothing is kept
  }
  window.dispatchEvent(new Event(EVT));
};

const yes = (on: boolean) => (on ? <Tag tone="good">✓</Tag> : <span className="na">—</span>);
const rankTone = (r: number | null) => (r === null ? undefined : r <= 10 ? "good" : r <= 30 ? "warn" : "bad");

export default function KeywordGaps() {
  const hub = useHub();
  const bc = useBaseCols();
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const marks = useMemo<Record<string, Mark>>(() => {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [raw]);
  const markOf = (t: string) => marks[t] ?? { s: STATUSES[0], note: "" };
  const setMark = (t: string, m: Partial<Mark>) => save({ ...marks, [t]: { ...markOf(t), ...m } });

  const all = useMemo(() => gapRows(hub.period).filter((r) => !r.asin), [hub.period]);
  const rows = hub.scope(all, (r) => r.term);
  const notTargeted = (r: GapRow) => !r.exact && !r.phrase && !r.broad;

  const cols: Col<GapRow>[] = [
    { key: "term", label: "Search term", name: true, get: (r) => r.term, render: (r) => (
      <>
        {r.term}
        {r.isNew ? (
          <small>
            <Tag tone="accent">new this week</Tag>
          </small>
        ) : null}
      </>
    ) },
    { key: "exact", label: "Exact", get: (r) => (r.exact ? 1 : 0), render: (r) => yes(r.exact) },
    { key: "phrase", label: "Phrase", get: (r) => (r.phrase ? 1 : 0), render: (r) => yes(r.phrase) },
    { key: "broad", label: "Broad", get: (r) => (r.broad ? 1 : 0), render: (r) => yes(r.broad) },
    { key: "nCamps", label: "Campaigns", num: true, get: (r) => r.nCamps, fmt: (v) => int.format(v) },
    { key: "volume", label: "Search volume", sub: "monthly", num: true, get: (r) => r.volume, fmt: (v) => int.format(v) },
    ...RANK_DATES.map(
      (date, i): Col<GapRow> => ({
        key: `rank${i}`,
        label: `Rank ${date}`,
        num: true,
        get: (r) => r.ranks[i],
        render: (r) => (r.ranks[i] === null ? <span className="na">not ranked</span> : <Tag tone={rankTone(r.ranks[i])}>{r.ranks[i]}</Tag>),
      }),
    ),
    {
      key: "status",
      label: "Status",
      get: (r) => markOf(r.term).s,
      render: (r) => (
        <select className={st.cellSelect} value={markOf(r.term).s} onChange={(e) => setMark(r.term, { s: e.target.value })} aria-label={`Status of ${r.term}`}>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      ),
    },
    {
      key: "note",
      label: "Note",
      get: (r) => markOf(r.term).note,
      render: (r) => <input className={st.cellInput} value={markOf(r.term).note} onChange={(e) => setMark(r.term, { note: e.target.value })} placeholder="Add a note" aria-label={`Note for ${r.term}`} />,
    },
    bc.pf<GapRow>(),
  ];

  const inExact = all.filter((r) => r.exact).length;
  return (
    <View>
      <HubTable
        id="keyword-gaps"
        title="Keyword gaps"
        info={
          <>
            <p>Search terms from the search-term report, added up across campaigns, against the keywords targeted anywhere in the account. A term converting through Phrase, Broad or Auto without its own Exact keyword is a gap.</p>
            <p>Rank is the organic position on the dates shown (lower is better). Status and notes stay in this browser.</p>
          </>
        }
        lead={`${inExact} in Exact · ${all.filter((r) => !r.exact && (r.phrase || r.broad)).length} only Phrase/Broad · ${all.filter(notTargeted).length} not targeted`}
        rows={rows}
        cols={cols}
        deltas={hub.period === "7d"}
        sort={{ key: "orders", dir: -1 }}
        tabs={[
          { label: "All terms", test: () => true },
          { label: "Not in Exact", test: (r) => !r.exact },
          { label: "Not targeted", test: notTargeted },
        ]}
        chips={[
          { label: "Winners not in Exact", test: (r) => r.d.orders >= 2 && !r.exact },
          { label: "Big terms", test: (r) => r.volume >= 20000 },
          { label: "Supporting converters", test: (r) => r.d.orders === 1 },
          { label: "Spend no sales", test: (r) => r.d.spend >= 30 && r.d.orders === 0 },
          { label: "High ACOS", test: (r) => (acosD(r.d) ?? 0) > 50 },
          { label: "Expensive clicks", test: (r) => (cpcD(r.d) ?? 0) > 2.5 },
          { label: "New this week", test: (r) => r.isNew },
          { label: "Branded", test: (r) => r.branded },
          { label: "Non-branded", test: (r) => !r.branded },
          { label: "To launch", test: (r) => markOf(r.term).s === "To launch" },
        ]}
        actions={(r) => (!r.exact ? <QueueButton source="keyword-gaps" label="Add as Exact" change={{ action: "targeting.create", campaign: r.campaign, adGroup: r.adGroup, entity: r.term, current: null, proposed: `EXACT|${(cpcD(r.d) ?? 0.5).toFixed(2)}` }} /> : null)}
      />
    </View>
  );
}
