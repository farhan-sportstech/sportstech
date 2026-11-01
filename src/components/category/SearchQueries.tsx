"use client";

import { useMemo, useState } from "react";
import type { Period } from "@/lib/mock";
import type { CategoryData, Mode } from "@/lib/category";
import { categorySqp, sqpScope, type SqpCell } from "@/lib/sqp";
import { int, pct1, pct2 } from "@/lib/format";
import { cx } from "@/lib/cx";
import { SampleTag } from "@/lib/homeData";
import Info from "../Info";
import MultiSelect from "../MultiSelect";
import Segmented from "../Segmented";
import Select from "../Select";
import st from "./SearchQueries.module.css";

type M = { key: string; label: string; market: boolean; get: (c: SqpCell) => number | null; fmt: (v: number) => string };
const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null);
const METRICS: M[] = [
  { key: "vol", label: "Search volume", market: true, get: (c) => c.vol, fmt: (v) => int.format(v) },
  { key: "mcl", label: "Market clicks", market: true, get: (c) => c.mClicks, fmt: (v) => int.format(v) },
  { key: "mpu", label: "Market purchases", market: true, get: (c) => c.mPurch, fmt: (v) => int.format(v) },
  { key: "mcvr", label: "Market CVR", market: true, get: (c) => ratio(c.mPurch, c.mClicks), fmt: (v) => `${pct2.format(v)}%` },
  { key: "csh", label: "Click share", market: false, get: (c) => ratio(c.clicks, c.mClicks), fmt: (v) => `${pct1.format(v)}%` },
  { key: "psh", label: "Purchase share", market: false, get: (c) => ratio(c.purch, c.mPurch), fmt: (v) => `${pct1.format(v)}%` },
  { key: "cl", label: "Our clicks", market: false, get: (c) => c.clicks, fmt: (v) => int.format(v) },
  { key: "pu", label: "Our purchases", market: false, get: (c) => c.purch, fmt: (v) => int.format(v) },
  { key: "ocvr", label: "Our CVR", market: false, get: (c) => ratio(c.purch, c.clicks), fmt: (v) => `${pct2.format(v)}%` },
];
const DEFAULT = ["vol", "csh", "psh"];
const MIN = ["Any volume", "100+ searches", "500+ searches", "2.000+ searches"];
const minOf = (s: string) => Number(s.replace(/\D/g, "")) || 0;
const LIMIT = 30;
// sorts use the latest period with data
const SORTS: Record<string, (c: SqpCell | null, rank: number | null) => number> = {
  "Sort: search volume": (c) => c?.vol ?? -1,
  "Sort: click share": (c) => (c && c.mClicks ? c.clicks / c.mClicks : -1),
  "Sort: purchase share": (c) => (c && c.mPurch ? c.purch / c.mPurch : -1),
  "Sort: our purchases": (c) => c?.purch ?? -1,
  "Sort: best rank": (_, rank) => (rank ? -rank : -Infinity),
};

export default function SearchQueries({ data, family, mode, periods }: { data: CategoryData; family: string; mode: Mode; periods: Period[] }) {
  const [metrics, setMetrics] = useState(DEFAULT);
  const [rel, setRel] = useState<"rel" | "all">("rel");
  const [min, setMin] = useState(MIN[0]);
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const [sortBy, setSortBy] = useState(Object.keys(SORTS)[0]);
  const unit = mode === "weekly" ? "week" : "month";
  const shown = METRICS.filter((m) => metrics.includes(m.key));

  const rows = useMemo(() => {
    const asins = data.pick(family).map((p) => p.asin);
    const needle = q.trim().toLowerCase();
    return categorySqp(data, mode)
      .filter((r) => (rel === "all" || r.relevant) && (!needle || r.q.includes(needle)))
      .map((r) => {
        const cells = sqpScope(r, asins, periods.length);
        const latest = cells.find((c) => c) ?? null;
        return { ...r, cells, latest };
      })
      .filter((r) => r.latest && r.latest.vol >= minOf(min))
      .sort((a, b) => SORTS[sortBy](b.latest, b.rank) - SORTS[sortBy](a.latest, a.rank));
  }, [data, family, mode, periods.length, rel, min, q, sortBy]);

  const list = all ? rows : rows.slice(0, LIMIT);
  const sold = rows.filter((r) => r.cells.some((c) => c && c.purch > 0)).length;
  const missing = periods.filter((_, i) => !rows.some((r) => r.cells[i])).map((p) => p.kw);

  return (
    <section id="queries" className="panel flush" aria-labelledby="sq-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="sq-h" className="ph">
            Search queries · market view
          </h2>
          <SampleTag live={data.live} reason="not connected to the database yet" />
          <Info label="Search queries">
            <p>Amazon Brand Analytics, Search Query Performance: what the whole market searched for, and how much of it this {data.def.plural} line-up won.</p>
            <p>
              Amazon lists every query where one of these products was shown at all, including unrelated ones. <b>Relevant</b> keeps queries that name a product of this category or where we made a sale; <b>Everything</b> shows them all.
            </p>
            <p>Search volume, market clicks and market purchases cover every brand. Click and purchase share are this category&apos;s slice of them. Amazon reports SQP only for a product&apos;s top queries, so smaller products have gaps.</p>
          </Info>
        </div>
        <p className="tot">
          <b>{int.format(rows.length)}</b> queries · <b>{int.format(sold)}</b> with our purchases · SQP {unit}s {periods[periods.length - 1].kw}–{periods[0].kw}
          {missing.length ? <span className={st.miss}> · no Amazon data for {missing.join(", ")}</span> : null}
        </p>
      </div>

      <div className={st.bar}>
        <div className={st.ctl}>
          <span className={st.cap}>Columns per {unit}</span>
          <div className={st.row}>
            <MultiSelect
              label="Metrics"
              value={metrics}
              onChange={setMetrics}
              options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
              presets={[
                { label: "All", value: METRICS.map((m) => m.key) },
                { label: "Market", value: METRICS.filter((m) => m.market).map((m) => m.key) },
                { label: "Default", value: DEFAULT },
              ]}
            />
            <Segmented
              label="Queries shown"
              size="sm"
              value={rel}
              onChange={setRel}
              options={[
                { value: "rel", label: `Relevant to ${data.def.plural}` },
                { value: "all", label: "Everything Amazon lists" },
              ]}
            />
          </div>
        </div>
        <div className={st.ctl}>
          <span className={st.cap}>Filter</span>
          <div className="filters">
            <input type="search" className={st.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search query" aria-label="Search queries" />
            <Select label="Minimum search volume" value={min} onChange={setMin} options={MIN} />
            <Select label="Sort queries" value={sortBy} onChange={setSortBy} options={Object.keys(SORTS)} />
          </div>
        </div>
      </div>

      <div className="tscroll tall">
        <table className={st.sq}>
          <thead>
            <tr className={st.grp}>
              <th scope="col" rowSpan={2}>
                Search query
              </th>
              <th scope="col" rowSpan={2} className={cx("n", st.rank)}>
                Best org. rank
              </th>
              {shown.map((m) => (
                <th key={m.key} scope="colgroup" colSpan={periods.length} className={cx(st.gh, m.market && st.mkt)}>
                  {m.label}
                </th>
              ))}
            </tr>
            <tr>
              {shown.map((m) =>
                periods.map((p, i) => (
                  <th key={m.key + p.key} scope="col" className={cx("n", i === 0 && "cur", i === 0 && st.start, m.market && st.mkt)}>
                    {p.kw}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody key={`${mode}${family}${rel}${metrics.join()}${sortBy}`} className="swap">
            {list.length === 0 ? (
              <tr>
                <td colSpan={2 + shown.length * periods.length} className="empty">
                  No search queries match.
                </td>
              </tr>
            ) : null}
            {list.map((r) => (
              <tr key={r.q}>
                <th scope="row" className={st.q}>
                  {r.q}
                  {!r.relevant ? <span className={st.other}>other category</span> : null}
                </th>
                <td className={cx("n", st.rank)}>{r.rank ? <span className={cx(st.rk, r.rank <= 3 && st.top)}>#{r.rank}</span> : <span className="na">—</span>}</td>
                {shown.map((m) =>
                  r.cells.map((c, i) => {
                    const v = c ? m.get(c) : null;
                    const strong = (m.key === "csh" || m.key === "psh") && v !== null && v >= 10;
                    return (
                      <td key={m.key + i} className={cx("n", i === 0 && "cur", i === 0 && st.start, m.market && st.mkt, strong && st.strong)}>
                        {v === null ? <span className="na">—</span> : m.fmt(v)}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > LIMIT ? (
        <div className={st.more}>
          <button type="button" className="btn sm" onClick={() => setAll((a) => !a)}>
            {all ? `Show top ${LIMIT}` : `Show all ${int.format(rows.length)}`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
