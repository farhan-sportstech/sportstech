"use client";

import { useMemo } from "react";
import { PF_CAP, campRows, type Base } from "@/lib/hub";
import { account, addDay, zeroDay, type AdType } from "@/lib/account";
import { eur, int } from "@/lib/format";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import { Tag } from "../cells";

type PfRow = Base & { nCamps: number; budgets: number; cap: number | null };

export default function Portfolios() {
  const hub = useHub();
  const rows = useMemo(() => {
    const camps = hub.scope(campRows(hub.period));
    const by = new Map<string, typeof camps>();
    for (const c of camps) by.set(c.pf, [...(by.get(c.pf) ?? []), c]);
    return [...by.entries()].map(
      ([pf, cs]): PfRow => ({
        key: pf,
        pf,
        campaignId: "",
        campaign: "",
        adGroup: "",
        type: "SP" as AdType,
        d: cs.reduce((a, c) => addDay(a, c.d), zeroDay()),
        prev: hub.period === "7d" ? cs.reduce((a, c) => addDay(a, c.prev ?? zeroDay()), zeroDay()) : null,
        nCamps: cs.length,
        budgets: account.campaigns.filter((c) => c.portfolio === pf && c.state === "ENABLED").reduce((a, c) => a + c.budget, 0),
        cap: PF_CAP[pf],
      }),
    );
  }, [hub]);

  const cols: Col<PfRow>[] = [
    { key: "pf", label: "Portfolio", name: true, get: (r) => r.pf },
    { key: "nCamps", label: "Campaigns", num: true, get: (r) => r.nCamps, fmt: (v) => int.format(v) },
    { key: "budgets", label: "Σ daily budgets", sub: "enabled campaigns", num: true, get: (r) => r.budgets, fmt: (v) => eur.format(v) },
    { key: "cap", label: "Portfolio cap", sub: "per day", num: true, get: (r) => r.cap, fmt: (v) => eur.format(v) },
    {
      key: "inBudget",
      label: "In budget",
      get: (r) => (r.cap === null ? "No cap" : r.budgets <= r.cap ? "Yes" : "No"),
      render: (r) => (r.cap === null ? <span className="na">no cap</span> : r.budgets <= r.cap ? <Tag tone="good">Yes</Tag> : <Tag tone="warn">Over by {eur.format(r.budgets - r.cap)}</Tag>),
    },
  ];

  return (
    <View>
      <HubTable
        id="portfolios"
        title="By portfolio"
        info={<p>Portfolios follow the product categories. Σ daily budgets adds up the budgets of enabled campaigns; when it exceeds the portfolio cap, Amazon stops the campaigns once the cap is spent.</p>}
        rows={rows}
        cols={cols}
        deltas={hub.period === "7d"}
      />
    </View>
  );
}
