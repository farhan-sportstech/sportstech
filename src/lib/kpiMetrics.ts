// Every KPI the page can show: group, formula, format, and which direction is good.
import { KPI_CATS, type KpiRow } from "./kpi";
import { eur, eur2, int, pct1, pct2 } from "./format";

export type KpiMetric = {
  key: string;
  label: string;
  group: string;
  get: (r: KpiRow) => number | null;
  fmt: (v: number) => string;
  // count-up kind for the tiles; metrics without one are shown as plain text
  kind?: "eur" | "int" | "pct";
  ratio?: boolean; // change shown in points, not percent
  goodWhen: "up" | "down" | "none";
  key_?: boolean; // part of the "Key metrics" view
};

const r = (a: number, b: number) => (b ? (a / b) * 100 : null);
const e = (v: number) => eur.format(v);
const e2 = (v: number) => eur2.format(v);
const n = (v: number) => int.format(v);
const p1 = (v: number) => `${pct1.format(v)}%`;
const p2 = (v: number) => `${pct2.format(v)}%`;
const spend = (label: string, group: string, get: (x: KpiRow) => number, key: string): KpiMetric => ({ key, label, group, get, fmt: e, kind: "eur", goodWhen: "none" });

export const KPI_METRICS: KpiMetric[] = [
  { key: "sales", label: "Total sales", group: "Sales", get: (x) => x.sales, fmt: e, kind: "eur", goodWhen: "up", key_: true },
  { key: "orders", label: "Orders", group: "Sales", get: (x) => x.orders, fmt: n, kind: "int", goodWhen: "up", key_: true },
  { key: "units", label: "Units", group: "Sales", get: (x) => x.units, fmt: n, kind: "int", goodWhen: "up" },
  { key: "aov", label: "Avg. order value", group: "Sales", get: (x) => (x.orders ? x.sales / x.orders : null), fmt: e2, goodWhen: "none" },
  { key: "ppc", label: "PPC sales", group: "Sales", get: (x) => x.adSales, fmt: e, kind: "eur", goodWhen: "up" },
  { key: "organic", label: "Organic sales", group: "Sales", get: (x) => Math.max(0, x.sales - x.adSales), fmt: e, kind: "eur", goodWhen: "up" },
  { key: "orgShare", label: "Organic share", group: "Sales", get: (x) => r(Math.max(0, x.sales - x.adSales), x.sales), fmt: p1, kind: "pct", ratio: true, goodWhen: "up", key_: true },

  { key: "sessions", label: "Sessions", group: "Traffic", get: (x) => x.sessions, fmt: n, kind: "int", goodWhen: "up", key_: true },
  { key: "pageViews", label: "Page views", group: "Traffic", get: (x) => x.pageViews, fmt: n, kind: "int", goodWhen: "up" },
  { key: "usp", label: "Unit session %", group: "Traffic", get: (x) => r(x.units, x.sessions), fmt: p2, kind: "pct", ratio: true, goodWhen: "up", key_: true },

  { key: "adSpend", label: "Ad spend", group: "Advertising", get: (x) => x.adSpend, fmt: e, kind: "eur", goodWhen: "none", key_: true },
  { key: "acos", label: "ACOS", group: "Advertising", get: (x) => r(x.adSpend, x.adSales), fmt: p1, kind: "pct", ratio: true, goodWhen: "down", key_: true },
  { key: "tacos", label: "TACoS", group: "Advertising", get: (x) => r(x.adSpend, x.sales), fmt: p1, kind: "pct", ratio: true, goodWhen: "down", key_: true },
  { key: "roas", label: "ROAS", group: "Advertising", get: (x) => (x.adSpend ? x.adSales / x.adSpend : null), fmt: (v) => `${pct2.format(v)}x`, goodWhen: "up" },
  { key: "impr", label: "Impressions", group: "Advertising", get: (x) => x.impressions, fmt: n, kind: "int", goodWhen: "up" },
  { key: "clicks", label: "Clicks", group: "Advertising", get: (x) => x.clicks, fmt: n, kind: "int", goodWhen: "up" },
  { key: "ctr", label: "CTR", group: "Advertising", get: (x) => r(x.clicks, x.impressions), fmt: p2, ratio: true, goodWhen: "up" },
  { key: "cpc", label: "Avg. CPC", group: "Advertising", get: (x) => (x.clicks ? x.adSpend / x.clicks : null), fmt: e2, goodWhen: "down" },
  { key: "adcvr", label: "Ad CVR", group: "Advertising", get: (x) => r(x.adOrders, x.clicks), fmt: p2, ratio: true, goodWhen: "up" },

  { key: "fees", label: "Amazon fees", group: "Costs", get: (x) => x.fees, fmt: e, kind: "eur", goodWhen: "none" },
  { key: "refunds", label: "Refunds", group: "Costs", get: (x) => x.refunds, fmt: e, kind: "eur", goodWhen: "down" },
  { key: "refundRate", label: "Refund rate", group: "Costs", get: (x) => r(x.refunds, x.sales), fmt: p1, ratio: true, goodWhen: "down" },
  { key: "contrib", label: "Contribution", group: "Costs", get: (x) => x.sales - x.fees - x.refunds - x.adSpend, fmt: e, kind: "eur", goodWhen: "up", key_: true },

  spend("Sponsored Products", "Ad split by type", (x) => x.sp, "sp"),
  spend("Sponsored Brands", "Ad split by type", (x) => x.sb, "sb"),
  spend("Sponsored Display", "Ad split by type", (x) => x.sd, "sd"),
  spend("Top of Search", "SP placements", (x) => x.tos, "tos"),
  spend("Product pages", "SP placements", (x) => x.pp, "pp"),
  spend("Rest of Search", "SP placements", (x) => x.ros, "ros"),
  spend("Branded", "Branded vs non-branded", (x) => x.branded, "branded"),
  spend("Non-branded", "Branded vs non-branded", (x) => x.nonBranded, "nonBranded"),
  spend("Defense", "Defense vs offense", (x) => x.defense, "defense"),
  spend("Offense", "Defense vs offense", (x) => x.offense, "offense"),
  spend("Exact", "Match type", (x) => x.exact, "exact"),
  spend("Phrase", "Match type", (x) => x.phrase, "phrase"),
  spend("Broad", "Match type", (x) => x.broad, "broad"),
  spend("Auto", "Match type", (x) => x.auto, "auto"),
  spend("Product targeting", "Match type", (x) => x.pat, "pat"),
  ...KPI_CATS.map((c): KpiMetric => ({ key: `cat:${c}`, label: c, group: "Categories", get: (x) => x.cats[c] ?? 0, fmt: e, kind: "eur", goodWhen: "up" })),
];

export const KPI_GROUPS = Array.from(new Set(KPI_METRICS.map((m) => m.group)));
export const TILE_DEFAULT = ["sales", "orders", "sessions", "usp", "adSpend", "acos", "tacos", "contrib"];
export const metricBy = (key: string) => KPI_METRICS.find((m) => m.key === key)!;
