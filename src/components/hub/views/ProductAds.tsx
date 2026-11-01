"use client";

import { useMemo, useState } from "react";
import { prodRows, type ProdRow } from "@/lib/hub";
import { acosD } from "@/lib/account";
import Switch from "../../Switch";
import { useHub } from "../HubContext";
import HubTable, { View, type Col } from "../HubTable";
import QueueButton from "../QueueButton";
import { StateTag, useBaseCols } from "../cells";

export default function ProductAds() {
  const hub = useHub();
  const bc = useBaseCols();
  const [hide, setHide] = useState(true);
  const all = useMemo(() => prodRows(hub.period), [hub.period]);
  const rows = hub.scope(all, (r) => `${r.sku} ${r.asin} ${r.product}`).filter((r) => !hide || r.d.impr > 0);

  const cols: Col<ProdRow>[] = [
    {
      key: "sku",
      label: "SKU",
      name: true,
      get: (r) => r.sku,
      render: (r) => (
        <>
          {r.sku}
          <small>{r.product}</small>
        </>
      ),
    },
    { key: "asin", label: "ASIN", get: (r) => r.asin },
    { ...bc.campaign<ProdRow>(true) },
    bc.adGroup<ProdRow>(),
    bc.pf<ProdRow>(),
    { key: "state", label: "State", get: (r) => r.state, render: (r) => <StateTag s={r.state} /> },
  ];

  return (
    <View>
      <HubTable
        id="product-ads"
        title="Product ads (SKUs)"
        info={<p>Each SKU advertised in a Sponsored Products campaign, from the advertised-product report. Sponsored Brands and Display ads aren&apos;t tied to one SKU, so they don&apos;t appear here.</p>}
        rows={rows}
        cols={cols}
        deltas={hub.period === "7d"}
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
        actions={(r) => <QueueButton source="product-ads" label={r.state === "ENABLED" ? "Pause" : "Enable"} change={{ action: "productad.state", campaign: r.campaign, adGroup: r.adGroup, entity: r.sku, current: r.state, proposed: r.state === "ENABLED" ? "PAUSED" : "ENABLED" }} />}
      />
    </View>
  );
}
