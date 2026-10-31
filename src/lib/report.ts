// Report builder: assembles a per-product review from the same data the category sections use,
// with a short summary per block computed from exactly the periods and metrics picked.
import type { CategoryData, Mode, OverallRow } from "./category";
import { addCell, categoryAds, categoryCampaigns, scopeRows, zero, type Cell } from "./ads";
import { categorySqp, sqpScope, type SqpCell } from "./sqp";
import { PLACEMENTS, categoryPlacements } from "./placements";
import { RANK_DATES, productRanks } from "./ranks";
import { acos, change, eur, eur2, int, pct1, pct2, tacos } from "./format";
import { organicShare } from "./metrics";

export type RptSection = "performance" | "campaigns" | "keywords" | "queries" | "placements" | "rank" | "targets";
export const RPT_SECTIONS: { key: RptSection; label: string }[] = [
  { key: "performance", label: "Performance" },
  { key: "targets", label: "Targets" },
  { key: "campaigns", label: "Campaigns" },
  { key: "keywords", label: "Keywords" },
  { key: "queries", label: "Search queries" },
  { key: "placements", label: "Placements" },
  { key: "rank", label: "Organic rank" },
];

type PerfM = { key: string; label: string; get: (r: OverallRow) => number | null; fmt: (v: number) => string };
const pctF = (v: number) => `${pct1.format(v)}%`;
export const PERF_METRICS: PerfM[] = [
  { key: "sales", label: "Sales", get: (r) => r.sales, fmt: (v) => eur.format(v) },
  { key: "units", label: "Units", get: (r) => r.units, fmt: (v) => int.format(v) },
  { key: "orders", label: "Orders", get: (r) => r.orders, fmt: (v) => int.format(v) },
  { key: "sessions", label: "Sessions", get: (r) => r.sessions, fmt: (v) => int.format(v) },
  { key: "usp", label: "Unit session %", get: (r) => (r.sessions ? (r.units / r.sessions) * 100 : null), fmt: (v) => `${pct2.format(v)}%` },
  { key: "spend", label: "Ad spend", get: (r) => r.adSpend, fmt: (v) => eur2.format(v) },
  { key: "adsales", label: "Ad sales", get: (r) => r.adSales, fmt: (v) => eur.format(v) },
  { key: "acos", label: "ACOS", get: acos, fmt: pctF },
  { key: "tacos", label: "TACoS", get: tacos, fmt: pctF },
  { key: "organic", label: "Organic share", get: organicShare, fmt: pctF },
];
export const PERF_DEFAULT = ["sales", "units", "spend", "acos", "tacos"];

type CellM = { key: string; label: string; get: (c: Cell) => number | null; fmt: (v: number) => string };
const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null);
export const KW_METRICS: CellM[] = [
  { key: "spend", label: "Spend", get: (c) => c.spend, fmt: (v) => eur2.format(v) },
  { key: "sales", label: "Sales", get: (c) => c.sales, fmt: (v) => eur.format(v) },
  { key: "acos", label: "ACOS", get: (c) => ratio(c.spend, c.sales), fmt: pctF },
  { key: "orders", label: "Orders", get: (c) => c.orders, fmt: (v) => int.format(v) },
  { key: "clicks", label: "Clicks", get: (c) => c.clicks, fmt: (v) => int.format(v) },
  { key: "cvr", label: "CVR", get: (c) => ratio(c.orders, c.clicks), fmt: (v) => `${pct2.format(v)}%` },
];
export const KW_DEFAULT = ["spend", "sales", "acos", "orders"];

type SqpM = { key: string; label: string; get: (c: SqpCell) => number | null; fmt: (v: number) => string };
export const SQP_METRICS: SqpM[] = [
  { key: "vol", label: "Search volume", get: (c) => c.vol, fmt: (v) => int.format(v) },
  { key: "csh", label: "Click share", get: (c) => ratio(c.clicks, c.mClicks), fmt: pctF },
  { key: "psh", label: "Purchase share", get: (c) => ratio(c.purch, c.mPurch), fmt: pctF },
  { key: "pu", label: "Our purchases", get: (c) => c.purch, fmt: (v) => int.format(v) },
  { key: "mcvr", label: "Market CVR", get: (c) => ratio(c.mPurch, c.mClicks), fmt: (v) => `${pct2.format(v)}%` },
];
export const SQP_DEFAULT = ["vol", "csh", "psh"];

// a block is one titled table with its summary; numeric columns are right-aligned in every output
export type Table = { head: string[]; rows: string[][]; num: boolean[] };
export type Block = { title: string; summary: string; table: Table | null };
export type Page = { name: string; asin: string; family: string; blocks: Block[] };
export type Report = { title: string; subtitle: string; pages: Page[] };

export type ReportOptions = {
  data: CategoryData;
  mode: Mode;
  periods: number[]; // indices into data.periods[mode], latest first
  asins: string[];
  sections: RptSection[];
  perf: string[];
  kw: string[];
  sqp: string[];
  topN: number;
  targets: Record<string, number>;
};

const sumCells = (w: (Cell | null)[], idx: number[]) => idx.reduce((a, i) => addCell(a, w[i] ?? null), zero());
const dash = (v: number | null, fmt: (v: number) => string) => (v === null ? "—" : fmt(v));
const sign = (v: number, unit = "%") => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${pct1.format(Math.abs(v))}${unit}`;

export function buildReport(o: ReportOptions): Report {
  const { data, mode } = o;
  const all = data.periods[mode];
  const idx = [...o.periods].sort((a, b) => a - b);
  const kws = idx.map((i) => all[i].kw);
  const span = idx.length === 1 ? kws[0] : `${kws[kws.length - 1]}–${kws[0]}`;
  const unit = mode === "weekly" ? "week" : "month";
  const famOf = (asin: string) => data.families.find((f) => f.products.some((p) => p.asin === asin))?.name ?? "";

  const pages = o.asins.map((asin): Page => {
    const p = data.products.find((x) => x.asin === asin)!;
    const scope = `asin:${asin}`;
    const blocks: Block[] = [];

    for (const sec of o.sections) {
      if (sec === "performance") {
        const rows = data.totals(scope, mode);
        const ms = PERF_METRICS.filter((m) => o.perf.includes(m.key));
        const [a, b] = [rows[idx[0]], rows[idx[1]]];
        const bits = [`${eur.format(a.sales)} sales in ${kws[0]}`];
        if (b) bits[0] += ` (${sign(change(a.sales, b.sales))} vs ${kws[1]})`;
        bits.push(`ACOS ${pct1.format(acos(a))}%${b ? ` (${sign(acos(a) - acos(b), " pp")})` : ""}`, `TACoS ${pct1.format(tacos(a))}%`);
        blocks.push({
          title: "Performance",
          summary: bits.join(", ") + ".",
          table: { head: ["Metric", ...kws], rows: ms.map((m) => [m.label, ...idx.map((i) => dash(m.get(rows[i]), m.fmt))]), num: [false, ...kws.map(() => true)] },
        });
      }

      if (sec === "targets") {
        const target = o.targets[asin];
        if (!target) {
          blocks.push({ title: "Targets", summary: "No monthly order target set for this product.", table: null });
          continue;
        }
        // month to date ≈ units this month; pace projects it to a full month
        const month = data.toDate(scope)[2];
        const mtd = month.cur.units;
        const daysIn = 31;
        const daysDone = 30;
        const proj = Math.round((mtd / daysDone) * daysIn);
        const gap = Math.max(0, target - mtd);
        blocks.push({
          title: "Targets",
          summary: `${int.format(mtd)} of ${int.format(target)} orders so far this month; at this pace ${int.format(proj)} by month end (${pct1.format((proj / target) * 100)}% of target).${gap ? ` ${int.format(gap)} still to close.` : " Target reached."}`,
          table: { head: ["Target", "Month to date", "Projected", "Pace", "Still to close"], rows: [[int.format(target), int.format(mtd), int.format(proj), `${pct1.format((proj / target) * 100)}%`, int.format(gap)]], num: [true, true, true, true, true] },
        });
      }

      if (sec === "campaigns") {
        const camps = categoryCampaigns(data, mode, scope)
          .map((c) => ({ ...c, t: sumCells(c.w, idx) }))
          .filter((c) => c.t.spend > 0)
          .sort((x, y) => y.t.spend - x.t.spend);
        const top = camps.slice(0, o.topN);
        const tot = camps.reduce((acc, c) => addCell(acc, c.t), zero());
        const sharedSpend = camps.filter((c) => !c.own).reduce((acc, c) => acc + c.t.spend, 0);
        blocks.push({
          title: "Campaigns",
          summary: camps.length
            ? `${camps.length} campaigns spent ${eur2.format(tot.spend)} over ${span} at ACOS ${dash(ratio(tot.spend, tot.sales), pctF)}. Biggest: ${top[0].name}. Shared catch-alls took ${pct1.format(tot.spend ? (sharedSpend / tot.spend) * 100 : 0)}% of spend.`
            : `No campaign spend over ${span}.`,
          table: { head: ["Campaign", "Type", "Spend", "Sales", "ACOS", "Orders"], rows: top.map((c) => [c.name, c.own ? "own" : "shared", eur2.format(c.t.spend), eur.format(c.t.sales), dash(ratio(c.t.spend, c.t.sales), pctF), int.format(c.t.orders)]), num: [false, false, true, true, true, true] },
        });
      }

      if (sec === "keywords") {
        const rows = scopeRows(categoryAds(data, mode), [asin])
          .filter((r) => r.match !== "Auto")
          .map((r) => ({ ...r, t: sumCells(r.w, idx) }))
          .filter((r) => r.t.spend > 0)
          .sort((x, y) => y.t.spend - x.t.spend);
        const ms = KW_METRICS.filter((m) => o.kw.includes(m.key));
        const top = rows.slice(0, o.topN);
        const dead = rows.filter((r) => r.t.orders === 0);
        const best = [...top].filter((r) => r.t.sales > 0).sort((x, y) => x.t.spend / x.t.sales - y.t.spend / y.t.sales)[0];
        blocks.push({
          title: "Keywords & targets",
          summary: rows.length
            ? `${rows.length} keywords and targets spent money over ${span}.${best ? ` Most efficient of the top ${top.length}: “${best.term}” at ACOS ${pct1.format((best.t.spend / best.t.sales) * 100)}%.` : ""}${dead.length ? ` ${dead.length} spent ${eur2.format(dead.reduce((a, r) => a + r.t.spend, 0))} with no order.` : ""}`
            : `No keyword spend over ${span}.`,
          table: { head: ["Keyword or target", "Match", ...ms.map((m) => m.label)], rows: top.map((r) => [r.term, r.sub ?? r.match, ...ms.map((m) => dash(m.get(r.t), m.fmt))]), num: [false, false, ...ms.map(() => true)] },
        });
      }

      if (sec === "queries") {
        const latest = idx[0];
        const qs = categorySqp(data, mode)
          .filter((r) => r.relevant)
          .map((r) => ({ q: r.q, c: sqpScope(r, [asin], all.length)[latest] }))
          .filter((r): r is { q: string; c: SqpCell } => !!r.c)
          .sort((x, y) => y.c.vol - x.c.vol);
        const ms = SQP_METRICS.filter((m) => o.sqp.includes(m.key));
        const top = qs.slice(0, o.topN);
        const lead = top[0];
        blocks.push({
          title: "Search queries",
          summary: lead
            ? `Biggest query in ${kws[0]}: “${lead.q}” with ${int.format(lead.c.vol)} searches; this product took ${pct1.format(ratio(lead.c.clicks, lead.c.mClicks) ?? 0)}% of its clicks and ${pct1.format(ratio(lead.c.purch, lead.c.mPurch) ?? 0)}% of its purchases.`
            : `No Search Query Performance data for ${kws[0]}.`,
          table: { head: ["Search query", ...ms.map((m) => m.label)], rows: top.map((r) => [r.q, ...ms.map((m) => dash(m.get(r.c), m.fmt))]), num: [false, ...ms.map(() => true)] },
        });
      }

      if (sec === "placements") {
        const w = categoryPlacements(data, scope)[mode === "weekly" ? idx[0] : 0];
        const tot = PLACEMENTS.reduce((a, pl) => addCell(a, w.p[pl]), zero());
        const tos = w.p["Top of Search"];
        blocks.push({
          title: `Placements · ${w.kw}`,
          summary: `Top of Search took ${pct1.format(tot.spend ? (tos.spend / tot.spend) * 100 : 0)}% of SP spend at ACOS ${dash(ratio(tos.spend, tos.sales), pctF)} and CVR ${dash(ratio(tos.orders, tos.clicks), (v) => `${pct2.format(v)}%`)}.${mode === "monthly" ? " Placements are reported weekly only." : ""}`,
          table: {
            head: ["Placement", "Spend", "Share", "Sales", "ACOS", "CVR"],
            rows: PLACEMENTS.map((pl) => {
              const c = w.p[pl];
              return [pl, eur2.format(c.spend), pctF(tot.spend ? (c.spend / tot.spend) * 100 : 0), eur.format(c.sales), dash(ratio(c.spend, c.sales), pctF), dash(ratio(c.orders, c.clicks), (v) => `${pct2.format(v)}%`)];
            }),
            num: [false, true, true, true, true, true],
          },
        });
      }

      if (sec === "rank") {
        const last = (rs: (number | null)[]) => [...rs].reverse().find((x) => x !== null) ?? null;
        const first = (rs: (number | null)[]) => rs.find((x) => x !== null) ?? null;
        const rs = productRanks(data, asin).sort((x, y) => (last(x.ranks) ?? 999) - (last(y.ranks) ?? 999));
        const top = rs.slice(0, o.topN);
        const p1 = rs.filter((r) => (last(r.ranks) ?? 999) <= 20).length;
        const better = rs.filter((r) => {
          const f = first(r.ranks);
          const l = last(r.ranks);
          return f !== null && l !== null && l < f;
        }).length;
        blocks.push({
          title: "Organic rank",
          summary: `${p1} of ${rs.length} tracked queries on page 1; ${better} improved between ${RANK_DATES[0]} and ${RANK_DATES[RANK_DATES.length - 1]}.`,
          table: {
            head: ["Search query", RANK_DATES[0], RANK_DATES[RANK_DATES.length - 1], "Change"],
            rows: top.map((r) => {
              const f = first(r.ranks);
              const l = last(r.ranks);
              return [r.q, f === null ? "—" : `#${f}`, l === null ? "not in top 60" : `#${l}`, f !== null && l !== null ? (f - l === 0 ? "±0" : `${f - l > 0 ? "▲" : "▼"} ${Math.abs(f - l)}`) : "—"];
            }),
            num: [false, true, true, true],
          },
        });
      }
    }
    return { name: p.name, asin, family: famOf(asin), blocks };
  });

  return {
    title: `${data.def.title} · product review`,
    subtitle: `Amazon.de · ${span} (${idx.length} ${unit}${idx.length === 1 ? "" : "s"}) · ${pages.length} product${pages.length === 1 ? "" : "s"}`,
    pages,
  };
}
