"use client";

import { useMemo } from "react";
import { isAsin, isBranded, termRows, type TermRow } from "@/lib/hub";
import { acosD, cpcD } from "@/lib/account";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import QueueButton from "../QueueButton";
import { useBaseCols } from "../cells";

export default function SearchTerms() {
  const hub = useHub();
  const bc = useBaseCols();
  const all = useMemo(() => termRows(hub.period), [hub.period]);
  const rows = hub.scope(all, (r) => `${r.term} ${r.target}`);

  const cols: Col<TermRow>[] = [
    { key: "term", label: "Search term", name: true, get: (r) => r.term },
    bc.type<TermRow>(),
    { key: "target", label: "Keyword / target", get: (r) => r.target },
    { key: "match", label: "Match", get: (r) => (r.match === "PAT" ? "Product" : r.match) },
    { ...bc.campaign<TermRow>(true) },
    bc.adGroup<TermRow>(),
    bc.pf<TermRow>(),
  ];

  return (
    <View>
      <HubTable
        id="search-terms"
        title="All search terms"
        info={
          <>
            <p>What shoppers searched before clicking an ad, and the keyword or target that caught it.</p>
            <p>The search-term report holds the top 6.000 terms by spend, so smaller terms aren&apos;t listed.</p>
          </>
        }
        lead="top 6.000 by spend"
        rows={rows}
        cols={cols}
        tabs={[
          { label: "All", test: () => true },
          { label: "Converting", test: (r) => r.d.orders > 0 },
          { label: "No orders", test: (r) => r.d.orders === 0 },
        ]}
        chips={[
          { label: "Spend no sales", test: (r) => r.d.spend >= 20 && r.d.orders === 0 },
          { label: "High ACOS", test: (r) => (acosD(r.d) ?? 0) > 50 },
          { label: "Expensive clicks", test: (r) => (cpcD(r.d) ?? 0) > 2.5 },
          { label: "ASINs", test: (r) => isAsin(r.term) },
          { label: "Branded", test: (r) => isBranded(r.term) },
        ]}
        actions={(r) => (
          <>
            <QueueButton source="search-terms" label="Add negative" change={{ action: "targeting.create.negative", campaign: r.campaign, adGroup: r.adGroup, entity: r.term, current: null, proposed: "EXACT" }} />
            {r.match !== "Exact" && r.d.orders > 0 ? <QueueButton source="search-terms" label="Add as Exact" change={{ action: "targeting.create", campaign: r.campaign, adGroup: r.adGroup, entity: r.term, current: null, proposed: `EXACT|${(cpcD(r.d) ?? 0.5).toFixed(2)}` }} /> : null}
          </>
        )}
      />
    </View>
  );
}
