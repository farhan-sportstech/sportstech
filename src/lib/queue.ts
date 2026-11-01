"use client";

// Pending changes and change history. Until the tool4seller backend exists both live in this browser's storage,
// read through an external-store subscription so the sidebar badge, the hub and the Changes pages stay in step.
import { useSyncExternalStore } from "react";

export type Action = "targeting.bid" | "campaign.budget" | "campaign.state" | "adgroup.state" | "targeting.state" | "productad.state" | "targeting.create" | "targeting.create.negative";
export const ACTION_LABEL: Record<Action, string> = {
  "targeting.bid": "Change bid",
  "campaign.budget": "Change budget",
  "campaign.state": "Pause / enable campaign",
  "adgroup.state": "Pause / enable ad group",
  "targeting.state": "Pause / enable target",
  "productad.state": "Pause / enable product ad",
  "targeting.create": "Add keyword / target",
  "targeting.create.negative": "Add negative",
};
// which tool4seller call prepares each action; a plan groups up to 20 changes of one tool
export const ACTION_TOOL: Record<Action, string> = {
  "targeting.bid": "prepare_update_keyword_bids",
  "campaign.budget": "prepare_update_campaign_budgets",
  "campaign.state": "prepare_update_campaign_states",
  "adgroup.state": "prepare_update_adgroup_states",
  "targeting.state": "prepare_update_keyword_states",
  "productad.state": "prepare_update_product_ad_states",
  "targeting.create": "prepare_create_keywords",
  "targeting.create.negative": "prepare_create_negative_keywords",
};

/** current / proposed: a number (bid, budget), a state, or for create actions "MATCH|bid" */
export type Change = {
  id: string;
  action: Action;
  source: string;
  queuedAt: string;
  campaign: string;
  adGroup: string;
  entity: string;
  current: string | number | null;
  proposed: string | number;
};
export type Applied = { id: string; appliedAt: string; planId: string; tool: string; status: "applied" | "error"; changes: Change[]; note: string };

export const QUEUE_MAX = 50;
const QK = "wd:queue";
const HK = "wd:history";
const EVT = "wd:queue";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
};
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // storage blocked: nothing is kept
  }
  window.dispatchEvent(new Event(EVT));
};
// parse once per raw string so the snapshot keeps its identity between renders
const memo = new Map<string, unknown>();
function parse<T>(raw: string | null, empty: T): T {
  if (!raw) return empty;
  if (!memo.has(raw)) {
    try {
      memo.set(raw, JSON.parse(raw));
    } catch {
      memo.set(raw, empty);
    }
  }
  return memo.get(raw) as T;
}
const EMPTY_Q: Change[] = [];
const EMPTY_H: Applied[] = [];

export function useQueue() {
  const raw = useSyncExternalStore(subscribe, () => read(QK), () => null);
  return parse<Change[]>(raw, EMPTY_Q);
}
export function useHistory() {
  const raw = useSyncExternalStore(subscribe, () => read(HK), () => null);
  return parse<Applied[]>(raw, EMPTY_H);
}

const now = () => new Date().toISOString();
const getQ = () => parse<Change[]>(read(QK), EMPTY_Q);

/** Same entity and action replaces the earlier entry, so a re-click edits rather than duplicates. */
export function enqueue(c: Omit<Change, "id" | "queuedAt">): "queued" | "full" {
  const q = getQ();
  const same = (x: Change) => x.action === c.action && x.campaign === c.campaign && x.adGroup === c.adGroup && x.entity === c.entity;
  const rest = q.filter((x) => !same(x));
  if (rest.length >= QUEUE_MAX) return "full";
  write(QK, [...rest, { ...c, id: `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, queuedAt: now() }]);
  return "queued";
}
export const isQueued = (q: Change[], action: Action, campaign: string, adGroup: string, entity: string) => q.some((x) => x.action === action && x.campaign === campaign && x.adGroup === adGroup && x.entity === entity);
export const updateChange = (id: string, proposed: string | number) => write(QK, getQ().map((x) => (x.id === id ? { ...x, proposed } : x)));
export const removeChange = (id: string) => write(QK, getQ().filter((x) => x.id !== id));
export const clearQueue = () => write(QK, []);

export type Plan = { tool: string; changes: Change[] };
export function plansOf(q: Change[]): Plan[] {
  const by = new Map<string, Change[]>();
  for (const c of q) by.set(ACTION_TOOL[c.action], [...(by.get(ACTION_TOOL[c.action]) ?? []), c]);
  const out: Plan[] = [];
  for (const [tool, cs] of by) for (let i = 0; i < cs.length; i += 20) out.push({ tool, changes: cs.slice(i, i + 20) });
  return out;
}

/** Demo send: records each plan in the history and empties the queue. Nothing reaches Amazon. */
export function sendDemo(plans: Plan[]) {
  const h = parse<Applied[]>(read(HK), EMPTY_H);
  const stamp = now();
  const add = plans.map((p, i) => ({ id: `h${Date.now().toString(36)}${i}`, appliedAt: stamp, planId: `demo-${Date.now().toString(36)}-${i + 1}`, tool: p.tool, status: "applied" as const, changes: p.changes, note: "Demo mode: recorded here only, not sent to Amazon" }));
  write(HK, [...add, ...h]);
  write(QK, []);
}

/** What the change touches, without repeating the campaign name for campaign-level changes. */
export const entityOf = (c: Change) => (c.entity === c.campaign ? "Campaign" : c.entity);

export const fmtValue =(c: Change, v: string | number | null) => {
  if (v === null || v === "") return "—";
  if (c.action === "targeting.bid" || c.action === "campaign.budget") return `€${Number(v).toFixed(2).replace(".", ",")}`;
  if (c.action === "targeting.create" || c.action === "targeting.create.negative") {
    const [m, b] = String(v).split("|");
    return b ? `${m} · €${Number(b).toFixed(2).replace(".", ",")}` : m;
  }
  return String(v);
};
