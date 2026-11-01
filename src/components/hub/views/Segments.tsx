"use client";

import { useMemo, useState } from "react";
import { tgtRows, type TgtRow } from "@/lib/hub";
import type { AdType } from "@/lib/account";
import Select from "../../Select";
import { useHub } from "../HubContext";
import { View } from "../HubTable";
import Tree, { group, type Node } from "./Tree";

const SHOW = ["All segments", "Sponsored Products", "Sponsored Brands", "Sponsored Display"];
const TYPE_NAME: Record<AdType, string> = { SP: "Sponsored Products", SB: "Sponsored Brands", SD: "Sponsored Display" };
const MATCH_NAME: Record<string, string> = { Exact: "Exact", Phrase: "Phrase", Broad: "Broad", Auto: "Auto targets", PAT: "Product targeting" };

// the second level depends on the ad type: targeting group for SP, ad format for SB, tactic for SD
const groupOf = (r: TgtRow) => (r.type === "SP" ? (r.match === "Auto" ? "Auto" : "Manual") : r.type === "SB" ? (/video|sbv/i.test(r.campaign) ? "Video" : "Headline & store") : "Retargeting");

export default function Segments() {
  const hub = useHub();
  const [show, setShow] = useState(SHOW[0]);
  const rows = hub.scope(
    useMemo(() => tgtRows(hub.period), [hub.period]),
    (r) => r.text,
  );

  const nodes = useMemo(() => {
    const types = (["SP", "SB", "SD"] as AdType[]).filter((t) => show === SHOW[0] || TYPE_NAME[t] === show);
    return types
      .map((t) => {
        const ofType = rows.filter((r) => r.type === t);
        const groups = Array.from(new Set(ofType.map(groupOf))).map((g) => {
          const ofGroup = ofType.filter((r) => groupOf(r) === g);
          const matches = Array.from(new Set(ofGroup.map((r) => r.match))).map((m): Node => {
            const leaf = ofGroup.filter((r) => r.match === m);
            return group(`${t}|${g}|${m}`, MATCH_NAME[m], leaf.map((r) => ({ id: r.key, label: r.text, d: r.d, count: 1 })));
          });
          // a match level is only worth a fold when it holds targets; leaves stay folded until opened
          return group(`${t}|${g}`, g, matches);
        });
        return group(t, TYPE_NAME[t], groups);
      })
      .filter((n) => n.count > 0);
  }, [rows, show]);

  return (
    <View>
      <Tree
        key={show}
        id="segments"
        title="Segments"
        countLabel="Targets"
        depth0={2}
        info={
          <>
            <p>Every target grouped by ad type, then by targeting group (Sponsored Products: manual or auto), ad format (Sponsored Brands: video or headline &amp; store, read from the campaign name) or tactic (Sponsored Display), then by match type.</p>
            <p>Open a match type to see its targets. Shares are of the total shown.</p>
          </>
        }
        nodes={nodes}
        tools={<Select label="Show" value={show} options={SHOW} onChange={setShow} />}
      />
    </View>
  );
}
