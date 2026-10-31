"use client";

import { useState } from "react";
import { dealPeriods, lastYear, monthly, weekly, type Period, type Row } from "@/lib/mock";
import type { ToDate } from "@/lib/category";
import { acos, change, eur, int, pct1, sumRows, tacos } from "@/lib/format";
import Delta from "./Delta";
import Info from "./Info";
import st from "./Comparisons.module.css";
import Select from "./Select";

type Kpi = { label: string; get: (r: Row) => number; fmt: (v: number) => string; ratio?: boolean; goodWhen: "up" | "down" | "none" };
type Source = { periods: Period[]; totals: Row[]; ly: Row[]; deals: boolean[] };

const pct = (v: number) => `${pct1.format(v)}%`;
const organic = (r: Row) => (r.sales ? (Math.max(0, r.sales - r.adSales) / r.sales) * 100 : 0);

const KPIS: Kpi[] = [
  { label: "Sales", get: (r) => r.sales, fmt: (v) => eur.format(v), goodWhen: "up" },
  { label: "Units", get: (r) => r.units, fmt: (v) => int.format(Math.round(v)), goodWhen: "up" },
  { label: "Ad spend", get: (r) => r.adSpend, fmt: (v) => eur.format(v), goodWhen: "none" },
  { label: "Ad sales", get: (r) => r.adSales, fmt: (v) => eur.format(v), goodWhen: "up" },
  { label: "ACOS", get: acos, fmt: pct, ratio: true, goodWhen: "down" },
  { label: "TACoS", get: tacos, fmt: pct, ratio: true, goodWhen: "down" },
  { label: "Organic share", get: organic, fmt: pct, ratio: true, goodWhen: "up" },
];

const TO_DATE = "Today · this week · this month";

function accountSource(mode: "weekly" | "monthly"): Source {
  const data = mode === "weekly" ? weekly : monthly;
  return { periods: data.periods, totals: data.periods.map((_, i) => sumRows(data.categories.map((c) => c.rows[i]))), ly: lastYear[mode], deals: dealPeriods[mode] };
}

/** Selected period against four baselines (ratios in points, totals in percent).
 *  With `toDate` (category pages) the picker also offers today / this week / this month against last year. */
export default function Comparisons({ mode, source, toDate, scope = "Whole account" }: { mode: "weekly" | "monthly"; source?: Source; toDate?: ToDate[]; scope?: string }) {
  const { periods, totals, ly, deals } = source ?? accountSource(mode);
  const labelOf = (i: number) => `${periods[i].kw} · ${periods[i].label}${deals[i] ? " · Prime Day" : ""}`;
  const options = [...(toDate ? [TO_DATE] : []), ...periods.slice(0, -1).map((_, i) => labelOf(i))];
  const [picked, setPicked] = useState<{ mode: string; v: string }>({ mode, v: options[0] });
  const value = picked.mode === mode && options.includes(picked.v) ? picked.v : options[0];
  const unit = mode === "weekly" ? "week" : "month";

  const delta = (k: Kpi, v: number, b: number) => <Delta value={k.ratio ? v - b : change(v, b)} unit={k.ratio ? " pp" : "%"} goodWhen={k.goodWhen} />;

  const head = (
    <div className="ph-row between">
      <div className="ph-t">
        <h2 id="cmp-h" className="ph">
          Comparisons
        </h2>
        <Info label="Comparisons">
          <p>
            {scope}: the selected {unit} against the one before, the average of the 4 before that, the last {unit} of the same type, and the same {unit} last year. Green is better, red is worse; ad spend is not coloured.
          </p>
          {toDate ? <p>Today is the latest complete day in tool4seller; this week runs Monday to that day, this month from the 1st. Each is compared with the same date, ISO week weekdays and days of the month last year.</p> : null}
          {mode === "weekly" ? <p>KW 41 counts as a Prime Day week (approved deals); the rest are regular weeks.</p> : null}
        </Info>
      </div>
      <div className="filters">
        <Select label="Period" value={value} options={options} onChange={(v) => setPicked({ mode, v })} />
      </div>
    </div>
  );

  if (toDate && value === TO_DATE) {
    return (
      <section id="comparisons" className="panel flush" aria-labelledby="cmp-h">
        {head}
        <div className="tscroll">
          <table className={`${st.cmp} ${st.td}`}>
            <colgroup>
              <col className={st.kcol} />
              {toDate.map((t) => [<col key={`${t.label}v`} />, <col key={`${t.label}l`} />, <col key={`${t.label}c`} className={st.ccol} />])}
            </colgroup>
            <thead>
              <tr className={st.grp}>
                <th scope="col" />
                {toDate.map((t) => (
                  <th key={t.label} scope="colgroup" colSpan={3} className={st.gh}>
                    <span className={st.ghL}>{t.label}</span>
                    <span className={st.ghD}>
                      {t.sub} <i>vs</i> {t.lySub}
                    </span>
                  </th>
                ))}
              </tr>
              <tr>
                <th scope="col">KPI</th>
                {toDate.map((t) => [
                  <th key={`${t.label}v`} scope="col" className={`n ${st.start}`}>
                    Value
                  </th>,
                  <th key={`${t.label}l`} scope="col" className="n">
                    Last year
                  </th>,
                  <th key={`${t.label}c`} scope="col" className="n">
                    Change
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody key="todate" className="swap">
              {KPIS.map((k) => (
                <tr key={k.label}>
                  <th scope="row">{k.label}</th>
                  {toDate.map((t) => [
                    <td key={`${t.label}v`} className={`n ${st.start} ${st.val}`}>
                      {k.fmt(k.get(t.cur))}
                    </td>,
                    <td key={`${t.label}l`} className={`n ${st.ly}`}>
                      {k.fmt(k.get(t.ly))}
                    </td>,
                    <td key={`${t.label}c`} className="n">
                      {delta(k, k.get(t.cur), k.get(t.ly))}
                    </td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  const i = options.indexOf(value) - (toDate ? 1 : 0);
  const prevI = i + 1;
  const avgIdx = [1, 2, 3, 4].map((k) => i + k).filter((k) => k < totals.length);
  const avg: Row | null = avgIdx.length === 4 ? (Object.fromEntries((["sales", "units", "adSpend", "adSales"] as const).map((f) => [f, avgIdx.reduce((a, k) => a + totals[k][f], 0) / 4])) as Row) : null;
  const sameI = totals.findIndex((_, k) => k > i && deals[k] === deals[i]);

  const cell = (k: Kpi, base: Row | null | undefined) => {
    if (!base) return <span className="na">not enough history</span>;
    return (
      <>
        {delta(k, k.get(totals[i]), k.get(base))}
        <small>{k.fmt(k.get(base))}</small>
      </>
    );
  };

  return (
    <section id="comparisons" className="panel flush" aria-labelledby="cmp-h">
      {head}
      <div className="tscroll">
        <table className={st.cmp}>
          <thead>
            <tr>
              <th scope="col">KPI</th>
              <th scope="col" className="n cur">
                {periods[i].kw}
                <small>{periods[i].label}</small>
              </th>
              <th scope="col" className="n">
                vs previous {unit}
                <small>{periods[prevI].kw}</small>
              </th>
              <th scope="col" className="n">
                vs 4-{unit} average
                <small>{avg ? `${periods[i + 4].kw}–${periods[i + 1].kw}` : "—"}</small>
              </th>
              <th scope="col" className="n">
                vs last {deals[i] ? "deal" : "regular"} {unit}
                <small>{sameI > 0 ? periods[sameI].kw : "—"}</small>
              </th>
              <th scope="col" className="n">
                vs last year
                <small>same {mode === "weekly" ? "ISO week" : "month"} 2025</small>
              </th>
            </tr>
          </thead>
          <tbody key={`${mode}${i}`} className="swap">
            {KPIS.map((k) => (
              <tr key={k.label}>
                <th scope="row">{k.label}</th>
                <td className="n cur">{k.fmt(k.get(totals[i]))}</td>
                <td className={`n ${st["cmp-c"]}`}>{cell(k, totals[prevI])}</td>
                <td className={`n ${st["cmp-c"]}`}>{cell(k, avg)}</td>
                <td className={`n ${st["cmp-c"]}`}>{cell(k, sameI > 0 ? totals[sameI] : null)}</td>
                <td className={`n ${st["cmp-c"]}`}>{cell(k, ly[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
