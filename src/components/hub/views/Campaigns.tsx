"use client";

import { useMemo, useState } from "react";
import { campRows, type CampRow } from "@/lib/hub";
import { eur, eur2, int, pct1 } from "@/lib/format";
import { acosD } from "@/lib/account";
import Switch from "../../Switch";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import QueueButton from "../QueueButton";
import { StateTag, Tag, useBaseCols } from "../cells";

export default function Campaigns() {
  const hub = useHub();
  const bc = useBaseCols();
  const [hide, setHide] = useState(true);
  const all = useMemo(() => campRows(hub.period), [hub.period]);
  const rows = hub.scope(all, (r) => r.strategy).filter((r) => !hide || r.d.impr > 0);

  const cols: Col<CampRow>[] = [
    { ...bc.campaign<CampRow>(true), label: "Campaign" },
    bc.type<CampRow>(),
    bc.pf<CampRow>(),
    { key: "state", label: "State", get: (r) => r.state, render: (r) => <StateTag s={r.state} /> },
    { key: "budget", label: "Daily budget", num: true, get: (r) => r.budget, fmt: (v) => eur.format(v) },
    {
      key: "used",
      label: "Budget used",
      sub: "avg, last 7 days",
      num: true,
      get: (r) => r.used,
      render: (r) => (r.used >= 90 ? <Tag tone="warn">{pct1.format(r.used)}%</Tag> : `${pct1.format(r.used)}%`),
    },
    { key: "bidding", label: "Bidding", get: (r) => r.bidding },
    { key: "targeting", label: "Targeting", get: (r) => r.targeting },
    { key: "nTargets", label: "Targets", num: true, get: (r) => r.nTargets, fmt: (v) => int.format(v) },
  ];

  return (
    <View>
      <HubTable
        id="campaigns"
        title="Campaigns"
        info={
          <>
            <p>Every campaign in the account. Budget used is the average daily spend of the last 7 days against today&apos;s daily budget. Click a campaign to open its ad groups.</p>
            <p>Queue buttons put a change into Pending changes; nothing reaches Amazon until it is sent from there.</p>
          </>
        }
        lead={`${all.filter((r) => r.d.impr > 0).length} with impressions`}
        rows={rows}
        cols={cols}
        deltas={hub.period === "7d"}
        tabs={[
          { label: "Enabled + paused", test: () => true },
          { label: "Enabled", test: (r) => r.state === "ENABLED" },
          { label: "Paused", test: (r) => r.state === "PAUSED" },
        ]}
        chips={[
          { label: "Spend no sales", test: (r) => r.d.spend >= 50 && r.d.orders === 0 },
          { label: "High ACOS", test: (r) => (acosD(r.d) ?? 0) > 50 },
          { label: "Budget capped", test: (r) => r.used >= 90 },
          { label: "Top sellers", test: (r) => r.d.orders >= 10 },
        ]}
        tools={
          <Switch checked={hide} onChange={setHide}>
            Hide rows with no impressions
          </Switch>
        }
        actions={(r) => (
          <>
            <QueueButton source="campaigns" label={r.state === "ENABLED" ? "Pause" : "Enable"} change={{ action: "campaign.state", campaign: r.campaign, adGroup: "", entity: r.campaign, current: r.state, proposed: r.state === "ENABLED" ? "PAUSED" : "ENABLED" }} />
            {r.used >= 90 ? <QueueButton source="campaigns" label={`Budget ${eur2.format(Math.round(r.budget * 1.2))}`} change={{ action: "campaign.budget", campaign: r.campaign, adGroup: "", entity: r.campaign, current: r.budget, proposed: Math.round(r.budget * 1.2) }} /> : null}
          </>
        )}
      />
    </View>
  );
}
