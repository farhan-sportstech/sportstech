// Rows for the Ads Hub views, derived from the account sample. Every row carries the same base so the shared
// filter bar (portfolio, campaign, ad group, ad type, contains, minimums) works on any view.
import { DAYS, account, addDay, scaleDay, sumDays, zeroDay, type AdType, type Campaign, type Day, type Match, type State, type Target } from "./account";
import { products, rng } from "./mock";
import { kpiWeeks } from "./kpi";
import { TERMS } from "./ads";

export type Period = "7d" | "30d";
// the two periods the database serves the hub: the latest full week (with the week before) and month to date
export const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "Latest week" },
  { value: "30d", label: "Month to date" },
];
export const periodRange = (p: Period) => `${DAYS[p === "7d" ? 6 : 29].label} – ${DAYS[0].label}`;
/** database placement names → the short labels the app shows */
export const PLACEMENT_LABEL: Record<string, string> = {
  "Top of Search on-Amazon": "Top of search",
  "Detail Page on-Amazon": "Product pages",
  "Other on-Amazon": "Rest of search",
  "Off Amazon": "Off Amazon",
};
export const prevRange = () => `${DAYS[13].label} – ${DAYS[7].label}`;

export type Base = { key: string; pf: string; campaignId: string; campaign: string; adGroup: string; type: AdType; d: Day; prev: Day | null };

export const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};
const CAMP = new Map(account.campaigns.map((c) => [c.id, c]));
export const campaignOf = (id: string) => CAMP.get(id)!;
const winOf = (c: Campaign, p: Period) => sumDays(c.days.slice(0, p === "7d" ? 7 : 30));
const prevOf = (c: Campaign, p: Period) => (p === "7d" ? sumDays(c.days.slice(7, 14)) : null);
// targets and terms carry 30-day totals; the 7-day view scales them by their campaign's 7-day share
const share7 = new Map(account.campaigns.map((c) => [c.id, sumDays(c.days).spend ? sumDays(c.days.slice(0, 7)).spend / sumDays(c.days).spend : 0]));

export const isBranded = (s: string) => /sportstech/i.test(s);
export const isAsin = (s: string) => /^b0[0-9a-z]{8}$/i.test(s);

/* ---------- campaigns ---------- */
export type CampRow = Base & { name: string; state: State; budget: number; used: number; daysAtBudget: number; bidding: string; targeting: "Manual" | "Auto"; nTargets: number; strategy: string };
export function campRows(p: Period): CampRow[] {
  return account.campaigns.map((c) => {
    const wk = c.days.slice(0, 7);
    const avg = sumDays(wk).spend / 7;
    return {
      key: c.id,
      pf: c.portfolio,
      campaignId: c.id,
      campaign: c.name,
      adGroup: "",
      type: c.type,
      d: winOf(c, p),
      prev: prevOf(c, p),
      name: c.name,
      state: c.state,
      budget: c.budget,
      used: c.budget ? (avg / c.budget) * 100 : 0,
      daysAtBudget: wk.filter((x) => x.spend >= c.budget * 0.95).length,
      bidding: hash(c.id) < 0.6 ? "Dynamic down only" : hash(c.id) < 0.85 ? "Up and down" : "Fixed",
      targeting: c.strategy === "Auto" ? "Auto" : "Manual",
      nTargets: account.targets.filter((t) => t.campaignId === c.id).length,
      strategy: c.strategy,
    };
  });
}

/* ---------- targets ---------- */
export type TgtRow = Base & { id: string; text: string; match: Match; bid: number; state: State; entity: "Keyword" | "Auto target" | "Product target" };
const tgtDay = (t: Target, p: Period) => (p === "7d" ? t.w : t.t);
export function tgtRows(p: Period): TgtRow[] {
  return account.targets.map((t) => {
    const c = campaignOf(t.campaignId);
    return {
      key: t.id,
      pf: c.portfolio,
      campaignId: c.id,
      campaign: c.name,
      adGroup: t.adGroup,
      type: c.type,
      d: tgtDay(t, p),
      prev: p === "7d" ? t.p : null,
      id: t.id,
      text: t.text,
      match: t.match,
      bid: t.bid,
      state: t.state,
      entity: t.match === "Auto" ? "Auto target" : t.match === "PAT" ? "Product target" : "Keyword",
    };
  });
}

/* ---------- ad groups: one per campaign, summed from its targets ---------- */
export type AgRow = Base & { state: State; defaultBid: number; nTargets: number };
export function agRows(p: Period): AgRow[] {
  const by = new Map<string, TgtRow[]>();
  for (const t of tgtRows(p)) by.set(`${t.campaignId}|${t.adGroup}`, [...(by.get(`${t.campaignId}|${t.adGroup}`) ?? []), t]);
  return [...by.entries()].map(([k, ts]) => {
    const c = campaignOf(ts[0].campaignId);
    const bids = ts.map((t) => t.bid).sort((a, b) => a - b);
    return {
      key: k,
      pf: c.portfolio,
      campaignId: c.id,
      campaign: c.name,
      adGroup: ts[0].adGroup,
      type: c.type,
      d: ts.reduce((a, t) => addDay(a, t.d), zeroDay()),
      prev: p === "7d" ? ts.reduce((a, t) => addDay(a, t.prev ?? zeroDay()), zeroDay()) : null,
      state: c.state,
      defaultBid: bids[Math.floor(bids.length / 2)],
      nTargets: ts.length,
    };
  });
}

/* ---------- product ads: the product's SKUs inside each SP campaign ---------- */
export type ProdRow = Base & { sku: string; asin: string; product: string; state: State };
export function prodRows(p: Period): ProdRow[] {
  const out: ProdRow[] = [];
  for (const c of account.campaigns) {
    if (c.type !== "SP") continue;
    const prod = products.find((x) => x.asin === c.asin);
    if (!prod) continue;
    const d = winOf(c, p);
    const pv = prevOf(c, p);
    const ws = prod.variants.map((v) => 0.3 + hash(v.sku + c.id));
    const sum = ws.reduce((a, b) => a + b, 0);
    prod.variants.forEach((v, i) => {
      const f = ws[i] / sum;
      out.push({ key: `${c.id}${v.sku}`, pf: c.portfolio, campaignId: c.id, campaign: c.name, adGroup: `${prod.name} ${c.strategy}`, type: "SP", d: scaleDay(d, f), prev: pv ? scaleDay(pv, f) : null, sku: v.sku, asin: c.asin, product: `${prod.name} · ${v.label}`, state: c.state });
    });
  }
  return out;
}

/* ---------- search terms ---------- */
export type TermRow = Base & { term: string; target: string; match: Match };
export function termRows(p: Period): TermRow[] {
  return account.terms.map((t) => {
    const c = campaignOf(t.campaignId);
    return { key: t.id, pf: c.portfolio, campaignId: c.id, campaign: c.name, adGroup: t.adGroup, type: c.type, d: p === "7d" ? scaleDay(t.t, share7.get(c.id) ?? 0) : t.t, prev: null, term: t.term, target: t.target, match: t.match };
  });
}

/* ---------- placements (Sponsored Products only) ---------- */
export const PLACES = ["Top of search", "Product pages", "Rest of search"] as const;
export type PlaceRow = Base & { place: (typeof PLACES)[number] };
export function placeRows(p: Period): PlaceRow[] {
  const out: PlaceRow[] = [];
  for (const c of account.campaigns) {
    if (c.type !== "SP") continue;
    const d = winOf(c, p);
    // top of search buys the most clicks and converts best; product pages are cheap and convert worst
    const spend = [0.45 + hash(c.id) * 0.2, 0.25 + hash(c.id + "pp") * 0.15, 0.15];
    const conv = [1.25, 0.7, 0.85];
    const s = spend.reduce((a, b) => a + b, 0);
    PLACES.forEach((place, i) => {
      const f = spend[i] / s;
      const x = scaleDay(d, f);
      out.push({ key: `${c.id}${place}`, pf: c.portfolio, campaignId: c.id, campaign: c.name, adGroup: "", type: "SP", d: { ...x, sales: d.sales * f * conv[i], orders: Math.round(d.orders * f * conv[i]) }, prev: null, place });
    });
  }
  return out;
}

/* ---------- keyword and ASIN gaps: search terms by text, against what is targeted ---------- */
export const RANK_DATES = ["16 Oct", "23 Oct", "30 Oct"];
export type GapRow = Base & { term: string; exact: boolean; phrase: boolean; broad: boolean; nCamps: number; volume: number; ranks: (number | null)[]; isNew: boolean; branded: boolean; asin: boolean; targetedAsProduct: boolean };
export function gapRows(p: Period): GapRow[] {
  const kw = new Map<string, Set<Match>>();
  for (const t of account.targets) {
    const k = t.match === "PAT" ? t.text.slice(6, -1).toLowerCase() : t.text.toLowerCase();
    kw.set(k, (kw.get(k) ?? new Set()).add(t.match));
  }
  const by = new Map<string, TermRow[]>();
  for (const t of termRows(p)) by.set(t.term.toLowerCase(), [...(by.get(t.term.toLowerCase()) ?? []), t]);
  return [...by.entries()].map(([term, ts]) => {
    const m = kw.get(term) ?? new Set<Match>();
    const top = [...ts].sort((a, b) => b.d.spend - a.d.spend)[0];
    const h = hash(term);
    const asin = isAsin(term);
    const ranked = !asin && h > 0.25;
    const base = Math.round(4 + h * 60);
    return {
      key: term,
      pf: top.pf,
      campaignId: top.campaignId,
      campaign: top.campaign,
      adGroup: top.adGroup,
      type: top.type,
      d: ts.reduce((a, t) => addDay(a, t.d), zeroDay()),
      prev: p === "7d" ? ts.reduce((a, t) => addDay(a, scaleDay(t.d, 0.7 + hash(t.key) * 0.6)), zeroDay()) : null,
      term,
      exact: m.has("Exact"),
      phrase: m.has("Phrase"),
      broad: m.has("Broad"),
      nCamps: new Set(ts.map((t) => t.campaignId)).size,
      volume: asin ? 0 : Math.round(300 + h * h * 60000),
      ranks: RANK_DATES.map((_, i) => (ranked ? Math.max(1, Math.round(base + (hash(term + i) - 0.5) * 24)) : null)),
      isNew: h > 0.88,
      branded: isBranded(term),
      asin,
      targetedAsProduct: m.has("PAT"),
    };
  });
}

/* ---------- 13-week trend by ad type, from the weekly KPI rows ---------- */
export type TrendWeek = { label: string; sub: string; sp: Day; sb: Day; sd: Day };
export const trendWeeks: TrendWeek[] = kpiWeeks
  .slice(0, 13)
  .map((w) => {
    const split = (spend: number, acos: number): Day => {
      const f = w.adSpend ? spend / w.adSpend : 0;
      return { impr: Math.round(w.impressions * f), clicks: Math.round(w.clicks * f), spend, sales: spend / acos, orders: Math.round((spend / acos / (w.adSales || 1)) * w.adOrders) };
    };
    return { label: w.label, sub: w.sub, sp: split(w.sp, 0.24), sb: split(w.sb, 0.21), sd: split(w.sd, 0.33) };
  })
  .reverse();

/* ---------- SQP: weekly search query performance, account brand view ---------- */
export type SqpCell = { vol: number; impr: number; oImpr: number; clicks: number; oClicks: number; purch: number; oPurch: number };
export type SqpQuery = { q: string; cat: string; weeks: SqpCell[] };
// SQP weeks run Sunday to Saturday, so they don't line up with ISO (Monday) KPI weeks: label them by their Sunday
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const SQP_WEEKS = Array.from({ length: 26 }, (_, i) => {
  const end = new Date(Date.UTC(2026, 9, 24) - i * 7 * 864e5);
  const start = new Date(end.getTime() - 6 * 864e5);
  const f = (d: Date) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
  return { label: `Wk of ${f(start)}`, range: `Sun ${f(start)} – Sat ${f(end)}`, month: end.toISOString().slice(0, 7) };
}).reverse();
export const sqpQueries: SqpQuery[] = (() => {
  const rnd = rng(523);
  const out: SqpQuery[] = [];
  for (const [cat, qs] of Object.entries(TERMS)) {
    for (const q of qs) {
      const vol = 400 + rnd() * rnd() * 52000;
      const branded = isBranded(q);
      const cs = branded ? 0.55 + rnd() * 0.3 : 0.03 + rnd() * 0.2;
      const cvrM = 0.06 + rnd() * 0.08;
      const cvrO = cvrM * (rnd() < 0.2 ? 0.35 + rnd() * 0.2 : 0.75 + rnd() * 0.6);
      out.push({
        q,
        cat,
        weeks: SQP_WEEKS.map((_, i) => {
          // summer dip, a Prime Day bump in KW 41 (index 23) and noise
          const season = 1 - 0.18 * Math.sin((i / 25) * Math.PI) + (i === 23 ? 0.35 : 0);
          const v = Math.round(vol * season * (0.85 + rnd() * 0.3));
          const impr = Math.round(v * (1.8 + rnd()));
          const clicks = Math.round(v * (0.28 + rnd() * 0.1));
          const purch = Math.round(clicks * cvrM * (0.85 + rnd() * 0.3));
          const oClicks = Math.round(clicks * cs * (0.85 + rnd() * 0.3));
          return { vol: v, impr, oImpr: Math.round(impr * cs * (0.8 + rnd() * 0.3)), clicks, oClicks, purch, oPurch: Math.round(oClicks * cvrO * (0.8 + rnd() * 0.4)) };
        }),
      });
    }
  }
  return out;
})();

/* ---------- portfolio budget caps ---------- */
export const PF_CAP: Record<string, number | null> = Object.fromEntries(
  Array.from(new Set(account.campaigns.map((c) => c.portfolio))).map((pf) => {
    const sum = account.campaigns.filter((c) => c.portfolio === pf && c.state === "ENABLED").reduce((a, c) => a + c.budget, 0);
    return [pf, hash(pf) < 0.35 ? null : Math.round((sum * (0.8 + hash(pf + "cap") * 0.6)) / 10) * 10];
  }),
);

/* ---------- items per order, last 28 days ---------- */
export const ITEMS_PER_ORDER = [
  { items: "1 item", count: 5412 },
  { items: "2 items", count: 611 },
  { items: "3 items", count: 118 },
  { items: "4+ items", count: 41 },
];

export const totalOf = (rows: { d: Day }[]) => rows.reduce((a, r) => addDay(a, r.d), zeroDay());
export { sumDays, zeroDay, addDay };
