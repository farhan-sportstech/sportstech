// Sponsored Products placements per ISO week (Amazon reports placements for SP only, weekly).
// Invented until Supabase serves it (placements, placement_week_hist).
import type { CategoryData } from "./category";
import type { Cell } from "./ads";
import { rng } from "./mock";

export type Placement = "Top of Search" | "Product pages" | "Rest of Search" | "Off Amazon";
export const PLACEMENTS: Placement[] = ["Top of Search", "Product pages", "Rest of Search", "Off Amazon"];
export type PlWeek = { kw: string; label: string; p: Record<Placement, Cell> };

// share of spend, CTR, CPC, ACOS (null = no sales), CVR per placement: shapes of a typical account
const SHAPE: Record<Placement, { share: number; ctr: number; cpc: number; acos: number | null; cvr: number }> = {
  "Top of Search": { share: 0.4, ctr: 0.072, cpc: 1.65, acos: 0.18, cvr: 0.041 },
  "Product pages": { share: 0.34, ctr: 0.0034, cpc: 1.6, acos: 0.24, cvr: 0.029 },
  "Rest of Search": { share: 0.255, ctr: 0.0075, cpc: 1.32, acos: 0.21, cvr: 0.028 },
  "Off Amazon": { share: 0.005, ctr: 0.6, cpc: 0.1, acos: null, cvr: 0 },
};
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (d: Date) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
const cache = new Map<string, PlWeek[]>();

/** The last 12 ISO weeks, newest first, for a scope ("" = whole category, or a family). */
export function categoryPlacements(data: CategoryData, family: string): PlWeek[] {
  const key = `${data.def.slug}|${family}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rng(data.def.slug.length * 29 + family.length * 3 + 11);
  const recent = data.totals(family, "weekly").map((t) => t.ownSpend);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const first = Number(data.periods.weekly[0].kw.replace(/\D/g, ""));
  const monday = Date.UTC(2026, 9, 19); // KW 43 starts Mon 19 Oct 2026

  const weeks = Array.from({ length: 12 }, (_, i) => {
    const spendAll = i < recent.length ? recent[i] : avg * (0.75 + r() * 0.5);
    const start = new Date(monday - i * 7 * 864e5);
    const end = new Date(start.getTime() + 6 * 864e5);
    const raw = PLACEMENTS.map((pl) => SHAPE[pl].share * (0.85 + r() * 0.3));
    const norm = raw.reduce((a, b) => a + b, 0);
    const p = Object.fromEntries(
      PLACEMENTS.map((pl, k) => {
        const s = SHAPE[pl];
        const spend = Math.round(((spendAll * raw[k]) / norm) * 100) / 100;
        const clicks = Math.max(0, Math.round(spend / (s.cpc * (0.9 + r() * 0.2))));
        const impr = Math.round(clicks / (s.ctr * (0.85 + r() * 0.3)));
        const sales = s.acos === null ? 0 : Math.round((spend / (s.acos * (0.85 + r() * 0.3))) * 100) / 100;
        const orders = s.acos === null ? 0 : Math.min(clicks, Math.round(clicks * s.cvr * (0.85 + r() * 0.3)));
        return [pl, { impr, clicks, spend, sales, orders }];
      }),
    ) as Record<Placement, Cell>;
    return { kw: `KW ${first - i}`, label: `${day(start)}–${day(end)}`, p };
  });
  cache.set(key, weeks);
  return weeks;
}
