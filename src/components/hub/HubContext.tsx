"use client";

import { createContext, useContext, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { acosD } from "@/lib/account";
import type { Base, Period } from "@/lib/hub";

export type Filters = { pf: string; campaign: string; adGroup: string; type: string; q: string; minSpend: string; minClicks: string; minOrders: string; maxAcos: string };
export const NO_FILTERS: Filters = { pf: "", campaign: "", adGroup: "", type: "all", q: "", minSpend: "", minClicks: "", minOrders: "", maxAcos: "" };
export const METRIC_DEFAULT = ["clicks", "orders", "spend", "sales", "acos", "cpc", "cvr"];

type Hub = {
  period: Period;
  setPeriod: (p: Period) => void;
  f: Filters;
  setF: (f: Filters) => void;
  /** target ACOS in %, shared by Improvements, Bid optimizer and N-grams */
  target: number;
  setTarget: (n: number) => void;
  metrics: string[];
  setMetrics: (m: string[]) => void;
  /** rows passing the shared filter bar */
  scope: <R extends Base>(rows: R[], text?: (r: R) => string) => R[];
};

const Ctx = createContext<Hub | null>(null);
export const useHub = () => useContext(Ctx)!;

// lives in the hub layout, so filters and settings carry over while moving between views
export function HubProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>("7d");
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [target, setTarget] = useState(30);
  const [metrics, setMetrics] = useState(METRIC_DEFAULT);
  const q = useDeferredValue(f.q);

  const value = useMemo<Hub>(() => {
    const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
    const minSpend = num(f.minSpend);
    const minClicks = num(f.minClicks);
    const minOrders = num(f.minOrders);
    const maxAcos = num(f.maxAcos);
    const needle = q.trim().toLowerCase();
    const scope = <R extends Base>(rows: R[], text?: (r: R) => string) =>
      rows.filter((r) => {
        if (f.pf && r.pf !== f.pf) return false;
        if (f.campaign && r.campaign !== f.campaign) return false;
        if (f.adGroup && r.adGroup !== f.adGroup) return false;
        if (f.type !== "all" && r.type !== f.type) return false;
        if (minSpend !== null && r.d.spend < minSpend) return false;
        if (minClicks !== null && r.d.clicks < minClicks) return false;
        if (minOrders !== null && r.d.orders < minOrders) return false;
        if (maxAcos !== null) {
          const a = acosD(r.d);
          if (a === null || a > maxAcos) return false;
        }
        if (needle && !`${r.campaign} ${r.adGroup} ${text ? text(r) : ""}`.toLowerCase().includes(needle)) return false;
        return true;
      });
    return { period, setPeriod, f, setF, target, setTarget, metrics, setMetrics, scope };
  }, [period, f, q, target, metrics]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
