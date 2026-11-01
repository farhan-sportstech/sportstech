"use client";

import { useMemo, useState } from "react";
import { SQP_WEEKS, isAsin, sqpQueries, termRows } from "@/lib/hub";
import { acosD, addDay, zeroDay, type Day } from "@/lib/account";
import { int, pct1 } from "@/lib/format";
import Bars from "../../Bars";
import Segmented from "../../Segmented";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import st from "../hub.module.css";
import rs from "./Roots.module.css";

const STOP = new Set(["für", "mit", "und", "der", "die", "das", "den", "dem", "ein", "eine", "zum", "zur", "von", "auf", "ohne", "the", "for", "with", "and", "pour", "avec", "les", "des", "une"]);
type RootRow = { key: string; root: string; terms: number; trend: number[] | null; volume: number | null; clickShare: number | null; d: Day };

const WEEKS = SQP_WEEKS.length;
// newest week first, as the Bars component expects
const LAST13 = Array.from({ length: 13 }, (_, i) => WEEKS - 1 - i);

export default function Roots() {
  const hub = useHub();
  const [mode, setMode] = useState("1");
  const [minTerms, setMinTerms] = useState("2");

  const terms = useMemo(() => termRows(hub.period), [hub.period]);
  const scoped = hub.scope(terms, (r) => r.term);

  const roots = useMemo(() => {
    const by = new Map<string, { d: Day; terms: Set<string> }>();
    for (const r of scoped) {
      const toks = r.term
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w) && !isAsin(w) && !/^b0/.test(w));
      const keys = new Set(mode === "1" ? toks : toks.slice(0, -1).map((w, i) => `${w} ${toks[i + 1]}`));
      for (const k of keys) {
        const e = by.get(k) ?? { d: zeroDay(), terms: new Set<string>() };
        e.d = addDay(e.d, r.d);
        e.terms.add(r.term);
        by.set(k, e);
      }
    }
    return [...by.entries()]
      .map(([root, e]) => ({ root, d: e.d, terms: e.terms.size }))
      .sort((a, b) => b.d.spend - a.d.spend)
      .map((x, i): RootRow => {
        // SQP volume for the top 400 roots by spend: every query containing the root, summed per week
        if (i >= 400) return { key: x.root, ...x, trend: null, volume: null, clickShare: null };
        const qs = sqpQueries.filter((q) => ` ${q.q} `.includes(` ${x.root} `) || q.q.split(" ").some((w) => w.startsWith(x.root)));
        if (!qs.length) return { key: x.root, ...x, trend: null, volume: null, clickShare: null };
        const trend = LAST13.map((w) => qs.reduce((a, q) => a + q.weeks[w].vol, 0));
        const last = qs.reduce((a, q) => ({ c: a.c + q.weeks[WEEKS - 1].clicks, o: a.o + q.weeks[WEEKS - 1].oClicks }), { c: 0, o: 0 });
        return { key: x.root, ...x, trend, volume: trend[0], clickShare: last.c ? (last.o / last.c) * 100 : null };
      });
  }, [scoped, mode]);

  const min = Number(minTerms) || 1;
  const rows = roots.filter((r) => r.terms >= min);

  const cols: Col<RootRow>[] = [
    { key: "root", label: "Root", name: true, get: (r) => r.root },
    { key: "terms", label: "Search terms", num: true, get: (r) => r.terms, fmt: (v) => int.format(v) },
    {
      key: "trend",
      label: "Trend",
      sub: "SQP volume, 13 weeks",
      get: (r) => (r.trend ? r.trend[0] - r.trend[12] : null),
      render: (r) => (r.trend ? <Bars className={rs.spark} values={r.trend} labels={LAST13.map((w) => SQP_WEEKS[w].label)} format={(v) => `${int.format(v)} searches`} /> : <span className="na">no SQP data</span>),
    },
    { key: "volume", label: "Search volume", sub: SQP_WEEKS[WEEKS - 1].label, num: true, get: (r) => r.volume, fmt: (v) => int.format(v) },
    { key: "clickShare", label: "Click share", sub: SQP_WEEKS[WEEKS - 1].label, num: true, get: (r) => r.clickShare, fmt: (v) => `${pct1.format(v)}%` },
  ];

  return (
    <View>
      <section className="panel">
        <div className={st.ctlRow}>
          <Segmented
            label="Roots"
            value={mode}
            onChange={setMode}
            options={[
              { value: "1", label: "Single words" },
              { value: "2", label: "2-word phrases" },
            ]}
          />
          <label className={st.lbl}>
            Min search terms
            <input className={st.numIn} inputMode="numeric" value={minTerms} onChange={(e) => setMinTerms(e.target.value.replace(/\D/g, ""))} />
          </label>
          <span className="tot">
            <b>{int.format(rows.length)}</b> roots from {int.format(scoped.length)} search terms
          </span>
        </div>
      </section>
      <HubTable
        id="roots"
        title={mode === "1" ? "Word roots" : "Two-word roots"}
        info={
          <>
            <p>Search terms split into words (longer than 2 letters, filler words and ASINs left out); each root adds up the metrics of every term that contains it.</p>
            <p>Trend, search volume and click share come from Search Query Performance: every tracked query containing the root, summed. They are filled for the 400 roots with the most spend.</p>
          </>
        }
        rows={rows}
        cols={cols}
        sort={{ key: "spend", dir: -1 }}
        chips={[
          { label: "Spend no sales", test: (r) => r.d.spend >= 20 && r.d.orders === 0 },
          { label: "High ACOS", test: (r) => (acosD(r.d) ?? 0) > 50 },
          { label: "Winners", test: (r) => r.d.orders >= 5 },
        ]}
      />
    </View>
  );
}
