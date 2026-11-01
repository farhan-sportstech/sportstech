"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { SQP_WEEKS, sqpQueries, type SqpCell } from "@/lib/hub";
import { int, pct1 } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import Info from "../../Info";
import Segmented from "../../Segmented";
import Select from "../../Select";
import { View } from "../HubTable";
import { SQP_METRICS, addCell, fmtSqp, zeroCell } from "./SqpMonthly";
import st from "../hub.module.css";
import sw from "./SqpWeekly.module.css";

// the account funnel per week, all queries summed; index-aligned with SQP_WEEKS (oldest first)
const WEEKLY: SqpCell[] = SQP_WEEKS.map((_, i) => sqpQueries.reduce((a, q) => addCell(a, q.weeks[i]), zeroCell()));
// metrics that have a market counterpart to draw beside ours
const PAIR: Record<string, string> = { "Our CTR %": "Market CTR %", "Our CVR %": "Market CVR %" };
const r = (a: number, b: number) => (b ? (a / b) * 100 : null);
const pctF = (v: number | null) => (v === null ? "—" : `${pct1.format(v)}%`);

const W = 900;
const H = 230;
const L = 56;
const R = 12;
const T = 14;
const B = 26;

function Chart({ metric, n }: { metric: string; n: number }) {
  const m = SQP_METRICS.find((x) => x.label === metric)!;
  const pair = PAIR[metric] ? SQP_METRICS.find((x) => x.label === PAIR[metric])! : null;
  const weeks = SQP_WEEKS.slice(-n);
  const cells = WEEKLY.slice(-n);
  const ours = cells.map((c) => m.get(c));
  const mkt = pair ? cells.map((c) => pair.get(c)) : [];
  const vals = [...ours, ...mkt].filter((v): v is number => v !== null);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || hi * 0.1 || 1;
  const min = m.rate ? Math.max(0, lo - pad) : Math.max(0, lo - pad);
  const max = hi + pad;
  const X = (k: number) => L + ((W - L - R) * k) / Math.max(1, n - 1);
  const Y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
  const path = (vs: (number | null)[]) => vs.reduce((acc, v, k) => (v === null ? acc : `${acc}${acc ? "L" : "M"}${X(k).toFixed(1)} ${Y(v).toFixed(1)}`), "");
  const every = n > 14 ? 2 : 1;

  return (
    <svg className={sw.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metric} per week`}>
      {[0, 1, 2, 3].map((j) => {
        const v = min + ((max - min) * j) / 3;
        return (
          <g key={j}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className={sw.grid} />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end" className={sw.axis}>
              {fmtSqp(m, v)}
            </text>
          </g>
        );
      })}
      {pair ? <path key={`m${metric}${n}`} d={path(mkt)} pathLength={1} className={sw.mkt} /> : null}
      <path key={`o${metric}${n}`} d={path(ours)} pathLength={1} className={sw.ours} />
      {ours.map((v, k) =>
        v === null ? null : (
          <circle key={k} cx={X(k)} cy={Y(v)} r={3} className={sw.dot}>
            <title>{`${weeks[k].label} (${weeks[k].range}): ${fmtSqp(m, v)}${pair ? ` · market ${fmtSqp(pair, mkt[k])}` : ""}`}</title>
          </circle>
        ),
      )}
      {weeks.map((w, k) =>
        k % every === (n - 1) % every ? (
          <text key={w.label} x={X(k)} y={H - 8} textAnchor="middle" className={sw.axis}>
            {w.label.replace("KW ", "")}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export default function SqpWeekly() {
  const [metric, setMetric] = useState("Our CVR %");
  const [range, setRange] = useState("13");
  const [week, setWeek] = useState(SQP_WEEKS[SQP_WEEKS.length - 1].label);
  const [q, setQ] = useState("");

  const wi = SQP_WEEKS.findIndex((w) => w.label === week);
  const top = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sqpQueries
      .filter((x) => !needle || x.q.includes(needle))
      .map((x) => ({ q: x.q, c: x.weeks[wi] }))
      .sort((a, b) => b.c.vol - a.c.vol)
      .slice(0, 100);
  }, [wi, q]);
  const newest = [...SQP_WEEKS.keys()].reverse();
  const pair = PAIR[metric];

  const exportWeekly = () =>
    downloadCsv("sqp-weekly.csv", [
      ["Week", "Range", "Queries", "Search volume", "CTR ours", "CTR market", "CVR ours", "CVR market", "Impr. share", "Click share", "Purchase share", "Our purchases"],
      ...newest.map((i) => {
        const c = WEEKLY[i];
        const n2 = (v: number | null) => (v === null ? "" : Math.round(v * 100) / 100);
        return [SQP_WEEKS[i].label, SQP_WEEKS[i].range, sqpQueries.length, c.vol, n2(r(c.oClicks, c.oImpr)), n2(r(c.clicks, c.impr)), n2(r(c.oPurch, c.oClicks)), n2(r(c.purch, c.clicks)), n2(r(c.oImpr, c.impr)), n2(r(c.oClicks, c.clicks)), n2(r(c.oPurch, c.purch)), c.oPurch];
      }),
    ]);

  return (
    <View>
      <section className="panel flush" aria-label="SQP chart">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 className="ph">{metric}, week by week</h2>
            <Info label="SQP weekly">
              <p>Search Query Performance for all tracked queries summed. Market figures are everyone&apos;s clicks and purchases on the same queries, so the gap between the two lines is how we convert against the field.</p>
              <p>Amazon doesn&apos;t publish category median or top values here, so they are left out.</p>
            </Info>
          </div>
          <div className={sw.legend}>
            <span>
              <i />
              Ours
            </span>
            {pair ? (
              <span>
                <i className={sw.m} />
                Market
              </span>
            ) : null}
          </div>
        </div>
        <div className={st.tbar}>
          <div className="filters">
            <Select label="Chart metric" value={metric} options={SQP_METRICS.map((x) => x.label)} onChange={setMetric} />
            <Segmented
              label="Range"
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: "13", label: "13 weeks" },
                { value: "26", label: "26 weeks" },
              ]}
            />
          </div>
        </div>
        <div className={sw.body}>
          <Chart metric={metric} n={Number(range)} />
        </div>
      </section>

      <section className="panel flush" aria-label="SQP by week">
        <div className="ph-row between">
          <h2 className="ph">Our funnel against the market</h2>
          <p className="tot">
            <b>{SQP_WEEKS.length}</b> weeks
            <button type="button" className="btn sm" style={{ marginLeft: 12 }} onClick={exportWeekly}>
              CSV
            </button>
          </p>
        </div>
        <div className="tscroll tall">
          <table>
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col" className="n">Queries</th>
                <th scope="col" className="n">Search volume</th>
                <th scope="col" className="n">CTR ours</th>
                <th scope="col" className="n">CTR market</th>
                <th scope="col" className="n">CVR ours</th>
                <th scope="col" className="n">CVR market</th>
                <th scope="col" className="n">Impr. share</th>
                <th scope="col" className="n">Click share</th>
                <th scope="col" className="n">Purchase share</th>
                <th scope="col" className="n">Our purchases</th>
              </tr>
            </thead>
            <tbody className={st.rows}>
              {newest.map((i, k) => {
                const c = WEEKLY[i];
                const co = r(c.oPurch, c.oClicks);
                const cm = r(c.purch, c.clicks);
                return (
                  <tr key={SQP_WEEKS[i].label} style={{ "--i": k } as CSSProperties}>
                    <th scope="row">
                      {SQP_WEEKS[i].label}
                      <small>{SQP_WEEKS[i].range}</small>
                    </th>
                    <td className="n">{sqpQueries.length}</td>
                    <td className="n">{int.format(c.vol)}</td>
                    <td className="n">{pctF(r(c.oClicks, c.oImpr))}</td>
                    <td className="n">{pctF(r(c.clicks, c.impr))}</td>
                    <td className="n strong" style={co !== null && cm !== null && co < cm ? { color: "var(--bad)" } : undefined}>
                      {pctF(co)}
                    </td>
                    <td className="n">{pctF(cm)}</td>
                    <td className="n">{pctF(r(c.oImpr, c.impr))}</td>
                    <td className="n">{pctF(r(c.oClicks, c.clicks))}</td>
                    <td className="n">{pctF(r(c.oPurch, c.purch))}</td>
                    <td className="n">{int.format(c.oPurch)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel flush" aria-label="Top queries">
        <div className="ph-row between">
          <h2 className="ph">Top queries · {week}</h2>
          <p className="tot">
            top <b>{top.length}</b> by search volume
          </p>
        </div>
        <div className={st.tbar}>
          <div className="filters">
            <Select label="Week" value={week} options={newest.map((i) => SQP_WEEKS[i].label)} onChange={setWeek} />
            <input type="search" className={st.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a query" aria-label="Find a query" />
          </div>
        </div>
        <div className="tscroll tall">
          <table>
            <thead>
              <tr>
                <th scope="col">Query</th>
                <th scope="col" className="n">Search volume</th>
                <th scope="col" className="n">Our impr.</th>
                <th scope="col" className="n">Our clicks</th>
                <th scope="col" className="n">Our purchases</th>
                <th scope="col" className="n">Our CVR</th>
                <th scope="col" className="n">Market clicks</th>
                <th scope="col" className="n">Market purchases</th>
                <th scope="col" className="n">Market CVR</th>
                <th scope="col" className="n">Click share</th>
                <th scope="col" className="n">Purchase share</th>
              </tr>
            </thead>
            <tbody key={`${week}${q}`} className={st.rows}>
              {top.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty">
                    No query matches.
                  </td>
                </tr>
              ) : null}
              {top.map(({ q: query, c }, k) => {
                const co = r(c.oPurch, c.oClicks);
                const cm = r(c.purch, c.clicks);
                return (
                  <tr key={query} style={{ "--i": k } as CSSProperties}>
                    <th scope="row" className={st.name}>
                      {query}
                    </th>
                    <td className="n strong">{int.format(c.vol)}</td>
                    <td className="n">{int.format(c.oImpr)}</td>
                    <td className="n">{int.format(c.oClicks)}</td>
                    <td className="n">{int.format(c.oPurch)}</td>
                    <td className="n" style={co !== null && cm !== null && co < cm * 0.5 ? { color: "var(--bad)" } : undefined}>
                      {pctF(co)}
                    </td>
                    <td className="n">{int.format(c.clicks)}</td>
                    <td className="n">{int.format(c.purch)}</td>
                    <td className="n">{pctF(cm)}</td>
                    <td className="n">{pctF(r(c.oClicks, c.clicks))}</td>
                    <td className="n">{pctF(r(c.oPurch, c.purch))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </View>
  );
}
