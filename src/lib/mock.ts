// Invented sample data. Replace `weekly` / `monthly` with the real source; the shapes below are what the UI reads.
export type Period = { key: string; kw: string; label: string };
export type Row = { sales: number; units: number; adSpend: number; adSales: number };
export type Category = { name: string; rows: Row[] }; // rows[i] belongs to periods[i]; index 0 = current period
export type Dataset = { periods: Period[]; categories: Category[] };

const CATS: [string, number][] = [
  ["Treadmills", 0.55],
  ["Exercise bikes", 0.12],
  ["Vibration plates", 0.08],
  ["Cross trainers", 0.06],
  ["Rowing machines", 0.05],
  ["Strength stations", 0.04],
  ["Benches & weights", 0.04],
  ["Small equipment", 0.03],
  ["Hoverboards & scooters", 0.02],
  ["Trampolines", 0.01],
];

export function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function build(periods: Period[], total: number, seed: number): Dataset {
  const rnd = rng(seed);
  const categories = CATS.map(([name, share]) => ({
    name,
    rows: periods.map((_, i) => {
      const trend = 1 - i * 0.015; // older periods are a touch lower on average
      const sales = total * share * trend * (0.82 + rnd() * 0.36);
      const adSpend = sales * (0.06 + rnd() * 0.1);
      const adSales = adSpend / (0.14 + rnd() * 0.2);
      const units = Math.max(1, Math.round(sales / (190 + rnd() * 260)));
      return {
        sales: Math.round(sales),
        units,
        adSpend: Math.round(adSpend),
        adSales: Math.round(adSales),
      };
    }),
  }));
  return { periods, categories };
}

export const weekly = build(
  [
    { key: "w1", kw: "KW 43", label: "19–25 Oct" },
    { key: "w2", kw: "KW 42", label: "12–18 Oct" },
    { key: "w3", kw: "KW 41", label: "5–11 Oct" },
    { key: "w4", kw: "KW 40", label: "28 Sep–4 Oct" },
    { key: "w5", kw: "KW 39", label: "21–27 Sep" },
  ],
  410_000,
  7,
);

export const monthly = build(
  [
    { key: "m1", kw: "Oct", label: "1–30 Oct" },
    { key: "m2", kw: "Sep", label: "Sep 2026" },
    { key: "m3", kw: "Aug", label: "Aug 2026" },
    { key: "m4", kw: "Jul", label: "Jul 2026" },
    { key: "m5", kw: "Jun", label: "Jun 2026" },
  ],
  1_780_000,
  11,
);

/* ---------- Overview (whole account, one row per day / week / month) ---------- */
export type OvRow = {
  label: string;
  sub?: string;
  orders: number;
  units: number;
  sales: number;
  profit: number;
  ads: number;
  acos: number;
  tacos: number;
  organicOrders: number;
  ppcSales: number;
  ppcOrders: number;
  sessions: number | null; // null = not available yet
  conversion: number | null;
  avgPrice: number;
  // category pages only
  margin?: number;
  refunds?: number;
  refundRate?: number;
  payout?: number;
};

function ovRow(rnd: () => number, label: string, sub: string | undefined, scale: number, pending: boolean): OvRow {
  const sales = scale * (0.8 + rnd() * 0.4);
  const units = Math.max(1, Math.round(sales / (232 + rnd() * 40)));
  const orders = Math.max(1, units - Math.round(units * rnd() * 0.03));
  const ads = sales * (0.08 + rnd() * 0.08);
  const ppcSales = ads / (0.17 + rnd() * 0.1);
  const avgPrice = sales / units;
  const ppcOrders = Math.min(orders, Math.round(ppcSales / avgPrice));
  const sessions = pending ? null : Math.round(units / (0.012 + rnd() * 0.012));
  return {
    label,
    sub: pending ? "sessions pending" : sub,
    orders,
    units,
    sales: Math.round(sales),
    profit: Math.round(sales * (rnd() * 0.17 - 0.03)),
    ads: Math.round(ads),
    acos: (ads / ppcSales) * 100,
    tacos: (ads / sales) * 100,
    organicOrders: orders - ppcOrders,
    ppcSales: Math.round(ppcSales),
    ppcOrders,
    sessions,
    conversion: sessions ? (units / sessions) * 100 : null,
    avgPrice,
  };
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const overview: Record<"daily" | "weekly" | "monthly", OvRow[]> = (() => {
  const rnd = rng(23);
  const daily: OvRow[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.UTC(2026, 9, 30 - i));
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? 1.12 : 1;
    daily.push(ovRow(rnd, `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`, undefined, 52_000 * weekend, i < 2));
  }
  return {
    daily,
    weekly: weekly.periods.map((p, i) => ovRow(rnd, p.kw, p.label, 365_000 * (1 - i * 0.01), false)),
    monthly: monthly.periods.map((p, i) => ovRow(rnd, p.kw, p.label, 1_560_000 * (1 - i * 0.01), false)),
  };
})();

/* ---------- Products (parent ASINs with child variants) ---------- */
export type Variant = { sku: string; label: string; weekly: Row[]; monthly: Row[] };
export type Product = { asin: string; name: string; category: string; weekly: Row[]; monthly: Row[]; variants: Variant[] };

const MODELS: Record<string, string[]> = {
  Treadmills: ["sWalk Plus", "sTread Lite", "F10 Fold", "Walkmate", "sProRun"],
  "Exercise bikes": ["SXM200", "ESX500", "RBK200"],
  "Vibration plates": ["VP200", "VP400", "VP600"],
  "Cross trainers": ["CX608", "CX2"],
  "Rowing machines": ["WRX1000", "RSX500"],
  "Strength stations": ["HGX50", "HGX60"],
  "Benches & weights": ["BRT500", "FlexBench"],
  "Small equipment": ["Yoga mat", "Resistance bands"],
  "Hoverboards & scooters": ["HY310"],
  Trampolines: ["Tramp 140"],
};
const COLOURS = ["Black", "Silver", "Blue", "Red"];

function scaleRows(rows: Row[], f: number, rnd?: () => number): Row[] {
  // with `rnd`, ad figures drift per row so ACOS/TACoS differ between products
  const j = () => (rnd ? 0.65 + rnd() * 0.7 : 1);
  return rows.map((r) => ({
    sales: Math.round(r.sales * f),
    units: Math.max(0, Math.round(r.units * f)),
    adSpend: Math.round(r.adSpend * f * j()),
    adSales: Math.round(r.adSales * f * j()),
  }));
}

export const products: Product[] = (() => {
  const rnd = rng(41);
  const out: Product[] = [];
  for (const [category, share] of CATS) {
    const names = MODELS[category];
    const catW = weekly.categories.find((c) => c.name === category)!.rows;
    const catM = monthly.categories.find((c) => c.name === category)!.rows;
    const weights = names.map(() => 0.4 + rnd());
    const total = weights.reduce((a, b) => a + b, 0);
    names.forEach((name, i) => {
      const f = weights[i] / total;
      const wk = scaleRows(catW, f * (0.9 + rnd() * 0.2), rnd);
      const mo = scaleRows(catM, f * (0.9 + rnd() * 0.2), rnd);
      const count = share > 0.05 ? 3 : 2;
      const parts = Array.from({ length: count }, () => 0.5 + rnd());
      const ptotal = parts.reduce((a, b) => a + b, 0);
      out.push({
        asin: "B0" + Math.floor(rnd() * 1e8).toString(36).toUpperCase().padStart(8, "0").slice(0, 8),
        name,
        category,
        weekly: wk,
        monthly: mo,
        variants: parts.map((w, v) => ({
          sku: `${name.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()}-${COLOURS[v][0]}${v + 1}`,
          label: COLOURS[v],
          weekly: scaleRows(wk, w / ptotal, rnd),
          monthly: scaleRows(mo, w / ptotal, rnd),
        })),
      });
    });
  }
  return out;
})();

export const meta = {
  marketplace: "Amazon.de",
  currency: "EUR",
  dataThrough: "30 Oct 2026",
  lastRefresh: "31 Oct 2026",
  sessionsThrough: "28 Oct",
};

/* ---------- Comparisons: same-period-last-year totals and deal weeks ---------- */
// Index-aligned with weekly.periods / monthly.periods. Only the Prime Day sheet records approved deals.
export const dealPeriods: Record<"weekly" | "monthly", boolean[]> = {
  weekly: weekly.periods.map((p) => p.kw === "KW 41"),
  monthly: monthly.periods.map(() => false),
};

export const lastYear: Record<"weekly" | "monthly", Row[]> = (() => {
  const rnd = rng(59);
  const ly = (d: Dataset) =>
    d.periods.map((_, i) => {
      const r = d.categories.reduce(
        (a, c) => ({ sales: a.sales + c.rows[i].sales, units: a.units + c.rows[i].units, adSpend: a.adSpend + c.rows[i].adSpend, adSales: a.adSales + c.rows[i].adSales }),
        { sales: 0, units: 0, adSpend: 0, adSales: 0 },
      );
      const f = 0.72 + rnd() * 0.22;
      return { sales: Math.round(r.sales * f), units: Math.round(r.units * f * 1.08), adSpend: Math.round(r.adSpend * f * 0.9), adSales: Math.round(r.adSales * f * 0.95) };
    });
  return { weekly: ly(weekly), monthly: ly(monthly) };
})();

/* ---------- Wins & TACoS: campaigns and keywords per period ---------- */
export type AdLine = { name: string; sub: string; adSpend: number[]; adSales: number[] }; // index-aligned with periods

const MATCH = ["Exact", "Phrase", "Broad"];
const TERMS = ["laufband", "walking pad", "heimtrainer", "vibrationsplatte", "crosstrainer", "rudergerät", "kraftstation", "hantelbank", "yogamatte", "hoverboard", "trampolin", "laufband klappbar"];

function adLines(kind: "campaign" | "keyword", count: number, seed: number, n: number): AdLine[] {
  const rnd = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const p = products[Math.floor(rnd() * products.length)];
    const base = 60 + rnd() * 900;
    const eff = 0.06 + rnd() * 0.3; // spend / ad sales
    const name = kind === "campaign" ? `SP | ${p.name} | ${MATCH[i % 3]}` : `${TERMS[i % TERMS.length]}${i >= TERMS.length ? " " + p.name.toLowerCase() : ""}`;
    const adSpend = Array.from({ length: n }, () => Math.round(base * (0.7 + rnd() * 0.6) * 100) / 100);
    const adSales = adSpend.map((s) => (rnd() < 0.06 ? 0 : Math.round((s / (eff * (0.75 + rnd() * 0.5))) * 100) / 100));
    return { name, sub: kind === "campaign" ? p.category : `${MATCH[i % 3].toLowerCase()} · ${p.name}`, adSpend, adSales };
  });
}

export const campaigns = { weekly: adLines("campaign", 18, 71, 5), monthly: adLines("campaign", 18, 73, 5) };
export const keywords = { weekly: adLines("keyword", 22, 79, 5), monthly: adLines("keyword", 22, 83, 5) };

/* ---------- Price & BSR (Agent Central snapshots) ---------- */
export type Listing = { asin: string; name: string; category: string; bsrSub: number; bsrSubPrev: number; subCat: string; bsrMain: number; bsrMainPrev: number; price: number; pricePrev: number; fromReport: boolean };

const SUBCATS: Record<string, string> = {
  Treadmills: "Laufbänder",
  "Exercise bikes": "Heimtrainer",
  "Vibration plates": "Vibrationsplatten",
  "Cross trainers": "Crosstrainer",
  "Rowing machines": "Rudergeräte",
  "Strength stations": "Kraftstationen",
  "Benches & weights": "Hantelbänke",
  "Small equipment": "Fitnesszubehör",
  "Hoverboards & scooters": "Hoverboards",
  Trampolines: "Trampoline",
};

export const listings: Listing[] = (() => {
  const rnd = rng(97);
  return products.map((p) => {
    const bsrSub = Math.max(1, Math.round(1 + rnd() * rnd() * 140));
    const bsrMain = Math.round(bsrSub * (18 + rnd() * 60) + rnd() * 400);
    const price = Math.round((p.weekly[0].sales / Math.max(1, p.weekly[0].units)) * (0.95 + rnd() * 0.1)) - 0.01;
    return {
      asin: p.asin,
      name: p.name,
      category: p.category,
      subCat: SUBCATS[p.category],
      bsrSub,
      bsrSubPrev: Math.max(1, Math.round(bsrSub * (0.7 + rnd() * 0.6))),
      bsrMain,
      bsrMainPrev: Math.max(1, Math.round(bsrMain * (0.75 + rnd() * 0.5))),
      price,
      pricePrev: rnd() < 0.6 ? price : Math.round(price * (0.9 + rnd() * 0.2)) - 0.01,
      fromReport: rnd() < 0.15,
    };
  });
})();

export const snapshots = { bsr: "30 Oct", bsrPrev: "23 Oct", price: "28 Oct", pricePrev: "21 Oct", report: "29 Oct" };

/* ---------- Ad spend with no ad sales (child ASINs, campaigns, keywords per period) ---------- */
export type NoSale = { name: string; sub: string; adSpend: number; clicks: number; impressions: number; sales: number | null };

export const noAdSales: Record<"weekly" | "monthly", { products: NoSale[]; campaigns: NoSale[]; keywords: NoSale[] }[]> = (() => {
  const rnd = rng(113);
  const make = (mode: "weekly" | "monthly", scale: number) =>
    Array.from({ length: 5 }, (_, i) => {
      const pick = (n: number) => Array.from({ length: n }, () => products[Math.floor(rnd() * products.length)]);
      const spend = () => Math.round((4 + rnd() * rnd() * 160) * scale * 100) / 100;
      const clicks = (s: number) => Math.max(1, Math.round(s / (0.6 + rnd() * 0.9)));
      const prods = pick(4 + Math.floor(rnd() * 5)).map((p) => {
        const v = p.variants[Math.floor(rnd() * p.variants.length)];
        const s = spend();
        const c = clicks(s);
        return { name: `${p.name} ${v.label}`, sub: v.sku, adSpend: s, clicks: c, impressions: Math.round(c * (60 + rnd() * 400)), sales: rnd() < 0.15 ? null : Math.round(v[mode][i].sales * (0.2 + rnd() * 0.4)) };
      });
      const camps = pick(2 + Math.floor(rnd() * 3)).map((p, j) => {
        const s = spend();
        const c = clicks(s);
        return { name: `SP | ${p.name} | ${MATCH[j % 3]}`, sub: p.category, adSpend: s, clicks: c, impressions: Math.round(c * (80 + rnd() * 500)), sales: null };
      });
      const kws = pick(3 + Math.floor(rnd() * 4)).map((p, j) => {
        const s = spend();
        const c = clicks(s);
        return { name: `${TERMS[(i * 3 + j) % TERMS.length]} ${p.name.toLowerCase()}`, sub: MATCH[j % 3].toLowerCase(), adSpend: s, clicks: c, impressions: Math.round(c * (80 + rnd() * 500)), sales: null };
      });
      return { products: prods.sort((a, b) => b.adSpend - a.adSpend), campaigns: camps.sort((a, b) => b.adSpend - a.adSpend), keywords: kws.sort((a, b) => b.adSpend - a.adSpend) };
    });
  return { weekly: make("weekly", 1), monthly: make("monthly", 3.4) };
})();

/* ---------- Sponsored Brands / Display spend tool4seller does not tie to a product ---------- */
export type Sbsd = { spend: number; adSales: number };
export const sbsd: Record<"weekly" | "monthly", Sbsd[]> = (() => {
  const rnd = rng(131);
  const make = (d: Dataset) =>
    d.periods.map((_, i) => {
      const spend = d.categories.reduce((a, c) => a + c.rows[i].adSpend, 0) * (0.02 + rnd() * 0.03);
      return { spend: Math.round(spend * 100) / 100, adSales: Math.round(spend * (2 + rnd() * 3) * 100) / 100 };
    });
  return { weekly: make(weekly), monthly: make(monthly) };
})();
