// Amazon Search Query Performance (Brand Analytics) per category: what the market searched and how much of it we won.
// Invented until Supabase serves it (sqp_keyword, sqp_keyword_asin, asin_keyword_rank).
import type { CategoryData, Mode } from "./category";
import { TERMS } from "./ads";
import { rng } from "./mock";

// one query in one period; market figures are every brand together, ours are the products in scope
export type SqpCell = { vol: number; mClicks: number; mPurch: number; clicks: number; purch: number };
export type SqpRow = {
  q: string;
  // names a product of this category, or we sold on it: "relevant"
  relevant: boolean;
  rank: number | null;
  // per product ASIN, per period (null = Amazon listed no data for it that period)
  byAsin: Record<string, (SqpCell | null)[]>;
};

const MODS = ["", " kaufen", " test", " günstig", " angebot", " für zuhause", " klein"];
const cache = new Map<string, SqpRow[]>();

export function categorySqp(data: CategoryData, mode: Mode): SqpRow[] {
  const key = `${data.def.slug}|${mode}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rng(data.def.slug.length * 131 + (mode === "monthly" ? 7 : 3));
  const own = TERMS[data.def.slug] ?? [];
  const roots = own.map((t) => t.split(" ").find((w) => w !== "sportstech") ?? t);
  // queries Amazon lists although they belong to other categories
  const foreign = Object.entries(TERMS)
    .filter(([slug]) => slug !== data.def.slug)
    .map(([, ts]) => ts[0])
    .filter(() => r() > 0.5);
  const queries = Array.from(new Set([...own.flatMap((t) => MODS.filter(() => r() > 0.55).map((m) => t + m)), ...own, ...foreign]));
  const scale = mode === "monthly" ? 4.3 : 1;
  const n = data.periods[mode].length;

  const rows = queries.map((q, qi) => {
    const isOwn = roots.some((root) => q.includes(root));
    const branded = /sportstech/.test(q);
    const base = (isOwn ? (branded ? 900 : 42000 / (1 + qi * 0.6)) : 9000) * (0.6 + r() * 0.8) * scale;
    const byAsin: SqpRow["byAsin"] = {};
    for (const p of data.products) {
      // Amazon reports SQP only for a product's top queries: smaller products get gaps
      const covered = r() > (isOwn ? 0.2 : 0.75);
      const clickShare = isOwn ? (branded ? 0.2 + r() * 0.25 : 0.004 + r() * 0.05) : r() * 0.004;
      byAsin[p.asin] = Array.from({ length: n }, () => {
        if (!covered || r() < 0.08) return null;
        const vol = Math.round(base * (0.8 + r() * 0.4));
        const mClicks = Math.round(vol * (0.28 + r() * 0.3));
        const mPurch = Math.round(mClicks * (0.03 + r() * 0.07));
        const clicks = Math.round(mClicks * clickShare * (0.7 + r() * 0.6));
        const purch = isOwn ? Math.min(clicks, Math.round(clicks * (0.02 + r() * 0.09))) : 0;
        return { vol, mClicks, mPurch, clicks, purch };
      });
    }
    const anySale = Object.values(byAsin).some((w) => w.some((c) => c && c.purch > 0));
    return { q, relevant: isOwn || anySale, rank: isOwn && r() > 0.1 ? Math.ceil(r() * (branded ? 3 : 60)) : null, byAsin };
  });
  cache.set(key, rows);
  return rows;
}

/** Fold the products in scope into one cell per period. Market figures are per query, so they are taken once, not summed. */
export function sqpScope(row: SqpRow, asins: string[], n: number): (SqpCell | null)[] {
  return Array.from({ length: n }, (_, i) => {
    const cells = asins.map((a) => row.byAsin[a]?.[i]).filter((c): c is SqpCell => !!c);
    if (!cells.length) return null;
    return cells.reduce((o, c) => ({ vol: Math.max(o.vol, c.vol), mClicks: Math.max(o.mClicks, c.mClicks), mPurch: Math.max(o.mPurch, c.mPurch), clicks: o.clicks + c.clicks, purch: o.purch + c.purch }));
  });
}
