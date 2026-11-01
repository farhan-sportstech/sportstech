"use client";

import { useRouter } from "next/navigation";
import type { State } from "@/lib/account";
import type { Base } from "@/lib/hub";
import { cx } from "@/lib/cx";
import { useHub } from "./HubContext";
import type { Col } from "./HubTable";
import st from "./hub.module.css";

/** Drill-down: a campaign opens its ad groups, an ad group opens its targets. */
export function useDrill() {
  const { f, setF } = useHub();
  const router = useRouter();
  return {
    campaign: (r: Base) => {
      setF({ ...f, pf: r.pf, campaign: r.campaign, adGroup: "" });
      router.push("/hub/ad-groups/");
    },
    adGroup: (r: Base) => {
      setF({ ...f, pf: r.pf, campaign: r.campaign, adGroup: r.adGroup });
      router.push("/hub/targeting/");
    },
  };
}

export const StateTag = ({ s }: { s: State }) => <span className={cx(st.tag, s === "ENABLED" ? st.good : st.warn)}>{s === "ENABLED" ? "Enabled" : "Paused"}</span>;
export const Tag = ({ tone, children }: { tone?: "good" | "bad" | "warn" | "accent"; children: React.ReactNode }) => <span className={cx(st.tag, tone && st[tone])}>{children}</span>;

export function useBaseCols() {
  const drill = useDrill();
  return {
    campaign: <R extends Base>(name = false): Col<R> => ({
      key: "campaign",
      label: "Campaign",
      name,
      get: (r) => r.campaign,
      render: (r) => (
        <button type="button" className="lnk" onClick={() => drill.campaign(r)} title="Open its ad groups">
          {r.campaign}
        </button>
      ),
    }),
    adGroup: <R extends Base>(): Col<R> => ({
      key: "adGroup",
      label: "Ad group",
      get: (r) => r.adGroup,
      render: (r) => (
        <button type="button" className="lnk" onClick={() => drill.adGroup(r)} title="Open its targets">
          {r.adGroup}
        </button>
      ),
    }),
    pf: <R extends Base>(): Col<R> => ({ key: "pf", label: "Portfolio", get: (r) => r.pf }),
    type: <R extends Base>(): Col<R> => ({ key: "type", label: "Ad type", get: (r) => r.type }),
  };
}
