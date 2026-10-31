// Advertising detail for the category pages: keywords and targets per campaign, period by period.
// Invented until Supabase serves it (ppc_target_period, sqp_keyword, h10_keyword, asin_keyword_rank).
// Spend is distributed from the category's own-campaign spend, so these tables add up to the totals above them.
import type { CategoryData, Mode } from "./category";
import { rng, type NoSale, type Product } from "./mock";

export type MatchType = "Exact" | "Phrase" | "Broad" | "Product (PAT)" | "Auto";
export const MATCH_TYPES: MatchType[] = ["Exact", "Phrase", "Broad", "Product (PAT)", "Auto"];

export type Cell = { impr: number; clicks: number; spend: number; sales: number; orders: number };
export type Bucket = "Branded" | "Non-branded" | "Defensive" | "Offensive";
export const BUCKETS: Bucket[] = ["Branded", "Non-branded", "Defensive", "Offensive"];
// Helium 10 30-day volume and Amazon SQP for the same query (keywords only, not targets)
export type Market = { h10: number; sqpVol: number; clickShare: number; purchShare: number; rank: number | null };
export type KwRow = {
  id: string;
  term: string;
  match: MatchType;
  // PAT and Auto split further: "PAT · ASIN", "PAT · category", "Auto · close match", ...
  sub: string | null;
  campaign: string;
  // null = the campaign spends on several products ("multi"), shown under "All" only
  asin: string | null;
  product: string | null;
  branded: boolean;
  // where the ad ran: our brand, generic demand, our own product pages, or competitor product pages
  bucket: Bucket;
  w: (Cell | null)[];
  market: Market | null;
};

export const TERMS: Record<string, string[]> = {
  treadmills: ["laufband", "walking pad", "laufband klappbar", "laufband für zuhause", "laufband mit steigung", "walking pad unter schreibtisch", "laufband elektrisch", "sportstech laufband"],
  "exercise-bikes": ["heimtrainer", "heimtrainer fahrrad", "ergometer", "speedbike", "sitzfahrrad", "heimtrainer klappbar", "sportstech heimtrainer", "fahrradtrainer"],
  "vibration-plates": ["vibrationsplatte", "vibrationsplatte abnehmen", "rüttelplatte fitness", "vibration plate", "ganzkörper vibrationsplatte", "vibrationsplatte mit griff", "sportstech vibrationsplatte", "vibrationstrainer"],
  "cross-trainers": ["crosstrainer", "ellipsentrainer", "crosstrainer für zuhause", "crosstrainer klein", "sportstech crosstrainer", "stepper crosstrainer"],
  "rowing-machines": ["rudergerät", "rudergerät wasser", "rudergerät klappbar", "rudergerät magnetisch", "sportstech rudergerät", "rowing machine"],
  "strength-training": ["kraftstation", "multi gym", "fitnessstation", "kraftstation für zuhause", "sportstech kraftstation", "latzug station"],
  "benches-weights": ["hantelbank", "hantelbank verstellbar", "kurzhantel set", "trainingsbank", "sportstech hantelbank", "flachbank"],
  "small-equipment": ["yogamatte", "widerstandsbänder", "fitnessband", "gymnastikmatte", "sportstech yogamatte", "theraband"],
  "hoverboards-scooters": ["hoverboard", "hoverboard kinder", "e scooter", "hoverboard mit sitz", "sportstech hoverboard", "elektro roller"],
  trampolines: ["trampolin", "fitness trampolin", "trampolin indoor", "minitrampolin", "sportstech trampolin", "jumping fitness trampolin"],
};
const AUTO = ["close match", "loose match", "substitutes", "complements"];
const isBranded = (t: string) => /sportstech/i.test(t);

// dud = a keyword that spends but almost never converts (every real account carries a few)
type Draft = Omit<KwRow, "w" | "market" | "bucket"> & { own?: boolean } & { weight: number; cpc: number; acos: number; ctr: number; aov: number; pause: number; h10: number; dud: boolean };

const cache = new Map<string, KwRow[]>();

/** Every keyword / target row of the category for one mode; filter by scope with `scopeRows`. */
export function categoryAds(data: CategoryData, mode: Mode): KwRow[] {
  const key = `${data.def.slug}|${mode}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const seed = data.def.slug.split("").reduce((a, c) => a + c.charCodeAt(0) * 7, 0) + (mode === "monthly" ? 991 : 0);
  const r = rng(seed);
  const terms = TERMS[data.def.slug] ?? ["fitnessgerät"];
  const short = (p: Product) => p.name;
  const drafts: Draft[] = [];
  const base = (p: Product | null) => {
    const row = p ? p[mode][0] : null;
    const aov = row && row.units ? row.sales / row.units : 120 + r() * 300;
    return { aov, cpc: 0.3 + r() * 0.9, ctr: 0.002 + r() * 0.006, pause: r() };
  };
  // ACOS is the anchor: branded terms convert cheaply, generic ones cost more
  const add = (d: Omit<Draft, "id" | "branded" | "cpc" | "acos" | "ctr" | "aov" | "pause" | "h10" | "dud">, p: Product | null, h10Base = 0) => {
    const branded = isBranded(d.term);
    // own-page placements convert like branded traffic
    drafts.push({ ...d, ...base(p), acos: branded || d.own ? 0.06 + r() * 0.09 : 0.15 + r() * 0.3, id: `${d.campaign}|${d.match}|${d.term}`, branded, h10: h10Base, dud: !branded && !d.own && r() < 0.14 });
  };

  for (const p of data.products) {
    // every product bids on its brand term; the generic terms vary
    const pick = [...terms.filter((t) => !isBranded(t) && r() > 0.35).slice(0, 4), ...terms.filter(isBranded)];
    const camp = `SP | ${short(p)}`;
    // about one product in four runs no Phrase campaign: the gap the coverage table flags
    const phrase = r() > 0.25;
    pick.forEach((t, i) => {
      const h10 = Math.round((isBranded(t) ? 400 : 60000 / (i + 1)) * (0.5 + r()));
      // about a quarter of generic terms run only as Phrase / Broad: the "No Exact" gap in Keyword gaps
      if (isBranded(t) || i === 0 || r() > 0.25) add({ term: t, match: "Exact", sub: null, campaign: `${camp} | Exact`, asin: p.asin, product: p.name, weight: 3 + r() * 6 }, p, h10);
      if (phrase && r() > 0.4) add({ term: t, match: "Phrase", sub: null, campaign: `${camp} | Phrase`, asin: p.asin, product: p.name, weight: 1 + r() * 3 }, p, h10);
      if (r() > 0.6) add({ term: t, match: "Broad", sub: null, campaign: `${camp} | Broad`, asin: p.asin, product: p.name, weight: 1 + r() * 2.5 }, p, h10);
    });
    for (let k = 0; k < 2; k++) {
      const comp = "B0" + Math.floor(r() * 36 ** 8).toString(36).toUpperCase().padStart(8, "0").slice(0, 8);
      add({ term: `asin="${comp}"`, match: "Product (PAT)", sub: "PAT · ASIN", campaign: `${camp} | PAT`, asin: p.asin, product: p.name, weight: 1 + r() * 3 }, p);
    }
    add({ term: `category="${data.def.title}"`, match: "Product (PAT)", sub: "PAT · category", campaign: `${camp} | PAT`, asin: p.asin, product: p.name, weight: 1 + r() * 2 }, p);
    // defensive: advertise on a sibling's product page so competitors don't take the slot
    const sib = data.products.find((x) => x !== p);
    if (sib) add({ term: `asin="${sib.asin}"`, match: "Product (PAT)", sub: "PAT · ASIN", campaign: `${camp} | Defend`, asin: p.asin, product: p.name, weight: 0.6 + r() * 1.2, own: true }, p);
    AUTO.forEach((a) => add({ term: a, match: "Auto", sub: `Auto · ${a}`, campaign: `${camp} | Auto`, asin: p.asin, product: p.name, weight: 0.5 + r() * 2 }, p));
  }
  // generic campaigns that spend across several products
  terms.slice(0, 3).forEach((t, i) => {
    const h10 = Math.round((isBranded(t) ? 400 : 60000 / (i + 1)) * (0.5 + r()));
    add({ term: t, match: i === 2 ? "Broad" : "Exact", sub: null, campaign: `SP | ${data.def.title} | Generic`, asin: null, product: null, weight: 2 + r() * 4 }, null, h10);
  });

  const own = data.totals("", mode).map((x) => x.ownSpend);
  const sumW = drafts.reduce((a, d) => a + d.weight, 0);
  const rows: KwRow[] = drafts.map((d) => {
    const w = own.map((spendAll, i) => {
      // some rows are new or paused in older periods
      if (i > 0 && d.pause > 0.85 && i >= 3) return null;
      const spend = Math.round(((spendAll * d.weight) / sumW) * (0.75 + r() * 0.5) * 100) / 100;
      const clicks = Math.max(1, Math.round(spend / d.cpc));
      const orders = d.dud && r() < 0.8 ? 0 : Math.min(clicks, Math.round((spend / (d.acos * (0.7 + r() * 0.6))) / d.aov));
      return { impr: Math.round(clicks / d.ctr), clicks, spend, sales: Math.round(orders * d.aov * 100) / 100, orders };
    });
    const market: Market | null =
      d.match === "Product (PAT)" || d.match === "Auto"
        ? null
        : { h10: d.h10, sqpVol: Math.round((d.h10 / 4.3) * (0.85 + r() * 0.3)), clickShare: d.branded ? 30 + r() * 40 : 1 + r() * 12, purchShare: d.branded ? 40 + r() * 40 : 1 + r() * 14, rank: r() > 0.15 ? Math.ceil(r() * (d.branded ? 3 : 48)) : null };
    const { term, match, sub, campaign, asin, product, branded, id } = d;
    // ASIN targets and the product-page auto groups run on product pages; the rest on search results
    const onPage = sub === "PAT · ASIN" || sub === "Auto · substitutes" || sub === "Auto · complements";
    const bucket: Bucket = d.own ? "Defensive" : onPage ? "Offensive" : branded ? "Branded" : "Non-branded";
    return { id, term, match, sub, campaign, asin, product, branded, bucket, w, market };
  });
  cache.set(key, rows);
  return rows;
}

/** Rows for a page scope: the whole category keeps "multi" campaigns; a family or product keeps only its own. */
export function scopeRows(rows: KwRow[], asins: string[] | null): KwRow[] {
  return asins ? rows.filter((x) => x.asin !== null && asins.includes(x.asin)) : rows;
}

/* ---------- campaigns ---------- */
// own = named after a product of this category; shared = account-wide catch-alls that also serve these ASINs
export type CampRow = { name: string; own: boolean; asin: string | null; product: string | null; w: (Cell | null)[] };
const SHARED = ["SP | Account | Catch-all Auto", "SP | Account | Generic Broad", "SP | Account | Competitor ASINs", "SP | Account | Retargeting PAT"];
const campCache = new Map<string, CampRow[]>();

/** Campaigns for a scope: own ones from the keyword rows, shared ones from the category's shared spend. */
export function categoryCampaigns(data: CategoryData, mode: Mode, family: string): CampRow[] {
  const key = `${data.def.slug}|${mode}|${family}`;
  const hit = campCache.get(key);
  if (hit) return hit;
  const asins = family ? data.pick(family).map((p) => p.asin) : null;
  const byName = new Map<string, CampRow>();
  for (const r of scopeRows(categoryAds(data, mode), asins)) {
    const c = byName.get(r.campaign) ?? { name: r.campaign, own: true, asin: r.asin, product: r.product, w: r.w.map(() => null) };
    c.w = c.w.map((x, i) => (r.w[i] ? addCell(x ?? zero(), r.w[i]) : x));
    byName.set(r.campaign, c);
  }
  // shared spend of the scope, split over the catch-alls with stable weights
  const rnd = rng(data.def.slug.length * 17 + (mode === "monthly" ? 5 : 1));
  const weights = SHARED.map(() => 0.4 + rnd());
  const wsum = weights.reduce((a, b) => a + b, 0);
  const acos = SHARED.map(() => 0.24 + rnd() * 0.2);
  const shared = data.totals(family, mode).map((t) => t.sharedSpend);
  SHARED.forEach((name, k) => {
    const w = shared.map((s) => {
      const spend = Math.round(((s * weights[k]) / wsum) * (0.85 + rnd() * 0.3) * 100) / 100;
      if (spend < 1) return null;
      const clicks = Math.max(1, Math.round(spend / (0.45 + rnd() * 0.5)));
      const sales = Math.round((spend / (acos[k] * (0.8 + rnd() * 0.4))) * 100) / 100;
      const orders = Math.min(clicks, Math.round(sales / (180 + rnd() * 120)));
      return { impr: Math.round(clicks / (0.003 + rnd() * 0.004)), clicks, spend, sales, orders };
    });
    byName.set(name, { name, own: false, asin: null, product: null, w });
  });
  const out = [...byName.values()];
  campCache.set(key, out);
  return out;
}

/* ---------- spend with no ad sales ---------- */
type NoSaleSet = { products: NoSale[]; campaigns: NoSale[]; keywords: NoSale[] };
const noSale = (name: string, sub: string, c: Cell, sales: number | null): NoSale => ({ name, sub, adSpend: c.spend, clicks: c.clicks, impressions: c.impr, sales });

/** Per period: keywords, campaigns and products of the scope that spent money and sold nothing through ads. */
export function categoryNoSales(data: CategoryData, mode: Mode, family: string): NoSaleSet[] {
  const asins = family ? data.pick(family).map((p) => p.asin) : null;
  const rows = scopeRows(categoryAds(data, mode), asins);
  const camps = categoryCampaigns(data, mode, family);
  const dead = (c: Cell | null): c is Cell => !!c && c.spend > 0 && c.sales === 0;
  return data.periods[mode].map((_, i) => {
    const keywords = rows.filter((r) => dead(r.w[i])).map((r) => noSale(r.term, `${r.sub ?? r.match} · ${r.campaign}`, r.w[i]!, null));
    const campaigns = camps.filter((c) => dead(c.w[i])).map((c) => noSale(c.name, c.own ? `own · ${c.product ?? "multi-product"}` : "shared catch-all", c.w[i]!, null));
    const products = data.pick(family).flatMap((p) => {
      const c = rows.filter((r) => r.asin === p.asin).reduce((a, r) => addCell(a, r.w[i]), zero());
      return dead(c) ? [noSale(p.name, p.asin, c, p[mode][i].sales)] : [];
    });
    const bySpend = (a: NoSale, b: NoSale) => b.adSpend - a.adSpend;
    return { products: products.sort(bySpend), campaigns: campaigns.sort(bySpend), keywords: keywords.sort(bySpend) };
  });
}

export const zero = (): Cell => ({ impr: 0, clicks: 0, spend: 0, sales: 0, orders: 0 });
export function addCell(a: Cell, b: Cell | null): Cell {
  return b ? { impr: a.impr + b.impr, clicks: a.clicks + b.clicks, spend: a.spend + b.spend, sales: a.sales + b.sales, orders: a.orders + b.orders } : a;
}
export const total = (w: (Cell | null)[]) => w.reduce<Cell>((a, c) => addCell(a, c), zero());
