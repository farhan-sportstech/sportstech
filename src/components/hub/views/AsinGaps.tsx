"use client";

import { useMemo } from "react";
import { gapRows, type GapRow } from "@/lib/hub";
import { acosD, cpcD } from "@/lib/account";
import { int } from "@/lib/format";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import QueueButton from "../QueueButton";
import { Tag, useBaseCols } from "../cells";

export default function AsinGaps() {
  const hub = useHub();
  const bc = useBaseCols();
  const all = useMemo(() => gapRows(hub.period).filter((r) => r.asin), [hub.period]);
  const rows = hub.scope(all, (r) => r.term);

  const cols: Col<GapRow>[] = [
    {
      key: "term",
      label: "ASIN",
      name: true,
      get: (r) => r.term.toUpperCase(),
      render: (r) => (
        <a className="lnk" href={`https://www.amazon.de/dp/${r.term.toUpperCase()}`} target="_blank" rel="noopener noreferrer" title="Open the product page on Amazon.de">
          {r.term.toUpperCase()}
        </a>
      ),
    },
    { key: "nCamps", label: "Campaigns", num: true, get: (r) => r.nCamps, fmt: (v) => int.format(v) },
    { ...bc.campaign<GapRow>(true), label: "Main campaign" },
    bc.pf<GapRow>(),
    { key: "targeted", label: "Targeted as product", get: (r) => (r.targetedAsProduct ? "Yes" : "No"), render: (r) => (r.targetedAsProduct ? <Tag tone="good">Yes</Tag> : <span className="na">no</span>) },
  ];

  return (
    <View>
      <HubTable
        id="asin-gaps"
        title="ASIN gaps"
        info={<p>Search terms that are product codes: our ads showed on these product pages, mostly through auto targeting. A converting ASIN that isn&apos;t targeted as a product is a candidate for a product target; one that only spends is a candidate for a negative.</p>}
        lead={`${all.filter((r) => r.targetedAsProduct).length} already targeted as products`}
        rows={rows}
        cols={cols}
        deltas={hub.period === "7d"}
        sort={{ key: "spend", dir: -1 }}
        tabs={[
          { label: "All ASINs", test: () => true },
          { label: "Not targeted", test: (r) => !r.targetedAsProduct },
        ]}
        chips={[
          { label: "Converting", test: (r) => r.d.orders > 0 },
          { label: "Spend no sales", test: (r) => r.d.spend >= 30 && r.d.orders === 0 },
          { label: "High ACOS", test: (r) => (acosD(r.d) ?? 0) > 50 },
          { label: "Expensive clicks", test: (r) => (cpcD(r.d) ?? 0) > 2.5 },
        ]}
        actions={(r) => (
          <>
            {!r.targetedAsProduct && r.d.orders > 0 ? <QueueButton source="asin-gaps" label="Target ASIN" change={{ action: "targeting.create", campaign: r.campaign, adGroup: r.adGroup, entity: r.term.toUpperCase(), current: null, proposed: `PAT|${(cpcD(r.d) ?? 0.5).toFixed(2)}` }} /> : null}
            <QueueButton source="asin-gaps" label="Negative ASIN" change={{ action: "targeting.create.negative", campaign: r.campaign, adGroup: r.adGroup, entity: r.term.toUpperCase(), current: null, proposed: "PAT" }} />
          </>
        )}
      />
    </View>
  );
}
