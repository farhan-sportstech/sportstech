"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { isBranded, termRows } from "@/lib/hub";
import { acosD, addDay, zeroDay, type Day } from "@/lib/account";
import { eur, int, pct1 } from "@/lib/format";
import { cx } from "@/lib/cx";
import Segmented from "../../Segmented";
import Switch from "../../Switch";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import QueueButton from "../QueueButton";
import { Tag } from "../cells";
import st from "../hub.module.css";

// filler words dropped before building n-grams (German, English, French)
const STOP = new Set(["für", "fur", "mit", "und", "der", "die", "das", "den", "dem", "ein", "eine", "einen", "zum", "zur", "von", "im", "in", "am", "an", "auf", "bis", "ohne", "the", "for", "with", "and", "of", "to", "a", "an", "on", "pour", "avec", "et", "le", "la", "les", "de", "du", "des", "un", "une"]);

type Flag = "Wasting" | "High ACOS" | "Winning" | "";
type GramRow = { key: string; gram: string; terms: number; source: string; campaign: string; adGroup: string; pfs: number; d: Day; flag: Flag };
const FILTERS = ["All words", "Wasting", "High ACOS", "Winning"] as const;

export default function NGrams() {
  const hub = useHub();
  const T = hub.target;
  const [n, setN] = useState("1");
  const [minClicks, setMinClicks] = useState("");
  const [waste, setWaste] = useState("30");
  const [filler, setFiller] = useState(true);
  const [plurals, setPlurals] = useState(false);
  const [nonBranded, setNonBranded] = useState(false);
  const [pick, setPick] = useState<(typeof FILTERS)[number]>("All words");

  const terms = useMemo(() => termRows(hub.period), [hub.period]);
  const scoped = hub.scope(terms, (r) => r.term).filter((r) => !nonBranded || !isBranded(r.term));
  const wasteAt = Number(waste.replace(",", ".")) || 0;

  const grams = useMemo(() => {
    const tokenize = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);
    const vocab = new Set(scoped.flatMap((r) => tokenize(r.term)));
    // plural grouping: strip en / n / s / e when the stem (3+ letters) also appears on its own
    const stem = (w: string) => {
      if (!plurals) return w;
      for (const suf of ["en", "n", "s", "e"]) if (w.endsWith(suf) && w.length - suf.length >= 3 && vocab.has(w.slice(0, -suf.length))) return w.slice(0, -suf.length);
      return w;
    };
    const size = Number(n);
    const by = new Map<string, { d: Day; terms: Set<string>; pfs: Set<string>; src: Map<string, { spend: number; campaign: string; adGroup: string }> }>();
    for (const r of scoped) {
      const words = tokenize(r.term)
        .filter((w) => !filler || !STOP.has(w))
        .map(stem);
      const seen = new Set<string>();
      for (let i = 0; i + size <= words.length; i++) seen.add(words.slice(i, i + size).join(" "));
      for (const g of seen) {
        const e = by.get(g) ?? { d: zeroDay(), terms: new Set(), pfs: new Set(), src: new Map() };
        e.d = addDay(e.d, r.d);
        e.terms.add(r.term);
        e.pfs.add(r.pf);
        const sk = `${r.type} · ${r.match === "PAT" ? "Product" : r.match}`;
        const s = e.src.get(sk) ?? { spend: 0, campaign: r.campaign, adGroup: r.adGroup };
        s.spend += r.d.spend;
        e.src.set(sk, s);
        by.set(g, e);
      }
    }
    return [...by.entries()].map(([g, e]): GramRow => {
      const [source, main] = [...e.src.entries()].sort((a, b) => b[1].spend - a[1].spend)[0];
      const a = acosD(e.d);
      const flag: Flag = e.d.orders === 0 && e.d.spend >= wasteAt ? "Wasting" : a !== null && a > 1.5 * T ? "High ACOS" : e.d.orders >= 3 && a !== null && a <= T ? "Winning" : "";
      return { key: g, gram: g, terms: e.terms.size, source, campaign: main.campaign, adGroup: main.adGroup, pfs: e.pfs.size, d: e.d, flag };
    });
  }, [scoped, n, filler, plurals, wasteAt, T]);

  const mc = Number(minClicks) || 0;
  const base = grams.filter((g) => g.d.clicks >= mc);
  const totalSpend = base.reduce((a, g) => a + g.d.spend, 0);
  const rows = pick === "All words" ? base : base.filter((g) => g.flag === pick);

  const cols: Col<GramRow>[] = [
    { key: "gram", label: "N-gram", name: true, get: (r) => r.gram },
    { key: "terms", label: "Terms", num: true, get: (r) => r.terms, fmt: (v) => int.format(v) },
    { key: "source", label: "Main source", sub: "most spend", get: (r) => r.source },
    { key: "pfs", label: "Portfolios", num: true, get: (r) => r.pfs, fmt: (v) => int.format(v) },
    {
      key: "share",
      label: "% of spend",
      num: true,
      get: (r) => (totalSpend ? (r.d.spend / totalSpend) * 100 : 0),
      render: (r) => {
        const s = totalSpend ? r.d.spend / totalSpend : 0;
        return (
          <>
            {pct1.format(s * 100)}%
            <span className={st.share}>
              <i style={{ "--w": Math.min(1, s * 5) } as CSSProperties} />
            </span>
          </>
        );
      },
    },
    { key: "flag", label: "Flag", get: (r) => r.flag, render: (r) => (r.flag ? <Tag tone={r.flag === "Winning" ? "good" : r.flag === "Wasting" ? "bad" : "warn"}>{r.flag}</Tag> : <span className="na">—</span>) },
  ];

  return (
    <View>
      <section className="panel">
        <div className={st.ctlRow}>
          <Segmented
            label="Words"
            value={n}
            onChange={setN}
            options={[
              { value: "1", label: "1 word" },
              { value: "2", label: "2 words" },
              { value: "3", label: "3 words" },
            ]}
          />
          <label className={st.lbl}>
            Min clicks
            <input className={st.numIn} inputMode="numeric" value={minClicks} placeholder="any" onChange={(e) => setMinClicks(e.target.value.replace(/\D/g, ""))} />
          </label>
          <label className={st.lbl}>
            Wasting at €
            <input className={st.numIn} inputMode="decimal" value={waste} onChange={(e) => setWaste(e.target.value.replace(/[^\d.,]/g, ""))} />
          </label>
          <Switch checked={filler} onChange={setFiller}>
            Hide filler words
          </Switch>
          <Switch checked={plurals} onChange={setPlurals}>
            Group plurals
          </Switch>
          <Switch checked={nonBranded} onChange={setNonBranded}>
            Non-branded only
          </Switch>
        </div>
      </section>

      <div key={`${n}${filler}${plurals}${nonBranded}${mc}${wasteAt}`} className={st.tiles} style={{ "--cols": 4 } as CSSProperties}>
        {FILTERS.map((f, i) => {
          const set = f === "All words" ? base : base.filter((g) => g.flag === f);
          return (
            <button key={f} type="button" className={cx(st.tile, pick === f && st.on)} aria-pressed={pick === f} onClick={() => setPick(f)} style={{ "--i": i } as CSSProperties}>
              <span className={st.tl}>{f}</span>
              <span className={st.tv}>{int.format(set.length)}</span>
              <span className={st.td}>{eur.format(set.reduce((a, g) => a + g.d.spend, 0))} spend</span>
            </button>
          );
        })}
      </div>

      <HubTable
        id="n-grams"
        title={pick === "All words" ? `${n}-word n-grams` : pick}
        info={
          <>
            <p>Every search term is lowercased and split into words; each run of {n} word{n === "1" ? "" : "s"} counts once per term, and the term&apos;s metrics are added to it.</p>
            <p>
              Wasting = no orders and at least €{waste} spend. High ACOS = above {pct1.format(1.5 * T)}% (1,5 × target). Winning = 3+ orders at or below the {pct1.format(T)}% target.
            </p>
          </>
        }
        rows={rows}
        cols={cols}
        sort={{ key: "spend", dir: -1 }}
        actions={(r) => <QueueButton source="n-grams" label="Add negative" change={{ action: "targeting.create.negative", campaign: r.campaign, adGroup: r.adGroup, entity: r.gram, current: null, proposed: "PHRASE" }} />}
      />
    </View>
  );
}
