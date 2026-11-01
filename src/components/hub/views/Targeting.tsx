"use client";

import { useMemo, useState } from "react";
import { tgtRows, type TgtRow } from "@/lib/hub";
import { acosD, cpcD } from "@/lib/account";
import { eur2 } from "@/lib/format";
import Switch from "../../Switch";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import QueueButton from "../QueueButton";
import { StateTag, useBaseCols } from "../cells";

const MATCHES = ["Exact", "Phrase", "Broad", "Auto", "PAT", "Category", "Theme"] as const;

export default function Targeting() {
  const hub = useHub();
  const bc = useBaseCols();
  const [hide, setHide] = useState(true);
  const all = useMemo(() => tgtRows(hub.period), [hub.period]);
  const rows = hub.scope(all, (r) => r.text).filter((r) => !hide || r.d.impr > 0);

  const cols: Col<TgtRow>[] = [
    { key: "text", label: "Keyword / target", name: true, get: (r) => r.text },
    { key: "match", label: "Match", get: (r) => (r.match === "PAT" ? "Product" : r.match) },
    bc.type<TgtRow>(),
    { key: "state", label: "State", get: (r) => r.state, render: (r) => <StateTag s={r.state} /> },
    { key: "bid", label: "Bid", num: true, get: (r) => r.bid, fmt: (v) => eur2.format(v) },
    { ...bc.campaign<TgtRow>(true) },
    bc.adGroup<TgtRow>(),
    bc.pf<TgtRow>(),
  ];

  return (
    <View>
      <HubTable
        id="targeting"
        title="Targeting"
        info={<p>Keywords, auto targets and product targets with their current bids. Spend Δ and Sales Δ compare the latest week with the week before.</p>}
        rows={rows}
        cols={cols}
        deltas={hub.period === "7d"}
        tabs={[{ label: "All", test: () => true }, ...MATCHES.filter((m) => all.some((r) => r.match === m)).map((m) => ({ label: m === "PAT" ? "Product" : m, test: (r: TgtRow) => r.match === m }))]}
        chips={[
          { label: "Enabled", test: (r) => r.state === "ENABLED" },
          { label: "Paused", test: (r) => r.state === "PAUSED" },
          { label: "Spend no sales", test: (r) => r.d.spend >= 30 && r.d.orders === 0 },
          { label: "High ACOS", test: (r) => (acosD(r.d) ?? 0) > 50 },
          { label: "Expensive clicks", test: (r) => (cpcD(r.d) ?? 0) > 2.5 },
          { label: "Winners", test: (r) => r.d.orders >= 3 && (acosD(r.d) ?? 99) < 30 },
        ]}
        tools={
          <Switch checked={hide} onChange={setHide}>
            Hide rows with no impressions
          </Switch>
        }
        actions={(r) => <QueueButton source="targeting" label={r.state === "ENABLED" ? "Pause" : "Enable"} change={{ action: "targeting.state", campaign: r.campaign, adGroup: r.adGroup, entity: r.text, current: r.state, proposed: r.state === "ENABLED" ? "PAUSED" : "ENABLED" }} />}
      />
    </View>
  );
}
