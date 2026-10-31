// Category pages: one data shape for every category, derived from the mock products until Supabase serves it.
import { dealPeriods, lastYear, listings, monthly, overview, products, rng, weekly, type Listing, type OvRow, type Period, type Product, type Row } from "./mock";

export type Mode = "weekly" | "monthly";

type CatDef = { slug: string; name: string; title: string; plural: string; families: { name: string; models: string[] }[] };

// slug -> mock category name, page title and product families (the family filter narrows every section)
export const CATEGORY_DEFS: CatDef[] = [
  { slug: "treadmills", name: "Treadmills", title: "Treadmills", plural: "treadmills", families: [{ name: "Walking pads", models: ["sWalk Plus", "Walkmate"] }, { name: "Foldable treadmills", models: ["sTread Lite", "F10 Fold"] }, { name: "Performance treadmills", models: ["sProRun"] }] },
  { slug: "exercise-bikes", name: "Exercise bikes", title: "Exercise Bikes", plural: "exercise bikes", families: [{ name: "Upright bikes", models: ["SXM200", "ESX500"] }, { name: "Recumbent bikes", models: ["RBK200"] }] },
  { slug: "vibration-plates", name: "Vibration plates", title: "Vibration Plates", plural: "vibration plates", families: [{ name: "Compact plates", models: ["VP200", "VP400"] }, { name: "Pro plates", models: ["VP600"] }] },
  { slug: "cross-trainers", name: "Cross trainers", title: "Cross Trainers", plural: "cross trainers", families: [{ name: "Elliptical", models: ["CX608"] }, { name: "Compact", models: ["CX2"] }] },
  { slug: "rowing-machines", name: "Rowing machines", title: "Rowing Machines", plural: "rowing machines", families: [{ name: "Water rowers", models: ["WRX1000"] }, { name: "Magnetic rowers", models: ["RSX500"] }] },
  { slug: "strength-training", name: "Strength stations", title: "Strength Training", plural: "strength stations", families: [{ name: "Home gyms", models: ["HGX50", "HGX60"] }] },
  { slug: "benches-weights", name: "Benches & weights", title: "Benches & Weights", plural: "benches & weights", families: [{ name: "Benches", models: ["BRT500", "FlexBench"] }] },
  { slug: "small-equipment", name: "Small equipment", title: "Small Equipment", plural: "small equipment", families: [{ name: "Mats", models: ["Yoga mat"] }, { name: "Bands", models: ["Resistance bands"] }] },
  { slug: "hoverboards-scooters", name: "Hoverboards & scooters", title: "Hoverboards & Scooters", plural: "hoverboards", families: [{ name: "Hoverboards", models: ["HY310"] }] },
  { slug: "trampolines", name: "Trampolines", title: "Trampolines", plural: "trampolines", families: [{ name: "Fitness trampolines", models: ["Tramp 140"] }] },
];

export type Family = { name: string; products: Product[] };
export type AdType = { name: "Sponsored Products" | "Sponsored Display" | "Sponsored Brands"; short: string; spend: number[]; sales: number[]; orders: number[]; clicks: number[]; impressions: number[]; perAsin: boolean };
export type OverallRow = Row & { orders: number; sessions: number; ownSpend: number; sharedSpend: number; sbSpend: number };
export type ToDate = { label: string; sub: string; lySub: string; cur: Row; ly: Row };

export type CategoryData = {
  def: CatDef;
  products: Product[];
  pick: (scope: string) => Product[];
  families: Family[];
  periods: Record<Mode, Period[]>;
  // per family name ("" = all) and mode, index-aligned with periods
  totals: (family: string, mode: Mode) => OverallRow[];
  lastYear: (family: string, mode: Mode) => Row[];
  deals: Record<Mode, boolean[]>;
  toDate: (family: string) => ToDate[];
  overview: (family: string) => Record<"daily" | "weekly" | "monthly", OvRow[]>;
  adTypes: (family: string, mode: Mode) => AdType[];
  listings: (family: string) => Listing[];
  aov: (family: string) => { active: number; inactive: number; cut: number; high: number; low: number };
};

const sumRow = (rows: Row[]): Row => rows.reduce((a, r) => ({ sales: a.sales + r.sales, units: a.units + r.units, adSpend: a.adSpend + r.adSpend, adSales: a.adSales + r.adSales }), { sales: 0, units: 0, adSpend: 0, adSales: 0 });
const scale = (r: Row, f: number): Row => ({ sales: Math.round(r.sales * f), units: Math.round(r.units * f), adSpend: Math.round(r.adSpend * f * 100) / 100, adSales: Math.round(r.adSales * f * 100) / 100 });

export function getCategory(slug: string): CategoryData | null {
  const def = CATEGORY_DEFS.find((c) => c.slug === slug);
  if (!def) return null;
  const all = products.filter((p) => p.category === def.name);
  const families: Family[] = def.families.map((f) => ({ name: f.name, products: all.filter((p) => f.models.includes(p.name)) }));
  const seed = def.slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  // scope: "" = whole category, a family name, or "asin:<ASIN>" for one product
  const pick = (family: string) => (family.startsWith("asin:") ? all.filter((p) => p.asin === family.slice(5)) : family ? families.find((f) => f.name === family)?.products ?? [] : all);

  // stable per-category ratios so every view of the same scope agrees
  const r = rng(seed);
  const sessionsPerUnit = 18 + r() * 14;
  const ordersPerUnit = 0.96 + r() * 0.03;
  const sharedShare = 0.18 + r() * 0.2;
  const sbShare = 0.05 + r() * 0.07;

  const totals = (family: string, mode: Mode): OverallRow[] =>
    weekly.periods.map((_, i) => {
      const row = sumRow(pick(family).map((p) => p[mode][i]));
      const shared = row.adSpend * sharedShare;
      return { ...row, orders: Math.round(row.units * ordersPerUnit), sessions: Math.round(row.units * sessionsPerUnit * (0.9 + ((i * 7 + seed) % 10) / 50)), ownSpend: row.adSpend - shared, sharedSpend: shared, sbSpend: row.adSpend * sbShare };
    });

  const share = (family: string, mode: Mode) => {
    const acc = sumRow(products.map((p) => p[mode][0]));
    return acc.sales ? sumRow(pick(family).map((p) => p[mode][0])).sales / acc.sales : 0;
  };

  const lyFor = (family: string, mode: Mode): Row[] => {
    const acc = lastYear[mode];
    const f = share(family, mode);
    return acc.map((x) => scale(x, f));
  };

  const toDate = (family: string): ToDate[] => {
    const wk = totals(family, "weekly")[0];
    const mo = totals(family, "monthly")[0];
    const lyw = lyFor(family, "weekly")[0];
    const lym = lyFor(family, "monthly")[0];
    return [
      { label: "Today", sub: "Fri, 30 Oct 2026", lySub: "Fri, 31 Oct 2025", cur: scale(wk, 1 / 7), ly: scale(lyw, 1 / 7.6) },
      { label: "This week", sub: "26 Oct – Fri, 30 Oct 2026", lySub: "27 Oct – Fri, 31 Oct 2025", cur: scale(wk, 5 / 7), ly: scale(lyw, 5 / 7.3) },
      { label: "This month", sub: "1 Oct – Fri, 30 Oct 2026", lySub: "1 Oct – Thu, 30 Oct 2025", cur: mo, ly: lym },
    ];
  };

  const overviewFor = (family: string): Record<"daily" | "weekly" | "monthly", OvRow[]> => {
    const conv = (rows: OvRow[], f: number): OvRow[] =>
      rows.map((o, i) => {
        const sales = Math.round(o.sales * f);
        const ads = Math.round(o.ads * f * 100) / 100;
        const refunds = Math.round(sales * (0.015 + ((i * 13 + seed) % 9) / 300));
        const profit = Math.round(o.profit * f);
        return {
          ...o,
          orders: Math.max(0, Math.round(o.orders * f)),
          units: Math.max(0, Math.round(o.units * f)),
          sales,
          profit,
          ads,
          organicOrders: Math.max(0, Math.round(o.organicOrders * f)),
          ppcSales: Math.round(o.ppcSales * f),
          ppcOrders: Math.max(0, Math.round(o.ppcOrders * f)),
          sessions: o.sessions === null ? null : Math.round(o.sessions * f),
          margin: sales ? (profit / sales) * 100 : 0,
          refunds,
          refundRate: sales ? (refunds / sales) * 100 : 0,
          payout: Math.round(sales * 0.78 - ads - refunds),
        };
      });
    return { daily: conv(overview.daily, share(family, "weekly")), weekly: conv(overview.weekly, share(family, "weekly")), monthly: conv(overview.monthly, share(family, "monthly")) };
  };

  const adTypes = (family: string, mode: Mode): AdType[] => {
    const t = totals(family, mode);
    const rr = rng(seed + (mode === "weekly" ? 1 : 2) + family.length);
    const mk = (name: AdType["name"], short: string, part: number, roas: number, perAsin: boolean): AdType => {
      const spend = t.map((x) => Math.round(x.adSpend * part * (0.9 + rr() * 0.2) * 100) / 100);
      const sales = spend.map((s) => Math.round(s * roas * (0.85 + rr() * 0.3) * 100) / 100);
      const clicks = spend.map((s) => Math.round(s / (0.7 + rr() * 0.5)));
      return { name, short, spend, sales, orders: sales.map((s) => Math.round(s / (260 + rr() * 90))), clicks, impressions: clicks.map((c) => Math.round(c * (90 + rr() * 160))), perAsin };
    };
    return [mk("Sponsored Products", "SP", 0.84 - sbShare, 4.4, true), mk("Sponsored Display", "SD", 0.16, 3.1, true), mk("Sponsored Brands", "SB", sbShare, 5.2, false)];
  };

  const listingsFor = (family: string) => {
    const names = new Set(pick(family).map((p) => p.asin));
    return listings.filter((l) => names.has(l.asin));
  };

  const aov = (family: string) => {
    const ps = pick(family);
    const prices = ps.map((p) => p.weekly[0].sales / Math.max(1, p.weekly[0].units)).sort((a, b) => a - b);
    const cut = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    return { active: ps.length, inactive: ps.length > 2 ? 1 : 0, cut: Math.round(cut), high: prices.filter((p) => p >= cut).length, low: prices.filter((p) => p < cut).length };
  };

  return {
    def,
    products: all,
    pick,
    families,
    periods: { weekly: weekly.periods, monthly: monthly.periods },
    totals,
    lastYear: lyFor,
    deals: dealPeriods,
    toDate,
    overview: overviewFor,
    adTypes,
    listings: listingsFor,
    aov,
  };
}
