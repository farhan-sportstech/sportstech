"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import { DAYS, account, acosD, addDay, cpcD, ctrD, cvrD, roasD, sumDays, zeroDay, type Day } from "@/lib/account";
import { RANK_DATES, campRows, gapRows } from "@/lib/hub";
import { change, eur, eur2, int, pct1, pct2 } from "@/lib/format";
import { cx } from "@/lib/cx";
import Bars from "../../Bars";
import CountUp from "../../CountUp";
import Delta from "../../Delta";
import Info from "../../Info";
import MultiSelect from "../../MultiSelect";
import Segmented from "../../Segmented";
import { useHub } from "../HubContext";
import { View } from "../HubTable";
import QueueButton from "../QueueButton";
import { Tag } from "../cells";
import { FROM, improvements } from "./improvementRules";
import st from "../hub.module.css";
import hs from "./Home.module.css";

type Win = "7" | "14";
const HUES = ["var(--accent)", "#8b7bc4", "#2f9e8f", "#d08a2c"];
type TM = { key: string; label: string; get: (d: Day) => number | null; fmt: (v: number) => string };
const TREND: TM[] = [
  { key: "spend", label: "Spend", get: (d) => d.spend, fmt: (v) => eur.format(v) },
  { key: "sales", label: "Sales", get: (d) => d.sales, fmt: (v) => eur.format(v) },
  { key: "acos", label: "ACOS", get: acosD, fmt: (v) => `${pct1.format(v)}%` },
  { key: "roas", label: "ROAS", get: roasD, fmt: (v) => pct2.format(v) },
  { key: "orders", label: "Orders", get: (d) => d.orders, fmt: (v) => int.format(v) },
  { key: "clicks", label: "Clicks", get: (d) => d.clicks, fmt: (v) => int.format(v) },
  { key: "impr", label: "Impressions", get: (d) => d.impr, fmt: (v) => int.format(v) },
  { key: "cvr", label: "CVR", get: cvrD, fmt: (v) => `${pct1.format(v)}%` },
  { key: "cpc", label: "CPC", get: cpcD, fmt: (v) => eur2.format(v) },
  { key: "ctr", label: "CTR", get: ctrD, fmt: (v) => `${pct2.format(v)}%` },
];
const STRATEGY_LABEL: Record<string, string> = { Exact: "Exact", Phrase: "Phrase", Broad: "Broad", Auto: "Auto", PAT: "Product targeting" };

/** Several metrics on one chart, each indexed to its first bucket (= 0%), so their shapes compare. */
function IndexChart({ buckets, metrics }: { buckets: { label: string; d: Day }[]; metrics: TM[] }) {
  const W = 900;
  const H = 230;
  const L = 52;
  const R = 12;
  const T = 12;
  const B = 26;
  const series = metrics.map((m) => {
    const vals = buckets.map((b) => m.get(b.d));
    const first = vals.find((v) => v !== null && v !== 0) ?? null;
    return { m, vals, idx: vals.map((v) => (v === null || !first ? null : (v / first - 1) * 100)) };
  });
  const all = series.flatMap((s) => s.idx).filter((v): v is number => v !== null);
  const lo = Math.min(0, ...all);
  const hi = Math.max(0, ...all);
  const pad = (hi - lo) * 0.1 || 10;
  const min = lo - pad;
  const max = hi + pad;
  const n = buckets.length;
  const X = (k: number) => L + ((W - L - R) * k) / Math.max(1, n - 1);
  const Y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const every = Math.ceil(n / 10);
  return (
    <svg className={hs.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metrics.map((m) => m.label).join(", ")} indexed to the first ${n > 10 ? "day" : "week"}`}>
      {[0, 1, 2, 3].map((j) => {
        const v = min + ((max - min) * j) / 3;
        return (
          <g key={j}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className={hs.grid} />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end" className={hs.axis}>
              {v > 0 ? "+" : ""}
              {Math.round(v)}%
            </text>
          </g>
        );
      })}
      <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} className={hs.zero} />
      {series.map((s, si) => {
        const d = s.idx.reduce((acc, v, k) => (v === null ? acc : `${acc}${acc ? "L" : "M"}${X(k).toFixed(1)} ${Y(v).toFixed(1)}`), "");
        return (
          <g key={s.m.key}>
            <path d={d} pathLength={1} className={hs.line} style={{ stroke: HUES[si], "--i": si } as CSSProperties} />
            {s.idx.map((v, k) =>
              v === null ? null : (
                <circle key={k} cx={X(k)} cy={Y(v)} r={n > 10 ? 2.4 : 3.5} className={hs.dot} style={{ fill: HUES[si] }}>
                  <title>{`${buckets[k].label} · ${s.m.label}: ${s.vals[k] === null ? "—" : s.m.fmt(s.vals[k]!)} (${v > 0 ? "+" : ""}${pct1.format(v)}%)`}</title>
                </circle>
              ),
            )}
          </g>
        );
      })}
      {buckets.map((b, k) =>
        k % every === (n - 1) % every ? (
          <text key={b.label} x={X(k)} y={H - 8} textAnchor="middle" className={hs.axis}>
            {b.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

const ratioDelta = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

export default function Home() {
  const hub = useHub();
  const router = useRouter();
  const [win, setWin] = useState<Win>("7");
  const [gran, setGran] = useState("daily");
  const [tm, setTm] = useState(["spend", "sales", "acos"]);
  const n = Number(win);

  // account totals per day, newest first; the window and the one before it
  const daily = useMemo(() => DAYS.map((_, i) => account.campaigns.reduce((a, c) => addDay(a, c.days[i]), zeroDay())), []);
  const cur = sumDays(daily.slice(0, n));
  const prev = sumDays(daily.slice(n, 2 * n));
  const spark = daily.slice(0, n);
  const sparkLabels = DAYS.slice(0, n).map((d) => `${d.dow} ${d.label}`);

  const tiles: { label: string; v: number | null; kind: "eur" | "int" | "pct"; fmt: (v: number) => string; d: number | null; unit: string; good: "up" | "down" | "none"; series: number[] }[] = [
    { label: "Spend", v: cur.spend, kind: "eur", fmt: (v) => eur.format(v), d: change(cur.spend, prev.spend), unit: "%", good: "none", series: spark.map((x) => x.spend) },
    { label: "Sales", v: cur.sales, kind: "eur", fmt: (v) => eur.format(v), d: change(cur.sales, prev.sales), unit: "%", good: "up", series: spark.map((x) => x.sales) },
    { label: "ACOS", v: acosD(cur), kind: "pct", fmt: (v) => `${pct1.format(v)}%`, d: ratioDelta(acosD(cur), acosD(prev)), unit: " pp", good: "down", series: spark.map((x) => acosD(x) ?? 0) },
    { label: "Orders", v: cur.orders, kind: "int", fmt: (v) => int.format(v), d: change(cur.orders, prev.orders), unit: "%", good: "up", series: spark.map((x) => x.orders) },
    { label: "CVR", v: cvrD(cur), kind: "pct", fmt: (v) => `${pct1.format(v)}%`, d: ratioDelta(cvrD(cur), cvrD(prev)), unit: " pp", good: "up", series: spark.map((x) => cvrD(x) ?? 0) },
    { label: "CPC", v: cpcD(cur), kind: "eur", fmt: (v) => eur2.format(v), d: cpcD(prev) ? change(cpcD(cur) ?? 0, cpcD(prev)!) : null, unit: "%", good: "down", series: spark.map((x) => cpcD(x) ?? 0) },
  ];

  // trend buckets oldest first: 30 days, or 4 full weeks ending on the newest day
  const buckets = useMemo(
    () =>
      gran === "daily"
        ? [...DAYS.keys()].reverse().map((i) => ({ label: DAYS[i].label, d: daily[i] }))
        : [3, 2, 1, 0].map((w) => ({ label: `${DAYS[w * 7 + 6].label}–${DAYS[w * 7].label}`, d: sumDays(daily.slice(w * 7, w * 7 + 7)) })),
    [gran, daily],
  );
  const shownTm = TREND.filter((m) => tm.includes(m.key));

  const camps = useMemo(() => campRows("7d"), []);
  const acct7 = acosD(sumDays(daily.slice(0, 7))) ?? 0;
  const pacing = camps
    .filter((c) => c.type === "SP" && c.state === "ENABLED" && c.daysAtBudget >= 3)
    .sort((a, b) => b.daysAtBudget - a.daysAtBudget || b.d.sales - a.d.sales)
    .slice(0, 25);
  const profitableCapped = pacing.filter((c) => (acosD(c.d) ?? 999) <= acct7).length;

  const items = useMemo(() => improvements("7d", hub.target), [hub.target]);
  const todo = { High: items.filter((i) => i.priority === "High").length, Medium: items.filter((i) => i.priority === "Medium").length, Low: items.filter((i) => i.priority === "Low").length };

  // organic rank moves on tracked search terms between the last two rank dates
  const moves = useMemo(() => {
    const g = gapRows("30d").filter((r) => r.ranks[1] !== null && r.ranks[2] !== null);
    return { drop: g.filter((r) => r.ranks[2]! - r.ranks[1]! >= 5).length, climb: g.filter((r) => r.ranks[1]! - r.ranks[2]! >= 5).length };
  }, []);

  // mix tables over the window, with the window before for "vs prior"
  const mixBy = (key: (c: (typeof account.campaigns)[number]) => string | null) => {
    const by = new Map<string, { cur: Day; prev: Day }>();
    for (const c of account.campaigns) {
      const k = key(c);
      if (!k) continue;
      const e = by.get(k) ?? { cur: zeroDay(), prev: zeroDay() };
      by.set(k, { cur: addDay(e.cur, sumDays(c.days.slice(0, n))), prev: addDay(e.prev, sumDays(c.days.slice(n, 2 * n))) });
    }
    return [...by.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.cur.spend - a.cur.spend);
  };
  const byType = mixBy((c) => ({ SP: "Sponsored Products", SB: "Sponsored Brands", SD: "Sponsored Display" })[c.type]);
  const byTarget = mixBy((c) => (c.type === "SP" ? STRATEGY_LABEL[c.strategy] : null));
  const byCat = mixBy((c) => c.portfolio);
  const spMoves = mixBy((c) => (c.type === "SP" ? c.portfolio : null))
    .sort((a, b) => Math.abs(b.cur.sales - b.prev.sales) - Math.abs(a.cur.sales - a.prev.sales))
    .slice(0, 10);

  const mixTable = (title: string, rows: { k: string; cur: Day; prev: Day }[], hued: boolean, info: string) => {
    const tot = rows.reduce((a, r) => a + r.cur.spend, 0);
    return (
      <section className="panel flush" aria-label={title}>
        <div className="ph-row between">
          <div className="ph-t">
            <h2 className="ph">{title}</h2>
            <Info label={title}>
              <p>{info}</p>
            </Info>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{title.split(" by ")[1] ?? "Segment"}</th>
                <th scope="col" className="n">
                  Spend
                </th>
                <th scope="col" className="n">
                  Share
                </th>
                <th scope="col" className="n">
                  vs prior
                </th>
                <th scope="col" className="n">
                  Sales
                </th>
                <th scope="col" className="n">
                  ACOS
                </th>
                <th scope="col" className="n">
                  CPC
                </th>
                <th scope="col" className="n">
                  Orders
                </th>
              </tr>
            </thead>
            <tbody key={win} className={st.rows}>
              {rows.map((r, i) => {
                const a = acosD(r.cur);
                const cpc = cpcD(r.cur);
                return (
                  <tr key={r.k} style={{ "--i": i } as CSSProperties}>
                    <th scope="row">
                      {hued ? (
                        <span className={hs.sw}>
                          <i style={{ background: HUES[i % HUES.length] }} />
                          {r.k}
                        </span>
                      ) : (
                        r.k
                      )}
                    </th>
                    <td className="n strong">{eur.format(r.cur.spend)}</td>
                    <td className="n">
                      {pct1.format(tot ? (r.cur.spend / tot) * 100 : 0)}%
                      <span className={st.share}>
                        <i style={{ "--w": tot ? r.cur.spend / tot : 0 } as CSSProperties} />
                      </span>
                    </td>
                    <td className="n">{r.prev.spend ? <Delta value={change(r.cur.spend, r.prev.spend)} goodWhen="none" /> : <span className="na">—</span>}</td>
                    <td className="n">{eur.format(r.cur.sales)}</td>
                    <td className="n">{a === null ? <span className="na">—</span> : `${pct1.format(a)}%`}</td>
                    <td className="n">{cpc === null ? <span className="na">—</span> : eur2.format(cpc)}</td>
                    <td className="n">{int.format(r.cur.orders)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <View>
      <section className="panel" aria-label="Needs attention">
        <div className={hs.top}>
          <div className={hs.attn}>
            <span className={cx(todo.High > 0 && hs.hot)}>
              <button type="button" className="lnk" onClick={() => router.push("/hub/improvements/")}>
                <b>{todo.High}</b> high-priority improvements
              </button>
            </span>
            <span>
              <button type="button" className="lnk" onClick={() => router.push("/hub/campaigns/")}>
                <b>{profitableCapped}</b> profitable campaigns capped by budget
              </button>
            </span>
            <span>
              <button type="button" className="lnk" onClick={() => router.push("/hub/keyword-gaps/")}>
                <b>{moves.drop}</b> search terms dropped 5+ places
              </button>
            </span>
            <span>
              <b>{moves.climb}</b> climbed 5+ places
            </span>
          </div>
          <Segmented
            label="Window"
            value={win}
            onChange={setWin}
            options={[
              { value: "7", label: "7 days" },
              { value: "14", label: "14 days" },
            ]}
          />
        </div>
        <p className={hs.fresh}>
          Ads data {DAYS[n - 1].label} – {DAYS[0].label} vs {DAYS[2 * n - 1].label} – {DAYS[n].label} · keyword ranks {RANK_DATES[1]} → {RANK_DATES[2]} · all ad types
        </p>
      </section>

      <section className="panel" aria-label="Account at a glance">
        <div key={win} className={st.tiles}>
          {tiles.map((t, i) => (
            <div key={t.label} className={st.tile} style={{ "--i": i } as CSSProperties}>
              <span className={st.tl}>{t.label}</span>
              <span className={st.tv}>{t.v === null ? "—" : t.label === "CPC" ? t.fmt(t.v) : <CountUp value={t.v} kind={t.kind} />}</span>
              <span className={st.td}>{t.d === null ? <span className="na">no comparison</span> : <><Delta value={t.d} unit={t.unit} goodWhen={t.good} /> vs prior {n} days</>}</span>
              <Bars className={st.tb} values={t.series} labels={sparkLabels} format={t.fmt} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="ht-h">
        <div className={hs.chartHd}>
          <div className="ph-t">
            <h2 id="ht-h" className="ph">
              Trend
            </h2>
            <Info label="Trend">
              <p>Each line is indexed to its first {gran === "daily" ? "day" : "week"} (0%), so metrics on different scales can be read together. Hover a point for its value.</p>
            </Info>
          </div>
          <div className="filters">
            <Segmented
              label="Granularity"
              size="sm"
              value={gran}
              onChange={setGran}
              options={[
                { value: "daily", label: "Daily · 30 days" },
                { value: "weekly", label: "Weekly · 4 weeks" },
              ]}
            />
            <MultiSelect label="Metrics" value={tm} onChange={(v) => setTm(v.slice(-4))} options={TREND.map((m) => ({ value: m.key, label: m.label }))} />
          </div>
        </div>
        <div className={hs.legend}>
          {shownTm.map((m, i) => {
            const v = m.get(buckets[buckets.length - 1].d);
            return (
              <span key={m.key}>
                <i style={{ background: HUES[i] }} />
                {m.label} <b>{v === null ? "—" : m.fmt(v)}</b>
              </span>
            );
          })}
        </div>
        {shownTm.length ? <IndexChart key={`${gran}${tm.join()}`} buckets={buckets} metrics={shownTm} /> : <p className="empty">Pick at least one metric.</p>}
      </section>

      <section className="panel flush" aria-labelledby="hp-h">
        <div className="ph-row between">
          <div className="ph-t">
            <h2 id="hp-h" className="ph">
              Budget pacing
            </h2>
            <Info label="Budget pacing">
              <p>Sponsored Products campaigns that reached 95% of their daily budget on 3 or more of the last 7 days, top 25. Capped, profitable = 7-day ACOS at or under the account&apos;s ({pct1.format(acct7)}%), so a higher budget likely pays.</p>
            </Info>
          </div>
          <p className="tot">
            <b>{pacing.length}</b> capped · {profitableCapped} profitable
          </p>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                <th scope="col">Portfolio</th>
                <th scope="col" className="n">
                  Daily budget
                </th>
                <th scope="col" className="n">
                  Days at budget
                </th>
                <th scope="col" className="n">
                  Budget used
                </th>
                <th scope="col" className="n">
                  Spend 7 days
                </th>
                <th scope="col" className="n">
                  Sales 7 days
                </th>
                <th scope="col" className="n">
                  ACOS
                </th>
                <th scope="col">Read</th>
                <th scope="col">Queue</th>
              </tr>
            </thead>
            <tbody className={st.rows}>
              {pacing.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty">
                    No campaign hit its budget 3 times this week.
                  </td>
                </tr>
              ) : null}
              {pacing.map((c, i) => {
                const a = acosD(c.d);
                const ok = a !== null && a <= acct7;
                return (
                  <tr key={c.key} style={{ "--i": i } as CSSProperties}>
                    <th scope="row" className={st.name}>
                      {c.name}
                    </th>
                    <td>{c.pf}</td>
                    <td className="n">{eur.format(c.budget)}</td>
                    <td className="n">{c.daysAtBudget} of 7</td>
                    <td className="n">{pct1.format(c.used)}%</td>
                    <td className="n">{eur2.format(c.d.spend)}</td>
                    <td className="n">{eur.format(c.d.sales)}</td>
                    <td className="n">{a === null ? <span className="na">—</span> : `${pct1.format(a)}%`}</td>
                    <td>{ok ? <Tag tone="good">Capped, profitable</Tag> : <Tag tone="warn">Capped, check ACOS</Tag>}</td>
                    <td className={st.act}>
                      <QueueButton source="home" label={`Budget €${Math.round(c.budget * 1.2)}`} change={{ action: "campaign.budget", campaign: c.campaign, adGroup: "", entity: c.campaign, current: c.budget, proposed: Math.round(c.budget * 1.2) }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className={hs.cards}>
        {mixTable("Spend by ad type", byType, true, `All campaigns, the last ${n} days against the ${n} before.`)}
        {mixTable("Spend by targeting type", byTarget, true, "Sponsored Products campaigns by their targeting: Exact, Phrase and Broad keywords, Auto, and product targeting.")}
      </div>

      {mixTable("Spend by category", byCat, false, "Portfolios follow the product categories. All ad types.")}

      <div className={hs.cards}>
        <section className="panel flush" aria-labelledby="hi-h">
          <div className="ph-row between">
            <h2 id="hi-h" className="ph">
              Improvements
            </h2>
            <button type="button" className="btn sm" onClick={() => router.push("/hub/improvements/")}>
              Open improvements
            </button>
          </div>
          <div className={hs.impr}>
            <div className={hs.counts}>
              <div className={hs.hi}>
                <span>High</span>
                <b>
                  <CountUp value={todo.High} kind="int" />
                </b>
              </div>
              <div>
                <span>Medium</span>
                <b>
                  <CountUp value={todo.Medium} kind="int" />
                </b>
              </div>
              <div>
                <span>Low</span>
                <b>
                  <CountUp value={todo.Low} kind="int" />
                </b>
              </div>
            </div>
          </div>
          <p className={hs.bySrc}>
            {FROM.map((f, i) => (
              <span key={f}>
                {i ? " · " : ""}
                {f} <b>{items.filter((x) => x.from === f).length}</b>
              </span>
            ))}
          </p>
          <p className={hs.bySrc}>Counts use the last 7 days and a {hub.target}% target ACOS, before anything is marked done.</p>
        </section>

        <section className="panel flush" aria-labelledby="hm-h">
          <div className="ph-row between">
            <div className="ph-t">
              <h2 id="hm-h" className="ph">
                Biggest moves by portfolio
              </h2>
              <Info label="Biggest moves by portfolio">
                <p>Sponsored Products sales by portfolio, the 10 that changed most against the prior {n} days.</p>
              </Info>
            </div>
          </div>
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Portfolio</th>
                  <th scope="col" className="n">
                    Sales
                  </th>
                  <th scope="col" className="n">
                    Change
                  </th>
                  <th scope="col" className="n">
                    Spend
                  </th>
                  <th scope="col" className="n">
                    vs prior
                  </th>
                </tr>
              </thead>
              <tbody key={win} className={st.rows}>
                {spMoves.map((r, i) => (
                  <tr key={r.k} style={{ "--i": i } as CSSProperties}>
                    <th scope="row">{r.k}</th>
                    <td className="n strong">{eur.format(r.cur.sales)}</td>
                    <td className="n">{r.prev.sales ? <Delta value={change(r.cur.sales, r.prev.sales)} /> : <span className="na">—</span>}</td>
                    <td className="n">{eur.format(r.cur.spend)}</td>
                    <td className="n">{r.prev.spend ? <Delta value={change(r.cur.spend, r.prev.spend)} goodWhen="none" /> : <span className="na">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </View>
  );
}
