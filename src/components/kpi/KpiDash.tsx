"use client";

import { Fragment, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { KPI_CATS, kpiMonths, kpiWeeks, type KpiRow } from "@/lib/kpi";
import { KPI_GROUPS, KPI_METRICS, TILE_DEFAULT, metricBy, type KpiMetric } from "@/lib/kpiMetrics";
import { change, eur, pct1 } from "@/lib/format";
import { cx } from "@/lib/cx";
import { useReveal } from "@/lib/motion";
import Bars from "../Bars";
import CountUp from "../CountUp";
import Delta from "../Delta";
import Info from "../Info";
import MultiSelect from "../MultiSelect";
import SectionNav from "../SectionNav";
import Segmented from "../Segmented";
import Select from "../Select";
import d from "../dash.module.css";
import { StackBars, Trend, type Series } from "./Charts";
import st from "./KpiDash.module.css";

type Mode = "weekly" | "monthly";
const SECTIONS = [
  { id: "kpis", label: "Overview" },
  { id: "sales", label: "Sales" },
  { id: "adbreak", label: "Advertising" },
  { id: "cats", label: "Categories" },
  { id: "sheet", label: "KPI sheet" },
];
const HUES = ["var(--accent)", "#8b7bc4", "#2f9e8f", "#d08a2c", "color-mix(in srgb, var(--ink) 40%, transparent)"];
const BREAKDOWNS: Record<string, { label: string; keys: string[] }> = {
  type: { label: "Ad type", keys: ["sp", "sb", "sd"] },
  place: { label: "Placements", keys: ["tos", "pp", "ros"] },
  brand: { label: "Branded", keys: ["branded", "nonBranded"] },
  def: { label: "Defense vs offense", keys: ["defense", "offense"] },
  match: { label: "Match type", keys: ["exact", "phrase", "broad", "auto", "pat"] },
};
const delta = (m: KpiMetric, a: number | null, b: number | null) => (a === null || b === null ? null : m.ratio ? a - b : change(a, b));
const KEY_ROWS = KPI_METRICS.filter((m) => m.key_).map((m) => m.key);

// the custom sheet rows live in this browser only, read through an external-store subscription
const ROWS_KEY = "wd:kpi-rows";
const ROWS_EVT = "wd:kpi-rows";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(ROWS_EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(ROWS_EVT, cb);
  };
};
const readRows = () => {
  try {
    return localStorage.getItem(ROWS_KEY);
  } catch {
    return null;
  }
};
const writeRows = (keys: string[]) => {
  try {
    localStorage.setItem(ROWS_KEY, JSON.stringify(keys));
  } catch {
    // storage blocked: the choice lasts until reload
  }
  window.dispatchEvent(new Event(ROWS_EVT));
};

export default function KpiDash() {
  const [mode, setMode] = useState<Mode>("weekly");
  const [focusByMode, setFocusByMode] = useState<Record<Mode, number>>({ weekly: 1, monthly: 0 });
  const [tiles, setTiles] = useState(TILE_DEFAULT);
  const [trendKey, setTrendKey] = useState("sales");
  const [breakdown, setBreakdown] = useState("type");
  const [rankBy, setRankBy] = useState("Total sales");
  const [win, setWin] = useState("Focus vs previous");
  const [sheetView, setSheetView] = useState<"key" | "all" | "custom">("key");
  const rawRows = useSyncExternalStore(subscribe, readRows, () => null);
  const [memRows, setMemRows] = useState<string[] | null>(null);
  const customRows = useMemo<string[]>(() => {
    if (memRows) return memRows;
    try {
      const keys = rawRows ? (JSON.parse(rawRows) as string[]) : KEY_ROWS;
      return keys.filter((k) => KPI_METRICS.some((m) => m.key === k));
    } catch {
      return KEY_ROWS;
    }
  }, [rawRows, memRows]);
  const setCustomRows = (keys: string[]) => {
    setMemRows(keys);
    writeRows(keys);
  };
  // collapsed groups per view ("all:Costs"); All starts with the detail groups shut, Custom starts open
  const [shut, setShut] = useState<Set<string>>(new Set(KPI_GROUPS.slice(4).map((g) => `all:${g}`)));
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);

  const rows: KpiRow[] = mode === "weekly" ? kpiWeeks : kpiMonths;
  const unit = mode === "weekly" ? "week" : "month";
  const focus = Math.min(focusByMode[mode], rows.length - 1);
  const setFocus = (i: number) => setFocusByMode((f) => ({ ...f, [mode]: Math.max(0, Math.min(rows.length - 1, i)) }));
  const f = rows[focus];
  const prev = rows[focus + 1];
  // the last 4 periods before the focus, for the "vs 4-period average" column
  const avg4 = (m: KpiMetric) => {
    const xs = rows.slice(focus + 1, focus + 5).map(m.get).filter((v): v is number => v !== null);
    return xs.length === 4 ? xs.reduce((a, b) => a + b, 0) / 4 : null;
  };

  const salesSeries: Series[] = [
    { key: "ppc", label: "PPC", hue: HUES[0], get: (r) => r.adSales },
    { key: "org", label: "Organic", hue: HUES[4], get: (r) => Math.max(0, r.sales - r.adSales) },
  ];
  const bd = BREAKDOWNS[breakdown];
  const bdSeries: Series[] = bd.keys.map((k, i) => ({ key: k, label: metricBy(k).label, hue: HUES[i], get: (r) => metricBy(k).get(r) ?? 0 }));
  const trend = metricBy(trendKey);

  // categories ranked by change between two equal windows
  const cats = useMemo(() => {
    const n = win === "Focus vs previous" ? 1 : 4;
    const after = rows.slice(focus, focus + n);
    const before = rows.slice(focus + n, focus + 2 * n);
    if (before.length < n) return null;
    const val = (rs: KpiRow[], c: string) => {
      const s = rs.reduce((a, r) => a + (r.cats[c] ?? 0), 0);
      return rankBy === "Total sales" ? s : (s / rs.reduce((a, r) => a + r.sales, 0)) * 100;
    };
    const list = KPI_CATS.map((c) => {
      const a = val(after, c);
      const b = val(before, c);
      return { c, a, b, d: a - b, pct: change(a, b) };
    });
    const sorted = [...list].sort((x, y) => y.d - x.d);
    return { up: sorted.filter((x) => x.d > 0).slice(0, 5), down: sorted.filter((x) => x.d < 0).reverse().slice(0, 5), span: n === 1 ? `${f.label} vs ${rows[focus + 1].label}` : `${rows[focus + n - 1].label}–${f.label} vs ${rows[focus + 2 * n - 1].label}–${rows[focus + n].label}` };
  }, [rows, focus, win, rankBy, f.label]);

  const fmtCat = (v: number) => (rankBy === "Total sales" ? eur.format(v) : `${pct1.format(v)}%`);
  // sheet rows as groups in sheet order; Key is one flat block, Custom keeps only the groups with a chosen metric
  const sheetGroups =
    sheetView === "key"
      ? [{ g: "Key metrics", ms: KPI_METRICS.filter((m) => m.key_) }]
      : KPI_GROUPS.map((g) => ({ g, ms: KPI_METRICS.filter((m) => m.group === g && (sheetView === "all" || customRows.includes(m.key))) })).filter((x) => x.ms.length);
  const grouped = sheetView !== "key";
  const anyShut = sheetGroups.some(({ g }) => shut.has(`${sheetView}:${g}`));
  let ri = 0;

  return (
    <div className="wdp" ref={page}>
      <header className={d["pg-head"]}>
        <div className="pg-title">
          <div className={d["pg-h"]}>
            <h1>Weekly KPIs</h1>
            <span key={f.key} className={d["pg-kw"]}>
              {f.label}
              <small>{f.sub}</small>
            </span>
            <Info label="Where the numbers come from">
              <p>Sales, orders and units: Amazon Sales API daily totals by order date. Sessions and page views: Business Reports. Ads: Sponsored Products, Brands and Display campaign reports, 14-day attribution; PPC sales are ad-attributed sales.</p>
              <p>Branded = keywords containing Sportstech or a model name. Defense = branded keywords and targets on our own ASINs; offense = everything else. Match type covers Sponsored Products targets.</p>
              <p>Contribution = sales minus Amazon fees, refunds and ad spend; product costs (COGS) are not connected. The newest {unit} is partial.</p>
            </Info>
          </div>
          <p className={d.meta}>Amazon.de · EUR · whole account · {rows.length} {unit}s of history · {f.partial ? `${f.label} is partial` : "complete period in focus"}</p>
        </div>
        <div className={d["pg-ctl"]}>
          <div className={st.stepper} role="group" aria-label={`Focus ${unit}`}>
            <button type="button" aria-label={`Older ${unit}`} onClick={() => setFocus(focus + 1)} disabled={focus >= rows.length - 1}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <span>
              Focus <b>{f.label}</b>
            </span>
            <button type="button" aria-label={`Newer ${unit}`} onClick={() => setFocus(focus - 1)} disabled={focus <= 0}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
          <Segmented
            label="View"
            value={mode}
            onChange={setMode}
            options={[
              { value: "weekly", label: `Weekly · ${kpiWeeks.length} wk` },
              { value: "monthly", label: `Monthly · ${kpiMonths.length} mo` },
            ]}
          />
        </div>
      </header>

      <SectionNav sections={SECTIONS} />

      {/* ---------- tiles ---------- */}
      <section id="kpis" className="panel" aria-labelledby="kt-h">
        <div className={st.hd}>
          <h2 id="kt-h" className="ph">
            {f.label} at a glance <small className={st.sub}>vs {prev ? prev.label : "—"}</small>
          </h2>
          <MultiSelect
            label="Tiles"
            value={tiles}
            onChange={setTiles}
            options={KPI_METRICS.filter((m) => m.kind && m.group !== "Categories").map((m) => ({ value: m.key, label: m.label }))}
            presets={[{ label: "Default", value: TILE_DEFAULT }]}
          />
        </div>
        {/* keyed on the focus so the tiles rise in again when it moves */}
        <div key={`${mode}${focus}`} className={st.tiles}>
          {tiles.map(metricBy).map((m, k) => {
            const v = m.get(f);
            const dv = prev ? delta(m, v, m.get(prev)) : null;
            const last8 = rows.slice(focus, focus + 8);
            return (
              <div key={m.key} className={st.tile} style={{ "--i": k } as CSSProperties}>
                <span className={st.tl}>{m.label}</span>
                <span className={st.tv}>{v === null ? "—" : m.kind ? <CountUp value={v} kind={m.kind} /> : m.fmt(v)}</span>
                <span className={st.td}>{dv === null ? <span className="na">no comparison</span> : <><Delta value={dv} unit={m.ratio ? " pp" : "%"} goodWhen={m.goodWhen} /> vs {prev.label}</>}</span>
                <Bars className={st.tb} values={last8.map((r) => m.get(r) ?? 0)} labels={last8.map((r) => r.label)} format={m.fmt} />
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- sales ---------- */}
      <section id="sales" className="panel" aria-labelledby="ks-h">
        <div className={st.hd}>
          <div className="ph-t">
            <h2 id="ks-h" className="ph">
              Sales: PPC vs organic
            </h2>
            <Info label="Sales: PPC vs organic">
              <p>PPC = Sponsored Products, Brands and Display attributed sales (14 days); organic = the rest. Click a bar to focus that {unit} everywhere on the page.</p>
            </Info>
          </div>
          <div className={st.legend}>
            {salesSeries.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.hue }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <p className={st.line}>
          {f.label}: <b>{eur.format(f.sales)}</b> sales, of which PPC <b>{eur.format(f.adSales)}</b> ({pct1.format((f.adSales / f.sales) * 100)}%) and organic <b>{eur.format(Math.max(0, f.sales - f.adSales))}</b>.
        </p>
        <StackBars key={mode} rows={rows} series={salesSeries} focus={focus} onFocus={setFocus} fmt={(v) => eur.format(v)} label="PPC and organic sales per period" />
        <div className={st.trendHd}>
          <h3>Trend explorer</h3>
          <Select label="Trend metric" value={trend.label} options={KPI_METRICS.map((m) => m.label)} onChange={(v) => setTrendKey(KPI_METRICS.find((m) => m.label === v)!.key)} />
          <span className={st.now}>
            {f.label}: <b>{trend.get(f) === null ? "—" : trend.fmt(trend.get(f)!)}</b>
          </span>
        </div>
        <Trend key={`${mode}${trendKey}`} rows={rows} get={trend.get} fmt={trend.fmt} focus={focus} onFocus={setFocus} label={`${trend.label} per ${unit}`} />
      </section>

      {/* ---------- advertising breakdown ---------- */}
      <section id="adbreak" className="panel" aria-labelledby="ka-h">
        <div className={st.hd}>
          <div className="ph-t">
            <h2 id="ka-h" className="ph">
              Advertising breakdown
            </h2>
            <Info label="Advertising breakdown">
              <p>Spend mix per {unit}, each bar stacked to 100%. Placements cover Sponsored Products only; match type covers Sponsored Products targets. Click a bar to focus that {unit}.</p>
            </Info>
          </div>
          <Segmented label="Breakdown" size="sm" value={breakdown} onChange={setBreakdown} options={Object.entries(BREAKDOWNS).map(([value, b]) => ({ value, label: b.label }))} />
        </div>
        <div className={st.split2}>
          <StackBars key={`${mode}${breakdown}`} H={340} rows={rows} series={bdSeries} focus={focus} onFocus={setFocus} fmt={(v) => eur.format(v)} percent label={`${bd.label} spend mix per period`} />
          <table className={st.mix}>
            <colgroup>
              <col />
              <col style={{ width: 96 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 92 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{f.label}</th>
                <th scope="col" className="n">
                  Spend
                </th>
                <th scope="col" className="n">
                  Share
                </th>
                <th scope="col" className="n">
                  vs {prev?.label ?? "—"}
                </th>
              </tr>
            </thead>
            <tbody key={`${breakdown}${focus}${mode}`} className={st.rows}>
              {bdSeries.map((s, k) => {
                const tot = bdSeries.reduce((a, x) => a + x.get(f), 0);
                const ptot = prev ? bdSeries.reduce((a, x) => a + x.get(prev), 0) : 0;
                const sh = tot ? (s.get(f) / tot) * 100 : 0;
                const psh = ptot && prev ? (s.get(prev) / ptot) * 100 : null;
                return (
                  <tr key={s.key} style={{ "--i": k } as CSSProperties}>
                    <th scope="row">
                      <span className={st.sw}>
                        <i style={{ background: s.hue }} />
                        {s.label}
                      </span>
                    </th>
                    <td className="n">{eur.format(s.get(f))}</td>
                    <td className="n strong">{pct1.format(sh)}%</td>
                    <td className="n">{psh === null ? <span className="na">—</span> : <Delta value={sh - psh} unit=" pp" goodWhen="none" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- categories ---------- */}
      <section id="cats" className="panel flush" aria-labelledby="kc-h">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 id="kc-h" className="ph">
              Top 5 categories growing and declining
            </h2>
            <Info label="Top categories">
              <p>Categories ranked by how much they changed between two equal windows ending at the focus {unit}. Share of sales shows mix shifts even when the whole account moves.</p>
            </Info>
          </div>
          <div className="filters">
            <Select label="Rank by" value={rankBy} options={["Total sales", "Share of sales"]} onChange={setRankBy} />
            <Select label="Compare" value={win} options={["Focus vs previous", "Last 4 vs prior 4"]} onChange={setWin} />
          </div>
        </div>
        {cats ? (
          <>
            <p className={st.span}>{cats.span}</p>
            <div className={st.two}>
              {[
                { title: "Growing", list: cats.up, tone: st.upT },
                { title: "Declining", list: cats.down, tone: st.downT },
              ].map((g) => (
                <div key={g.title} className={st.half}>
                  <h3 className={g.tone}>{g.title}</h3>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col" className="n">
                          Before
                        </th>
                        <th scope="col" className="n">
                          After
                        </th>
                        <th scope="col" className="n">
                          Change
                        </th>
                      </tr>
                    </thead>
                    <tbody key={`${g.title}${focus}${win}${rankBy}${mode}`} className={st.rows}>
                      {g.list.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="empty">
                            None
                          </td>
                        </tr>
                      ) : null}
                      {g.list.map((x, k) => (
                        <tr key={x.c} style={{ "--i": k } as CSSProperties}>
                          <th scope="row">{x.c}</th>
                          <td className="n">{fmtCat(x.b)}</td>
                          <td className="n strong">{fmtCat(x.a)}</td>
                          <td className="n">{rankBy === "Total sales" ? <Delta value={x.pct} /> : <Delta value={x.d} unit=" pp" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className={st.span}>Not enough history before {f.label} for this comparison.</p>
        )}
      </section>

      {/* ---------- KPI sheet ---------- */}
      <section id="sheet" className="panel flush" aria-labelledby="kh-h">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 id="kh-h" className="ph">
              Full KPI sheet
            </h2>
            <Info label="KPI sheet">
              <p>Every metric across every {unit}, newest first, with the focus {unit} highlighted. The two change columns compare the focus {unit} with the one before and with the average of the 4 before it.</p>
            </Info>
          </div>
          {/* the view switch sits last so it never moves; the extra controls appear to its left */}
          <div className="filters">
            {sheetView === "custom" ? (
              <MultiSelect
                label="Metrics"
                value={customRows}
                onChange={setCustomRows}
                options={KPI_METRICS.map((m) => ({ value: m.key, label: `${m.group} · ${m.label}` }))}
                presets={[
                  { label: "Key metrics", value: KEY_ROWS },
                  { label: "Sales & traffic", value: KPI_METRICS.filter((m) => m.group === "Sales" || m.group === "Traffic").map((m) => m.key) },
                  { label: "Advertising", value: KPI_METRICS.filter((m) => m.group === "Advertising" || m.group === "Costs").map((m) => m.key) },
                  { label: "Everything", value: KPI_METRICS.map((m) => m.key) },
                ]}
              />
            ) : null}
            {grouped ? (
              <button
                type="button"
                className="btn sm"
                onClick={() =>
                  setShut((s) => {
                    const n = new Set([...s].filter((k) => !k.startsWith(`${sheetView}:`)));
                    if (!anyShut) sheetGroups.forEach(({ g }) => n.add(`${sheetView}:${g}`));
                    return n;
                  })
                }
              >
                {anyShut ? "Expand all" : "Collapse all"}
              </button>
            ) : null}
            <Segmented
              label="Rows"
              size="sm"
              value={sheetView}
              onChange={setSheetView}
              options={[
                { value: "key", label: "Key" },
                { value: "all", label: "All" },
                { value: "custom", label: "Custom" },
              ]}
            />
          </div>
        </div>
        <div className="tscroll tall">
          <table className={st.sheet}>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col" className="n">
                  vs prev.
                </th>
                <th scope="col" className={cx("n", st.end)}>
                  vs 4-avg.
                </th>
                {rows.map((r, i) => (
                  <th key={r.key} scope="col" className={cx("n", i === focus && "cur")}>
                    <button type="button" className={st.colBtn} onClick={() => setFocus(i)} title={`Focus ${r.label}`}>
                      {r.label}
                    </button>
                    <small>{r.sub}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody key={`${mode}${sheetView}`} className={st.rows}>
              {sheetGroups.length === 0 ? (
                <tr>
                  <td colSpan={rows.length + 3} className="empty">
                    No metrics picked. Choose some under Metrics.
                  </td>
                </tr>
              ) : null}
              {sheetGroups.map(({ g, ms }) => {
                const sk = `${sheetView}:${g}`;
                const closed = grouped && shut.has(sk);
                return (
                  <Fragment key={g}>
                    {grouped ? (
                      <tr className={st.grp} style={{ "--i": ri++ } as CSSProperties}>
                        <th scope="rowgroup" colSpan={3}>
                          <button
                            type="button"
                            aria-expanded={!closed}
                            onClick={() =>
                              setShut((s) => {
                                const n = new Set(s);
                                if (n.has(sk)) n.delete(sk);
                                else n.add(sk);
                                return n;
                              })
                            }
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                            {g} <small>{ms.length}</small>
                          </button>
                        </th>
                        <td colSpan={rows.length} />
                      </tr>
                    ) : null}
                    {closed
                      ? null
                      : ms.map((m) => {
                          const v = m.get(f);
                          const dp = prev ? delta(m, v, m.get(prev)) : null;
                          const da = delta(m, v, avg4(m));
                          return (
                            <tr key={m.key} style={{ "--i": ri++ } as CSSProperties}>
                              <th scope="row" className={st.mName}>
                                {m.label}
                              </th>
                              <td className="n">{dp === null ? <span className="na">—</span> : <Delta value={dp} unit={m.ratio ? " pp" : "%"} goodWhen={m.goodWhen} />}</td>
                              <td className={cx("n", st.end)}>{da === null ? <span className="na">—</span> : <Delta value={da} unit={m.ratio ? " pp" : "%"} goodWhen={m.goodWhen} />}</td>
                              {rows.map((r, i) => {
                                const x = m.get(r);
                                return (
                                  <td key={r.key} className={cx("n", i === focus && "cur")}>
                                    {x === null ? <span className="na">—</span> : m.fmt(x)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
