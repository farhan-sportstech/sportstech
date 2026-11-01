// Invented sample data for the whole ad account, shaped like the Amazon Ads campaign / targeting / search-term
// reports (daily for campaigns, 30-day totals below that). PPC tools and the Ads Hub both read from here.
import { products, rng } from "./mock";
import { TERMS } from "./ads";

export type AdType = "SP" | "SB" | "SD";
export type Strategy = "Exact" | "Phrase" | "Broad" | "Auto" | "PAT" | "Brand" | "Retarget";
export type State = "ENABLED" | "PAUSED";
export type Day = { impr: number; clicks: number; spend: number; sales: number; orders: number };
export type Campaign = {
  id: string;
  name: string;
  type: AdType;
  strategy: Strategy;
  portfolio: string;
  asin: string;
  product: string;
  state: State;
  budget: number;
  /** index 0 = the newest day (DAYS[0]) */
  days: Day[];
};
export type Match = "Exact" | "Phrase" | "Broad" | "Auto" | "PAT";
/** t = 30 days, w = the newest 7 days, p = the 7 days before those */
export type Target = { id: string; campaignId: string; campaign: string; adGroup: string; text: string; match: Match; bid: number; state: State; t: Day; w: Day; p: Day };
export type Term = { id: string; campaignId: string; campaign: string; adGroup: string; target: string; match: Match; term: string; t: Day };

const N_DAYS = 30;
const LAST = Date.UTC(2026, 9, 30); // 30 Oct 2026, the newest complete day
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAYS = Array.from({ length: N_DAYS }, (_, i) => {
  const d = new Date(LAST - i * 864e5);
  return { iso: d.toISOString().slice(0, 10), label: `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`, dow: DOW[d.getUTCDay()] };
});
const DOW_F: Record<string, number> = { Sun: 1.18, Mon: 1.04, Tue: 0.98, Wed: 0.96, Thu: 0.95, Fri: 0.9, Sat: 0.99 };

export const zeroDay = (): Day => ({ impr: 0, clicks: 0, spend: 0, sales: 0, orders: 0 });
export const addDay = (a: Day, b: Day): Day => ({ impr: a.impr + b.impr, clicks: a.clicks + b.clicks, spend: a.spend + b.spend, sales: a.sales + b.sales, orders: a.orders + b.orders });
export const sumDays = (ds: Day[]) => ds.reduce(addDay, zeroDay());
export const scaleDay = (d: Day, f: number): Day => ({ impr: Math.round(d.impr * f), clicks: Math.round(d.clicks * f), spend: d.spend * f, sales: d.sales * f, orders: Math.round(d.orders * f) });
export const acosD = (d: Day) => (d.sales ? (d.spend / d.sales) * 100 : null);
export const cpcD = (d: Day) => (d.clicks ? d.spend / d.clicks : null);
export const ctrD = (d: Day) => (d.impr ? (d.clicks / d.impr) * 100 : null);
export const cvrD = (d: Day) => (d.clicks ? (d.orders / d.clicks) * 100 : null);
export const roasD = (d: Day) => (d.spend ? d.sales / d.spend : null);

export const slugOf = (cat: string) => (cat === "Strength stations" ? "strength-training" : cat.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-"));
const SHORT: Record<string, string> = {
  Treadmills: "TM",
  "Exercise bikes": "BIKE",
  "Vibration plates": "VP",
  "Cross trainers": "CT",
  "Rowing machines": "ROW",
  "Strength stations": "STR",
  "Benches & weights": "BW",
  "Small equipment": "SE",
  "Hoverboards & scooters": "HOV",
  Trampolines: "TRA",
};

// share of a product's ad spend, target ACOS and CPC per campaign strategy
const MIX: Record<Strategy, { w: number; acos: number; cpc: number; ctr: number }> = {
  Exact: { w: 0.3, acos: 0.17, cpc: 1.25, ctr: 0.009 },
  Phrase: { w: 0.17, acos: 0.25, cpc: 1.05, ctr: 0.006 },
  Broad: { w: 0.13, acos: 0.33, cpc: 0.85, ctr: 0.004 },
  Auto: { w: 0.18, acos: 0.29, cpc: 0.7, ctr: 0.004 },
  PAT: { w: 0.1, acos: 0.36, cpc: 0.62, ctr: 0.003 },
  Brand: { w: 0.14, acos: 0.21, cpc: 1.6, ctr: 0.011 },
  Retarget: { w: 0.08, acos: 0.31, cpc: 0.55, ctr: 0.002 },
};

function build() {
  const rnd = rng(911);
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const campaigns: Campaign[] = [];
  const targets: Target[] = [];
  const terms: Term[] = [];
  let tid = 0;

  products.forEach((p, pi) => {
    const price = p.weekly[0].units ? p.weekly[0].sales / p.weekly[0].units : 300;
    const daily = Math.max(6, p.weekly[0].adSpend / 7);
    const strategies: Strategy[] = ["Exact", "Phrase", "Broad", "Auto", "PAT"];
    if (pi % 2 === 0) strategies.push("Brand");
    if (pi % 3 === 0) strategies.push("Retarget");
    const kws = TERMS[slugOf(p.category)] ?? [];

    strategies.forEach((s, si) => {
      const mix = MIX[s];
      const type: AdType = s === "Brand" ? "SB" : s === "Retarget" ? "SD" : "SP";
      const id = `C${(pi * 10 + si + 1001).toString()}`;
      const name = `${SHORT[p.category]} | ${p.name} | ${type} | ${s}`;
      const base = daily * mix.w * r(0.6, 1.5);
      // a few campaigns run on a budget that caps them most days; the rest have headroom
      const capped = rnd() < 0.12;
      const budget = Math.max(5, Math.round(base * (capped ? r(0.95, 1.08) : r(1.4, 2.6))));
      const acosT = mix.acos * (rnd() < 0.1 ? r(2.2, 4) : r(0.55, 1.6));
      const cpc = mix.cpc * r(0.65, 1.5);
      const ctr = mix.ctr * r(0.6, 1.5);
      const state: State = rnd() < 0.07 ? "PAUSED" : "ENABLED";
      const days: Day[] = DAYS.map((d) => {
        if (state === "PAUSED") return zeroDay();
        const spend = Math.min(budget, base * DOW_F[d.dow] * r(0.65, 1.35));
        const clicks = Math.max(0, Math.round(spend / (cpc * r(0.85, 1.15))));
        // expected orders can be a fraction on small campaigns: the fraction becomes one order with that chance
        const want = (spend / acosT / price) * r(0.6, 1.4);
        const orders = Math.floor(want) + (rnd() < want % 1 ? 1 : 0);
        const sales = orders * price * r(0.92, 1.08);
        return { impr: Math.round(clicks / (ctr * r(0.8, 1.2))), clicks, spend, sales, orders };
      });
      campaigns.push({ id, name, type, strategy: s, portfolio: p.category, asin: p.asin, product: p.name, state, budget, days });

      // targets under the campaign: one ad group per campaign, the 30-day totals split by weight
      const texts: { text: string; match: Match }[] =
        s === "Exact" || s === "Brand"
          ? kws.slice(0, 5).map((k) => ({ text: k, match: "Exact" }))
          : s === "Phrase"
            ? kws.slice(0, 4).map((k) => ({ text: k, match: "Phrase" }))
            : s === "Broad"
              ? kws.slice(1, 5).map((k) => ({ text: k, match: "Broad" }))
              : s === "Auto"
                ? ["close match", "loose match", "substitutes", "complements"].map((k) => ({ text: k, match: "Auto" }))
                : Array.from({ length: 4 }, () => ({ text: `asin="B0${Math.floor(rnd() * 1e8).toString(36).toUpperCase().padStart(8, "0").slice(0, 8)}"`, match: "PAT" as Match }));
      const tot = sumDays(days);
      const wk = sumDays(days.slice(0, 7));
      const pk = sumDays(days.slice(7, 14));
      const ws = texts.map(() => r(0.3, 1.6));
      const wsum = ws.reduce((a, b) => a + b, 0);
      const adGroup = `${p.name} ${s}`;
      texts.forEach((t, k) => {
        // each target converts at its own rate, so some run far above the campaign's ACOS and some below
        const f = ws[k] / wsum;
        const conv = rnd() < 0.15 ? 0 : r(0.4, 1.7);
        const tt = { ...scaleDay(tot, f), sales: tot.sales * f * conv, orders: Math.round(tot.orders * f * conv) };
        const tw = { ...scaleDay(wk, f), sales: wk.sales * f * conv, orders: Math.round(wk.orders * f * conv) };
        const pf = f * r(0.6, 1.4);
        const tp = { ...scaleDay(pk, pf), sales: pk.sales * pf * conv, orders: Math.round(pk.orders * pf * conv) };
        const tcpc = cpcD(tt) ?? cpc;
        const target: Target = { id: `T${++tid}`, campaignId: id, campaign: name, adGroup, text: t.text, match: t.match, bid: Math.round(tcpc * r(1.05, 1.5) * 100) / 100, state: state === "PAUSED" || rnd() < 0.05 ? "PAUSED" : "ENABLED", t: tt, w: tw, p: tp };
        targets.push(target);

        // search terms that matched the target: Exact matches itself, the rest fan out into variants
        const variants =
          t.match === "Exact"
            ? [t.text]
            : t.match === "PAT"
              ? [t.text.slice(6, -1).toLowerCase()]
              : [
                  kws[(k + 1) % kws.length],
                  `${kws[k % kws.length]} ${["klappbar", "für zuhause", "test", "günstig", "mit app", "kompakt", "leise", "angebot"][Math.floor(rnd() * 8)]}`,
                  // auto targeting also lands on competitor product pages, which show up as ASIN search terms
                  t.match === "Auto" && rnd() < 0.6 ? `b0${Math.floor(rnd() * 1e8).toString(36).padStart(8, "0").slice(0, 8)}` : `${["kettler", "miweba", "hammer", "christopeit", "skandika"][Math.floor(rnd() * 5)]} ${kws[0]?.split(" ")[0] ?? "fitness"}`,
                ].filter(Boolean);
        const vs = variants.map(() => r(0.2, 1.4));
        const vsum = vs.reduce((a, b) => a + b, 0);
        variants.forEach((term, j) => {
          const g = vs[j] / vsum;
          const vconv = j === variants.length - 1 && variants.length > 1 ? r(0, 0.5) : r(0.6, 1.4);
          terms.push({ id: `Q${tid}-${j}`, campaignId: id, campaign: name, adGroup, target: t.text, match: t.match, term, t: { ...scaleDay(tt, g), sales: tt.sales * g * vconv, orders: Math.round(tt.orders * g * vconv) } });
        });
      });
    });
  });

  // yesterday's anomalies, so the spike rules have something to find
  const live = campaigns.filter((c) => c.state === "ENABLED");
  const pick = (n: number, off: number) => Array.from({ length: n }, (_, i) => live[(i * 17 + off) % live.length]);
  pick(5, 3).forEach((c) => {
    const d = c.days[0];
    c.days[0] = { ...d, spend: d.spend * 2.6, clicks: Math.round(d.clicks * 2.4), impr: Math.round(d.impr * 2.2) };
    c.budget = Math.max(c.budget, Math.ceil(c.days[0].spend * 1.1));
  });
  pick(4, 8).forEach((c) => {
    const d = c.days[0];
    c.days[0] = { ...d, spend: Math.max(d.spend, 28), orders: 0, sales: 0 };
    c.budget = Math.max(c.budget, Math.ceil(c.days[0].spend * 1.2));
  });
  pick(4, 12).forEach((c) => {
    const d = c.days[0];
    c.days[0] = { ...d, sales: d.sales * 0.3, orders: Math.max(1, Math.round(d.orders * 0.3)) };
  });
  // a week of falling sales on a few campaigns
  pick(3, 21).forEach((c) => {
    for (let i = 0; i < 7; i++) c.days[i] = { ...c.days[i], sales: c.days[i].sales * 0.45, orders: Math.round(c.days[i].orders * 0.45) };
  });

  return { campaigns, targets, terms };
}

export const account = build();
export const PORTFOLIOS = Array.from(new Set(account.campaigns.map((c) => c.portfolio)));
