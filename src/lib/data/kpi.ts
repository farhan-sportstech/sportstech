// Weekly KPIs from kpi_weekly, kpi_monthly and kpi_category_week, mapped onto the KpiRow shape the page reads.
// Falls back to the sample rows in lib/kpi.ts when the database isn't configured.
import { cacheLife } from "next/cache";
import { kpiMonths, kpiWeeks, type KpiRow } from "../kpi";
import { lastLoad, selectAll } from "./supabase";

const TYPES = ["sp", "sb", "sd"] as const;
type Num = string | number | null;
type Raw = Record<string, Num> & { week_start?: string; week_end?: string; month_start?: string; month_end?: string };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const n = (v: Num | undefined) => (v === null || v === undefined ? 0 : Number(v));
const nOrNull = (v: Num | undefined) => (v === null || v === undefined ? null : Number(v));
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const dm = (iso: string) => `${d(iso).getUTCDate()} ${MON[d(iso).getUTCMonth()]}`;
// ISO week number of a Monday
const isoWeek = (iso: string) => {
  const t = d(iso);
  t.setUTCDate(t.getUTCDate() + 3);
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - jan4.getTime()) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
};

function toRow(r: Raw, key: string, label: string, sub: string, cats: Record<string, number>): KpiRow {
  const sum = (m: string) => TYPES.reduce((a, t) => a + n(r[`${t}_${m}`]), 0);
  const sales = n(r.sales);
  return {
    key,
    label,
    sub,
    partial: n(r.partial) === 1,
    sales,
    orders: n(r.orders),
    units: n(r.units),
    sessions: nOrNull(r.sessions),
    pageViews: nOrNull(r.page_views),
    adSales: sum("sales"),
    adSpend: sum("spend"),
    impressions: sum("impressions"),
    clicks: sum("clicks"),
    adOrders: sum("orders"),
    // stored as rates for now; the loader will store amounts (handoff 4)
    fees: sales * n(r.fee_rate),
    refunds: sales * n(r.refund_rate),
    sp: n(r.sp_spend),
    sb: n(r.sb_spend),
    sd: n(r.sd_spend),
    // SP placements aren't in the KPI tables yet (handoff 4): zero, and the page hides that breakdown
    tos: 0,
    pp: 0,
    ros: 0,
    branded: n(r.brb_spend),
    nonBranded: n(r.brn_spend),
    // std / sto are read as defense / offense until the loader's kpi_rebuild.py confirms it
    defense: n(r.std_spend),
    offense: n(r.sto_spend),
    exact: n(r.mte_spend),
    phrase: n(r.mtp_spend),
    broad: n(r.mtb_spend),
    auto: n(r.mta_spend),
    pat: n(r.mtt_spend),
    cats,
  };
}

export type KpiData = { weeks: KpiRow[]; months: KpiRow[]; live: boolean; asOf: string | null };

export async function getKpi(): Promise<KpiData> {
  "use cache";
  cacheLife("hours");
  const [w, m, c, asOf] = await Promise.all([
    selectAll<Raw>("kpi_weekly", "select=*&order=week_start.desc"),
    selectAll<Raw>("kpi_monthly", "select=*&order=month_start.desc"),
    selectAll<{ week_start: string; category: string; sales: Num }>("kpi_category_week", "select=week_start,category,sales"),
    lastLoad(),
  ]);
  if (!w || !m || !c) return { weeks: kpiWeeks, months: kpiMonths, live: false, asOf: null };

  const byWeek = new Map<string, Record<string, number>>();
  // months take the weeks that start in them; weeks crossing a month end count to the month they start in
  const byMonth = new Map<string, Record<string, number>>();
  for (const x of c) {
    const wk = (byWeek.get(x.week_start) ?? byWeek.set(x.week_start, {}).get(x.week_start))!;
    wk[x.category] = (wk[x.category] ?? 0) + n(x.sales);
    const mk = x.week_start.slice(0, 7);
    const mo = (byMonth.get(mk) ?? byMonth.set(mk, {}).get(mk))!;
    mo[x.category] = (mo[x.category] ?? 0) + n(x.sales);
  }

  const weeks = w.map((r) => {
    const s = r.week_start!;
    return toRow(r, s, `KW ${isoWeek(s)}`, `${dm(s)}–${dm(r.week_end!)}`, byWeek.get(s) ?? {});
  });
  const months = m.map((r) => {
    const s = r.month_start!;
    const mon = MON[d(s).getUTCMonth()];
    const partial = n(r.partial) === 1;
    return toRow(r, s, mon, partial ? `1–${d(r.month_end!).getUTCDate()} ${mon}` : `${mon} ${s.slice(0, 4)}`, byMonth.get(s.slice(0, 7)) ?? {});
  });
  return { weeks, months, live: true, asOf };
}
