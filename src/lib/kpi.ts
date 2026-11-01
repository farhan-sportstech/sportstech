// Account KPIs per ISO week and per month. Invented until Supabase serves it (kpi_weekly, kpi_monthly, kpi_category_week);
// the field names follow those tables so the swap is mechanical.
import { rng } from "./mock";

export type KpiRow = {
  key: string;
  label: string; // "KW 43" or "Oct"
  sub: string; // "19–25 Oct" or "1–30 Oct"
  partial: boolean;
  sales: number;
  orders: number;
  units: number;
  sessions: number | null; // Business Reports lag a few days, so the newest period can have none yet
  pageViews: number | null;
  adSales: number; // PPC: SP + SB + SD attributed, 14 days
  adSpend: number;
  impressions: number;
  clicks: number;
  adOrders: number;
  fees: number;
  refunds: number;
  // spend splits
  sp: number;
  sb: number;
  sd: number;
  tos: number; // placements (SP only)
  pp: number;
  ros: number;
  branded: number;
  nonBranded: number;
  defense: number;
  offense: number;
  exact: number;
  phrase: number;
  broad: number;
  auto: number;
  pat: number;
  cats: Record<string, number>; // product sales per category
};

// the category names kpi_category_week uses
export const KPI_CATS = ["Treadmills", "Exercise bikes", "Vibration plates", "Cross trainers", "Rowing machines", "Strength stations", "Benches & weights", "Small equipment & accessories", "Hoverboards & scooters", "Trampolines", "Other"];
const SHARE = [0.52, 0.12, 0.08, 0.06, 0.07, 0.05, 0.04, 0.03, 0.02, 0.01, 0.01];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (d: Date) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;

function split(rnd: () => number, total: number, base: number[]) {
  const w = base.map((b) => b * (0.8 + rnd() * 0.4));
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => Math.round(((total * x) / s) * 100) / 100);
}

function row(rnd: () => number, key: string, label: string, sub: string, scale: number, season: number, partial: boolean): KpiRow {
  const sales = Math.round(scale * season * (0.85 + rnd() * 0.3));
  const units = Math.round(sales / (235 + rnd() * 40));
  const orders = Math.round(units * (0.96 + rnd() * 0.03));
  const sessions = Math.round(units / (0.016 + rnd() * 0.006));
  const adSpend = Math.round(sales * (0.09 + rnd() * 0.05));
  const adSales = Math.round(adSpend / (0.17 + rnd() * 0.09));
  const clicks = Math.round(adSpend / (1.25 + rnd() * 0.3));
  const [sp, sb, sd] = split(rnd, adSpend, [0.74, 0.08, 0.18]);
  const [tos, pp, ros] = split(rnd, sp, [0.4, 0.34, 0.26]);
  const [branded, nonBranded] = split(rnd, adSpend, [0.13, 0.87]);
  const [defense, offense] = split(rnd, adSpend, [0.18, 0.82]);
  const [exact, phrase, broad, auto, pat] = split(rnd, sp, [0.42, 0.16, 0.14, 0.06, 0.22]);
  const cats = Object.fromEntries(KPI_CATS.map((c, i) => [c, Math.round(sales * SHARE[i] * (0.75 + rnd() * 0.5))]));
  return {
    key,
    label,
    sub,
    partial,
    sales,
    orders,
    units,
    sessions,
    pageViews: Math.round(sessions * (1.5 + rnd() * 0.3)),
    adSales,
    adSpend,
    impressions: Math.round(clicks / (0.0045 + rnd() * 0.002)),
    clicks,
    adOrders: Math.round(adSales / (240 + rnd() * 40)),
    fees: Math.round(sales * (0.27 + rnd() * 0.03)),
    refunds: Math.round(sales * (0.04 + rnd() * 0.03)),
    sp,
    sb,
    sd,
    tos,
    pp,
    ros,
    branded,
    nonBranded,
    defense,
    offense,
    exact,
    phrase,
    broad,
    auto,
    pat,
    cats,
  };
}

/** 26 ISO weeks, newest first; the newest is partial (5 of 7 days). */
export const kpiWeeks: KpiRow[] = (() => {
  const r = rng(271);
  const monday = Date.UTC(2026, 9, 26); // KW 44
  return Array.from({ length: 26 }, (_, i) => {
    const start = new Date(monday - i * 7 * 864e5);
    const partial = i === 0;
    const end = new Date(start.getTime() + (partial ? 4 : 6) * 864e5);
    // a Prime Day bump in KW 41, a summer dip
    const kw = 44 - i;
    const season = (kw === 41 ? 1.7 : 1) * (kw >= 27 && kw <= 33 ? 0.8 : 1) * (partial ? 5 / 7 : 1);
    return row(r, `w${kw}`, `KW ${kw}`, `${day(start)}–${day(end)}`, 360_000, season, partial);
  });
})();

/** 6 calendar months, newest first; October runs to the 30th. */
export const kpiMonths: KpiRow[] = (() => {
  const r = rng(613);
  return Array.from({ length: 6 }, (_, i) => {
    const m = 9 - i;
    const partial = i === 0;
    const days = new Date(Date.UTC(2026, m + 1, 0)).getUTCDate();
    const season = (m >= 6 && m <= 7 ? 0.82 : 1) * (m === 9 ? 1.12 : 1) * (partial ? 30 / days : 1);
    return row(r, `m${m}`, MON[m], partial ? `1–30 ${MON[m]}` : `${MON[m]} 2026`, 1_560_000, season, partial);
  });
})();
