// Keyword gaps per product: the keyword universe (Helium 10 Cerebro + SQP) against what the product's own campaigns target.
// Market figures are invented until Supabase serves them (keyword_gaps, keyword_gap_asin, cerebro_keyword);
// the targeting side comes from the shared ad data, so it agrees with Keywords & targets.
import type { CategoryData } from "./category";
import { TERMS, categoryAds, total, type MatchType } from "./ads";
import { rng } from "./mock";

export const GAPS = ["Not targeted", "No Exact", "Converting, no own Exact", "Weak organic, no ads", "Spend, no sales"] as const;
export type Gap = (typeof GAPS)[number];
export type GapRow = {
  q: string;
  sv: number; // Cerebro monthly search volume
  trend: number; // search volume trend, %
  org: number | null; // organic rank (null = not ranked)
  spr: number | null; // sponsored rank
  ks: number; // Cerebro keyword sales, monthly estimate
  cpr: number; // giveaways over 8 days to reach page 1
  comp: number; // competing products
  sqp: number | null; // SQP searches, latest week
  match: MatchType[]; // how the product targets it today
  spend: number;
  orders: number;
  gaps: Gap[];
};

const LONG = [" für zuhause", " klappbar", " test", " kaufen", " günstig", " mit display", " leise", " bis 150 kg", " kompakt", " app"];
const cache = new Map<string, GapRow[]>();

export function productGaps(data: CategoryData, asin: string): GapRow[] {
  const hit = cache.get(asin);
  if (hit) return hit;
  const r = rng(asin.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483646 || 1);
  const own = categoryAds(data, "weekly").filter((x) => x.asin === asin);
  const terms = TERMS[data.def.slug] ?? [];
  // the universe: every term the product is shown for, its long tails, and what it already targets
  const universe = Array.from(new Set([...terms, ...terms.flatMap((t) => LONG.filter(() => r() > 0.7).map((m) => t + m)), ...own.filter((x) => x.match !== "Product (PAT)" && x.match !== "Auto").map((x) => x.term)]));

  const rows = universe.map((q, i) => {
    const branded = /sportstech/.test(q);
    const sv = Math.round((branded ? 900 : 60000 / (1 + i * 0.5)) * (0.4 + r() * 0.9));
    const ads = own.filter((x) => x.term === q);
    const t = ads.reduce((a, x) => {
      const c = total(x.w);
      return { spend: a.spend + c.spend, orders: a.orders + c.orders };
    }, { spend: 0, orders: 0 });
    const match = Array.from(new Set(ads.map((x) => x.match)));
    const org = branded ? 1 + Math.floor(r() * 3) : r() > 0.18 ? Math.ceil(r() ** 1.3 * 90) : null;
    const gaps: Gap[] = [];
    if (!ads.length) gaps.push("Not targeted");
    else if (!match.includes("Exact")) gaps.push("No Exact");
    if (ads.length && t.orders > 0 && !match.includes("Exact")) gaps.push("Converting, no own Exact");
    if (!ads.length && (org === null || org > 20)) gaps.push("Weak organic, no ads");
    if (t.spend > 0 && t.orders === 0) gaps.push("Spend, no sales");
    return {
      q,
      sv,
      trend: Math.round((r() - 0.45) * 60),
      org,
      spr: ads.length && r() > 0.3 ? Math.ceil(r() * 25) : null,
      ks: Math.round(sv * (0.004 + r() * 0.02)),
      cpr: Math.round(8 + r() * (sv / 400)),
      comp: Math.round(200 + r() * 4000),
      sqp: r() > 0.3 ? Math.round((sv / 4.3) * (0.8 + r() * 0.4)) : null,
      match,
      spend: t.spend,
      orders: t.orders,
      gaps,
    };
  });
  cache.set(asin, rows);
  return rows;
}
