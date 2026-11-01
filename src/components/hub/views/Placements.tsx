"use client";

import { useMemo, type CSSProperties } from "react";
import { PLACES, placeRows } from "@/lib/hub";
import { acosD, addDay, cpcD, cvrD, zeroDay } from "@/lib/account";
import { eur2, pct1 } from "@/lib/format";
import CountUp from "../../CountUp";
import { useHub } from "../HubContext";
import { View } from "../HubTable";
import Tree, { group } from "./Tree";
import st from "../hub.module.css";

export default function Placements() {
  const hub = useHub();
  const rows = hub.scope(useMemo(() => placeRows(hub.period), [hub.period]));

  const per = PLACES.map((p) => ({ p, d: rows.filter((r) => r.place === p).reduce((a, r) => addDay(a, r.d), zeroDay()) }));
  const totSpend = per.reduce((a, x) => a + x.d.spend, 0);
  const nodes = PLACES.map((p) =>
    group(
      p,
      p,
      rows.filter((r) => r.place === p && r.d.impr > 0).map((r) => ({ id: r.key, label: r.campaign, sub: r.pf, d: r.d, count: 1 })),
    ),
  ).filter((n) => n.count > 0);

  return (
    <View>
      <section className="panel" aria-label="Spend by placement">
        <div key={`${hub.period}${rows.length}`} className={st.tiles} style={{ "--cols": 3 } as CSSProperties}>
          {per.map(({ p, d }, i) => {
            const a = acosD(d);
            const c = cvrD(d);
            const cpc = cpcD(d);
            return (
              <div key={p} className={st.tile} style={{ "--i": i } as CSSProperties}>
                <span className={st.tl}>{p}</span>
                <span className={st.tv}>
                  <CountUp value={d.spend} kind="eur" />
                </span>
                <span className={st.td}>
                  {totSpend ? `${pct1.format((d.spend / totSpend) * 100)}% of spend` : "no spend"} · ACOS {a === null ? "—" : `${pct1.format(a)}%`} · CVR {c === null ? "—" : `${pct1.format(c)}%`} · CPC {cpc === null ? "—" : eur2.format(cpc)}
                </span>
                <span className={st.share} style={{ width: "100%", marginLeft: 0, marginTop: 8 }}>
                  <i style={{ "--w": totSpend ? d.spend / totSpend : 0 } as CSSProperties} />
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <Tree
        id="placements"
        title="Placements by campaign"
        countLabel="Campaigns"
        depth0={0}
        info={<p>Sponsored Products only: Amazon reports placements for Sponsored Brands without orders, so they are left out. Open a placement to see how each campaign does there.</p>}
        nodes={nodes}
      />
    </View>
  );
}
