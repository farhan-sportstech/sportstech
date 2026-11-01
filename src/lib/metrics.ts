import { monthly, rng, weekly, type Row } from "@/lib/mock";
import type { OverallRow } from "@/lib/category";
import { acos, eur, eur2, int, pct1, pct2, tacos } from "@/lib/format";

// ratio: compare in percentage points; good: which direction is favourable (spend is neutral)
export type Metric<R> = { key: string; label: string; get: (r: R) => number | null; fmt: (v: number) => string; sub?: string; ratio?: boolean; good?: "up" | "down" | "none" };

const pct = (v: number) => `${pct1.format(v)}%`;
const pct2f = (v: number) => `${pct2.format(v)}%`;
const div = (a: number, b: number) => (b ? a / b : null);
export const organicSales = (r: Row) => Math.max(0, r.sales - r.adSales);
export const organicShare = (r: Row) => (r.sales ? (organicSales(r) / r.sales) * 100 : 0);
export const avgPrice = (r: Row) => (r.units ? r.sales / r.units : null);

/** A product, ASIN or family row with the traffic, ad and rank fields the product metrics need. */
export type XRow = Row & { orders: number; sessions: number; clicks: number; impressions: number; adOrders: number; spSpend: number; bsrSub: number | null; bsrMain: number | null; acctSales: number; acctSp: number };

// account totals per period, for the "share of account" metrics
const account = (mode: "weekly" | "monthly") => {
  const d = mode === "weekly" ? weekly : monthly;
  return d.periods.map((_, i) => d.categories.reduce((a, c) => ({ sales: a.sales + c.rows[i].sales, spend: a.spend + c.rows[i].adSpend }), { sales: 0, spend: 0 }));
};
const ACCOUNT = { weekly: account("weekly"), monthly: account("monthly") };

/** Derives the extra fields for one series, deterministically from its key (ASIN or SKU) until Supabase serves them. */
export function extend(rows: Row[], key: string, mode: "weekly" | "monthly", bsr?: { sub: number; main: number }): XRow[] {
  const r = rng(key.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483646, 7) || 1);
  const sessPerUnit = 16 + r() * 18;
  const cpc = 0.55 + r() * 0.8;
  const ctr = 0.003 + r() * 0.005;
  const sp = 0.8 + r() * 0.12;
  return rows.map((row, i) => {
    const clicks = Math.round(row.adSpend / (cpc * (0.9 + r() * 0.2)));
    const price = avgPrice(row) ?? 250;
    const drift = 0.8 + r() * 0.45;
    const fake: XRow = {
      ...row,
      orders: Math.round(row.units * (0.96 + r() * 0.035)),
      sessions: Math.round(row.units * sessPerUnit * (0.9 + r() * 0.2)),
      clicks,
      impressions: Math.round(clicks / ctr),
      adOrders: Math.round(row.adSales / price),
      spSpend: row.adSpend * sp,
      bsrSub: bsr ? Math.max(1, Math.round(bsr.sub * (i === 0 ? 1 : drift))) : null,
      bsrMain: bsr ? Math.max(1, Math.round(bsr.main * (i === 0 ? 1 : drift))) : null,
      acctSales: ACCOUNT[mode][i].sales,
      acctSp: ACCOUNT[mode][i].spend * 0.8,
    };
    // rows loaded from the database already carry the real fields; those win over the invented ones
    return "orders" in row ? { ...fake, ...(row as Partial<XRow>) } : fake;
  });
}

/** Sums series per period (families); ranks take the best (lowest) child rank. */
export function sumX(series: XRow[][]): XRow[] {
  return series[0].map((_, i) => {
    const xs = series.map((s) => s[i]);
    const add = (f: "sales" | "units" | "orders" | "adSpend" | "adSales" | "sessions" | "clicks" | "impressions" | "adOrders" | "spSpend") => xs.reduce((a, x) => a + x[f], 0);
    const best = (f: "bsrSub" | "bsrMain") => {
      const v = xs.map((x) => x[f]).filter((n): n is number => n !== null);
      return v.length ? Math.min(...v) : null;
    };
    return { sales: add("sales"), units: add("units"), orders: add("orders"), adSpend: add("adSpend"), adSales: add("adSales"), sessions: add("sessions"), clicks: add("clicks"), impressions: add("impressions"), adOrders: add("adOrders"), spSpend: add("spSpend"), bsrSub: best("bsrSub"), bsrMain: best("bsrMain"), acctSales: xs[0].acctSales, acctSp: xs[0].acctSp };
  });
}

/** The reference's product metrics, in its order. "Deal running" is handled by the table (entered by hand). */
export const PRODUCT_METRICS: Metric<XRow>[] = [
  { key: "sales", good: "up", label: "Total sales", sub: "tool4seller", get: (r) => r.sales, fmt: (v) => eur.format(v) },
  { key: "adSpend", good: "none", label: "Ad spend", get: (r) => r.adSpend, fmt: (v) => eur.format(v) },
  { key: "acos", good: "down", ratio: true, label: "ACOS", sub: "spend ÷ same-SKU ad sales", get: acos, fmt: pct },
  { key: "tacos", good: "down", ratio: true, label: "TACoS", sub: "spend ÷ total sales", get: tacos, fmt: pct },
  { key: "adSales", good: "up", label: "Ad sales", get: (r) => r.adSales, fmt: (v) => eur.format(v) },
  { key: "units", good: "up", label: "Units ordered", get: (r) => r.units, fmt: (v) => int.format(v) },
  { key: "sessions", good: "up", label: "Sessions", get: (r) => r.sessions, fmt: (v) => int.format(v) },
  { key: "usp", good: "up", ratio: true, label: "Unit session %", get: (r) => (r.sessions ? (r.units / r.sessions) * 100 : null), fmt: pct2f },
  { key: "organic", good: "up", ratio: true, label: "Organic % (sales)", get: organicShare, fmt: pct },
  { key: "clicks", good: "up", label: "Clicks", get: (r) => r.clicks, fmt: (v) => int.format(v) },
  { key: "cpc", good: "down", label: "Avg. CPC", get: (r) => div(r.adSpend, r.clicks), fmt: (v) => eur2.format(v) },
  { key: "cvr", good: "up", ratio: true, label: "Ad CVR", sub: "ad orders ÷ clicks", get: (r) => (r.clicks ? (r.adOrders / r.clicks) * 100 : null), fmt: pct2f },
  { key: "bsrSub", good: "down", label: "BSR sub-category", get: (r) => r.bsrSub, fmt: (v) => `#${int.format(v)}` },
  { key: "organicSales", good: "up", label: "Organic sales", get: organicSales, fmt: (v) => eur.format(v) },
  { key: "acctSales", good: "up", ratio: true, label: "Share of account sales", get: (r) => (r.acctSales ? (r.sales / r.acctSales) * 100 : null), fmt: pct2f },
  { key: "acctSp", good: "none", ratio: true, label: "Share of account SP spend", get: (r) => (r.acctSp ? (r.spSpend / r.acctSp) * 100 : null), fmt: pct2f },
  { key: "price", good: "up", label: "Avg. item price", sub: "sales ÷ units", get: avgPrice, fmt: (v) => eur2.format(v) },
  { key: "impressions", good: "up", label: "Impressions", get: (r) => r.impressions, fmt: (v) => int.format(v) },
  { key: "ctr", good: "up", ratio: true, label: "CTR", get: (r) => (r.impressions ? (r.clicks / r.impressions) * 100 : null), fmt: pct2f },
  { key: "adOrders", good: "up", label: "Ad orders", get: (r) => r.adOrders, fmt: (v) => int.format(v) },
  { key: "bsrMain", good: "down", label: "BSR main category", get: (r) => r.bsrMain, fmt: (v) => `#${int.format(v)}` },
];

// the home page's list adds these and words a few differently (Ad clicks, CPC, Ad conversion rate)
const EXTRA: Metric<XRow>[] = [
  { key: "roas", good: "up", label: "ROAS", get: (r) => div(r.adSales, r.adSpend), fmt: (v) => pct2.format(v) },
  { key: "cpo", good: "down", label: "Cost per ad order", get: (r) => div(r.adSpend, r.adOrders), fmt: (v) => eur2.format(v) },
  { key: "orders", good: "up", label: "Orders", get: (r) => r.orders, fmt: (v) => int.format(v) },
  { key: "organicOrders", good: "up", ratio: true, label: "Organic % (orders)", get: (r) => (r.orders ? (Math.max(0, r.orders - r.adOrders) / r.orders) * 100 : null), fmt: pct },
];
const BY_KEY = new Map([...PRODUCT_METRICS, ...EXTRA].map((m) => [m.key, m]));
const RENAME: Record<string, string> = { clicks: "Ad clicks", cpc: "CPC", cvr: "Ad conversion rate" };
const HOME_KEYS = ["sales", "adSpend", "acos", "tacos", "units", "sessions", "usp", "organic", "organicSales", "acctSales", "acctSp", "price", "adSales", "impressions", "clicks", "ctr", "cpc", "adOrders", "cvr", "roas", "cpo", "orders", "organicOrders"];

/** The Weekly Dash's product metrics, in the reference home page's order. */
export const HOME_PRODUCT_METRICS: Metric<XRow>[] = HOME_KEYS.map((k) => {
  const m = BY_KEY.get(k)!;
  return RENAME[k] ? { ...m, label: RENAME[k] } : m;
});

/** Scope-level metrics: totals plus the ad-spend split. */
export const SCOPE_METRICS: (Metric<OverallRow> & { level?: 1; strong?: boolean; key2?: boolean })[] = [
  { key: "sales", good: "up", label: "Total sales", strong: true, key2: true, get: (r) => r.sales, fmt: (v) => eur.format(v) },
  { key: "units", good: "up", label: "Units", key2: true, get: (r) => r.units, fmt: (v) => int.format(v) },
  { key: "orders", good: "up", label: "Orders", get: (r) => r.orders, fmt: (v) => int.format(v) },
  { key: "sessions", good: "up", label: "Sessions", key2: true, get: (r) => r.sessions, fmt: (v) => int.format(v) },
  { key: "usp", good: "up", ratio: true, label: "Unit session %", key2: true, get: (r) => (r.sessions ? (r.units / r.sessions) * 100 : null), fmt: pct2f },
  { key: "price", good: "up", label: "Avg selling price", get: avgPrice, fmt: (v) => eur2.format(v) },
  { key: "adSpend", good: "none", label: "Ad spend, total", strong: true, key2: true, get: (r) => r.adSpend, fmt: (v) => eur2.format(v) },
  { key: "own", good: "none", label: "own campaigns", level: 1, get: (r) => r.ownSpend, fmt: (v) => eur2.format(v) },
  { key: "shared", good: "none", label: "shared / catch-all campaigns", level: 1, get: (r) => r.sharedSpend, fmt: (v) => eur2.format(v) },
  { key: "sb", good: "none", label: "Sponsored Brands (not in total)", get: (r) => r.sbSpend, fmt: (v) => eur2.format(v) },
  { key: "adSales", good: "up", label: "Ad sales", get: (r) => r.adSales, fmt: (v) => eur.format(v) },
  { key: "acos", good: "down", ratio: true, label: "ACOS", key2: true, get: acos, fmt: pct },
  { key: "tacos", good: "down", ratio: true, label: "TACoS", key2: true, get: tacos, fmt: pct },
  { key: "organicSales", good: "up", label: "Organic sales", get: organicSales, fmt: (v) => eur.format(v) },
  { key: "organic", good: "up", ratio: true, label: "Organic share", key2: true, get: organicShare, fmt: pct },
];

export const fmtCell = <R,>(m: Metric<R>, r: R) => {
  const v = m.get(r);
  return v === null || Number.isNaN(v) ? "—" : m.fmt(v);
};
