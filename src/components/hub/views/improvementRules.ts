// The rule-based to-do list behind Improvements (and its summary on Home). T = target ACOS in %.
import { acosD, cpcD, type Day } from "@/lib/account";
import { SQP_WEEKS, campRows, gapRows, sqpQueries, tgtRows, totalOf, type Period } from "@/lib/hub";
import { eur, pct1 } from "@/lib/format";
import type { Change } from "@/lib/queue";

export const FROM = ["Coverage", "Negatives", "Bids", "Budget", "Campaigns", "SQP"] as const;
export type From = (typeof FROM)[number];
export const PRIORITIES = ["High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const STEPS = ["Raise budget", "Lower bid", "Raise bid", "Add as Exact", "Add negative", "Review / pause", "Check listing", "Ask team", "Skipped", "Done"] as const;
export type Step = (typeof STEPS)[number];

export type Item = {
  id: string;
  from: From;
  priority: Priority;
  kind: string;
  item: string;
  where: string;
  pf: string;
  d: Day | null;
  why: string;
  step: Step;
  /** what the Queue button sends; null when the step happens outside Amazon Ads */
  change: (Omit<Change, "id" | "queuedAt" | "source"> & { label: string }) | null;
};

const RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
const pct = (v: number | null) => (v === null ? "no sales" : `${pct1.format(v)}%`);

export function improvements(period: Period, T: number): Item[] {
  const out: Item[] = [];
  const camps = campRows(period);
  const acct = acosD(totalOf(camps)) ?? 0;

  // Coverage and negatives: search terms by text, against what is already targeted
  for (const g of gapRows(period)) {
    const cpc = cpcD(g.d) ?? 0.5;
    if (g.d.orders >= 2 && !g.exact && !(g.asin && g.targetedAsProduct)) {
      out.push({
        id: `cov:${g.term}`,
        from: "Coverage",
        priority: g.d.orders >= 5 ? "High" : "Medium",
        kind: g.asin ? "ASIN" : "Search term",
        item: g.term,
        where: g.campaign,
        pf: g.pf,
        d: g.d,
        why: `${g.d.orders} orders at ${pct(acosD(g.d))} ACOS, not targeted ${g.asin ? "as a product" : "as Exact"}`,
        step: "Add as Exact",
        change: { label: g.asin ? "Add product target" : "Add as Exact", action: "targeting.create", campaign: g.campaign, adGroup: g.adGroup, entity: g.term, current: null, proposed: `${g.asin ? "PRODUCT" : "EXACT"}|${cpc.toFixed(2)}` },
      });
    }
    if (g.d.orders === 0 && g.d.spend >= 40) {
      out.push({
        id: `neg:${g.term}`,
        from: "Negatives",
        priority: g.d.spend >= 100 ? "High" : "Medium",
        kind: g.asin ? "ASIN" : "Search term",
        item: g.term,
        where: g.campaign,
        pf: g.pf,
        d: g.d,
        why: `${eur.format(g.d.spend)} spent, no orders`,
        step: "Add negative",
        change: { label: "Add negative", action: "targeting.create.negative", campaign: g.campaign, adGroup: g.adGroup, entity: g.term, current: null, proposed: "EXACT" },
      });
    }
  }

  // Bids: keywords and product targets, never auto targets
  for (const t of tgtRows(period)) {
    if (t.match === "Auto" || t.state !== "ENABLED") continue;
    const a = acosD(t.d);
    const cpc = cpcD(t.d);
    if (a === null || cpc === null) continue;
    const sug = Math.round(Math.min(1.3 * cpc, Math.max(0.7 * cpc, (cpc * T) / a)) * 100) / 100;
    const lower = t.d.orders > 0 && a > 1.6 * T && t.d.spend >= 50;
    const raise = t.d.orders >= 3 && a < 0.5 * T;
    if (!lower && !raise) continue;
    out.push({
      id: `bid:${t.id}`,
      from: "Bids",
      priority: lower ? (a > 2.5 * T ? "High" : "Medium") : "Low",
      kind: t.entity,
      item: t.text,
      where: t.campaign,
      pf: t.pf,
      d: t.d,
      why: lower ? `ACOS ${pct(a)} is over 1,6× the ${T}% target` : `${t.d.orders} orders at ${pct(a)} ACOS, well under target`,
      step: lower ? "Lower bid" : "Raise bid",
      change: { label: `Bid €${sug.toFixed(2).replace(".", ",")}`, action: "targeting.bid", campaign: t.campaign, adGroup: t.adGroup, entity: t.text, current: t.bid, proposed: sug },
    });
  }

  // Budget and campaigns
  for (const c of camps) {
    if (c.state !== "ENABLED") continue;
    const a = acosD(c.d);
    if (c.type === "SP" && c.daysAtBudget >= 3) {
      const ok = a !== null && a <= acct;
      out.push({
        id: `bud:${c.key}`,
        from: "Budget",
        priority: ok ? "High" : "Medium",
        kind: "Campaign",
        item: c.name,
        where: c.pf,
        pf: c.pf,
        d: c.d,
        why: `At budget on ${c.daysAtBudget} of 7 days, ACOS ${pct(a)} vs account ${pct1.format(acct)}%`,
        step: ok ? "Raise budget" : "Check listing",
        change: ok ? { label: `Budget €${Math.round(c.budget * 1.2)}`, action: "campaign.budget", campaign: c.campaign, adGroup: "", entity: c.campaign, current: c.budget, proposed: Math.round(c.budget * 1.2) } : null,
      });
    }
    if (c.d.spend >= 150 && c.d.orders === 0) {
      out.push({
        id: `camp:${c.key}`,
        from: "Campaigns",
        priority: "High",
        kind: "Campaign",
        item: c.name,
        where: c.pf,
        pf: c.pf,
        d: c.d,
        why: `${eur.format(c.d.spend)} spent without an order`,
        step: "Review / pause",
        change: { label: "Pause", action: "campaign.state", campaign: c.campaign, adGroup: "", entity: c.campaign, current: "ENABLED", proposed: "PAUSED" },
      });
    }
  }

  // SQP: our conversion against the market's, latest week
  const last = SQP_WEEKS.length - 1;
  for (const q of sqpQueries) {
    const w = q.weeks[last];
    if (w.oClicks < 20 || !w.clicks) continue;
    const ours = w.oPurch / w.oClicks;
    const mkt = w.purch / w.clicks;
    if (ours >= 0.5 * mkt) continue;
    out.push({
      id: `sqp:${q.q}`,
      from: "SQP",
      priority: w.oClicks >= 100 ? "High" : w.oClicks >= 50 ? "Medium" : "Low",
      kind: "Query",
      item: q.q,
      where: `${SQP_WEEKS[last].label} · ${q.cat}`,
      pf: q.cat,
      d: null,
      why: `Our CVR ${pct1.format(ours * 100)}% vs market ${pct1.format(mkt * 100)}% on ${w.oClicks} clicks`,
      step: "Check listing",
      change: null,
    });
  }

  return out.sort((a, b) => RANK[a.priority] - RANK[b.priority] || (b.d ? b.d.spend + b.d.sales / 10 : 0) - (a.d ? a.d.spend + a.d.sales / 10 : 0));
}
