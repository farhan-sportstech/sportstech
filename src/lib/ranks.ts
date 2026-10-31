// Organic rank on amazon.de per product and tracked query, one reading per week (Tuesdays).
// Invented until Supabase serves it (asin_keyword_rank, rank_hist).
import type { CategoryData } from "./category";
import { TERMS } from "./ads";
import { rng } from "./mock";

export const RANK_DATES = ["29 Sep", "6 Oct", "13 Oct", "20 Oct", "27 Oct"];
// null = tracked but not found in the top 60 that week
export type RankRow = { q: string; ranks: (number | null)[] };

const MODS = ["", " kaufen", " test", " klein", " für zuhause", " günstig"];
const cache = new Map<string, RankRow[]>();

export function productRanks(data: CategoryData, asin: string): RankRow[] {
  const key = `${data.def.slug}|${asin}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rng(asin.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const terms = TERMS[data.def.slug] ?? [];
  const product = data.products.find((p) => p.asin === asin);
  // the product's own branded query always makes the list
  const queries = Array.from(new Set([...(product ? [`sportstech ${product.name.toLowerCase()}`] : []), ...terms.flatMap((t) => MODS.filter(() => r() > 0.6).map((m) => t + m))])).slice(0, 14);
  const rows = queries.map((q) => {
    const branded = /sportstech/.test(q);
    // a starting position and a weekly drift; branded queries sit near the top
    let pos = branded ? 1 + Math.floor(r() * 3) : 4 + Math.floor(r() ** 1.6 * 70);
    const drift = (r() - 0.5) * 6;
    const ranks = RANK_DATES.map(() => {
      pos = Math.max(1, Math.round(pos + drift + (r() - 0.5) * 6));
      return pos > 60 ? null : pos;
    });
    return { q, ranks };
  });
  cache.set(key, rows);
  return rows;
}
