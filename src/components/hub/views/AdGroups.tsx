"use client";

import { useMemo, useState } from "react";
import { agRows, type AgRow } from "@/lib/hub";
import { acosD } from "@/lib/account";
import { eur2, int } from "@/lib/format";
import Switch from "../../Switch";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import QueueButton from "../QueueButton";
import { StateTag, useBaseCols } from "../cells";

export default function AdGroups() {
  const hub = useHub();
  const bc = useBaseCols();
  const [hide, setHide] = useState(true);
  const all = useMemo(() => agRows(hub.period), [hub.period]);
  const rows = hub.scope(all).filter((r) => !hide || r.d.impr > 0);

  const cols: Col<AgRow>[] = [
    { ...bc.adGroup<AgRow>(), name: true },
    { ...bc.campaign<AgRow>(true) },
    bc.type<AgRow>(),
    bc.pf<AgRow>(),
    { key: "state", label: "State", get: (r) => r.state, render: (r) => <StateTag s={r.state} /> },
    { key: "defaultBid", label: "Default bid", num: true, get: (r) => r.defaultBid, fmt: (v) => eur2.format(v) },
    { key: "nTargets", label: "Targets", num: true, get: (r) => r.nTargets, fmt: (v) => int.format(v) },
  ];

  return (
    <View>
      <HubTable
        id="ad-groups"
        title="Ad groups"
        info={<p>Ad groups with their targets summed. The default bid is the median bid of the group&apos;s targets. Click an ad group to open its targets, or a campaign to narrow to it.</p>}
        rows={rows}
        cols={cols}
        deltas={hub.period === "7d"}
        tabs={[
          { label: "Enabled + paused", test: () => true },
          { label: "Enabled", test: (r) => r.state === "ENABLED" },
          { label: "Paused", test: (r) => r.state === "PAUSED" },
        ]}
        chips={[
          { label: "Spend no sales", test: (r) => r.d.spend >= 30 && r.d.orders === 0 },
          { label: "High ACOS", test: (r) => (acosD(r.d) ?? 0) > 50 },
          { label: "Converting", test: (r) => r.d.orders > 0 },
        ]}
        tools={
          <Switch checked={hide} onChange={setHide}>
            Hide rows with no impressions
          </Switch>
        }
        actions={(r) => <QueueButton source="ad-groups" label={r.state === "ENABLED" ? "Pause" : "Enable"} change={{ action: "adgroup.state", campaign: r.campaign, adGroup: r.adGroup, entity: r.adGroup, current: r.state, proposed: r.state === "ENABLED" ? "PAUSED" : "ENABLED" }} />}
      />
    </View>
  );
}
