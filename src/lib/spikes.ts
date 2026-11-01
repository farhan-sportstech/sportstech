import { DAYS, account, acosD, sumDays, type Campaign } from "./account";

export const RULES = ["Spend spike", "ACOS spike", "Spend, no sales", "Budget capped", "Sales drop"] as const;
export type Rule = (typeof RULES)[number];
export const RULE_TEXT: Record<Rule, string> = {
  "Spend spike": "Spend on the day is at least 2× the daily average of the 14 days before, and at least €15.",
  "ACOS spike": "ACOS on the day is at least 1.5× the 14-day ACOS and 10 points higher, with at least €15 spend.",
  "Spend, no sales": "€25 or more spent on the day without an order, by a campaign that sold on at least 7 of the 14 days before.",
  "Budget capped": "Spend reached 95% of the daily budget on 3 or more of the 7 days up to the day.",
  "Sales drop": "Ad sales in the 7 days up to the day are 30% or more below the 7 days before (from at least €300).",
};

export type Alert = {
  key: string;
  rule: Rule;
  c: Campaign;
  /** what happened on the day, and the baseline it is compared against */
  now: number;
  base: number;
  unit: "eur" | "pct" | "days";
  /** euros at stake: excess spend, wasted spend or lost sales; ranks the list */
  impact: number;
  high: boolean;
  spark: number[];
};

/** Every alert raised on day `d` (0 = the newest day). */
export function alertsFor(d: number): Alert[] {
  const out: Alert[] = [];
  for (const c of account.campaigns) {
    if (c.state !== "ENABLED") continue;
    const day = c.days[d];
    const prior = c.days.slice(d + 1, d + 15);
    if (prior.length < 14) continue;
    const base = sumDays(prior);
    const avgSpend = base.spend / 14;
    const win = c.days.slice(d, d + 14);
    // the sparkline follows what the rule is about: sales for a sales drop, spend for everything else
    const add = (rule: Rule, now: number, b: number, unit: Alert["unit"], impact: number) =>
      out.push({ key: `${c.id}${rule}`, rule, c, now, base: b, unit, impact, high: impact >= 40, spark: win.map((x) => (rule === "Sales drop" ? x.sales : x.spend)) });

    if (day.spend >= 15 && day.spend >= 2 * avgSpend) add("Spend spike", day.spend, avgSpend, "eur", day.spend - avgSpend);
    const a = acosD(day);
    const ab = acosD(base);
    if (day.spend >= 15 && a !== null && ab !== null && a >= ab * 1.5 && a - ab >= 10) add("ACOS spike", a, ab, "pct", day.spend - (day.sales * ab) / 100);
    if (day.spend >= 25 && day.orders === 0 && prior.filter((x) => x.orders > 0).length >= 7) add("Spend, no sales", day.spend, avgSpend, "eur", day.spend);
    const wk = c.days.slice(d, d + 7);
    const capped = wk.filter((x) => x.spend >= c.budget * 0.95).length;
    if (wk.length === 7 && capped >= 3) add("Budget capped", capped, 7, "days", (capped / 7) * c.budget * 0.5);
    const s7 = sumDays(wk).sales;
    const p7 = sumDays(c.days.slice(d + 7, d + 14)).sales;
    if (p7 >= 300 && s7 <= p7 * 0.7) add("Sales drop", s7, p7, "eur", p7 - s7);
  }
  return out.sort((x, y) => y.impact - x.impact);
}

export const ALERT_DAYS = DAYS.slice(0, 7);
