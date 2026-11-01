"use client";

import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { account } from "@/lib/account";
import { PERIODS, periodRange, prevRange } from "@/lib/hub";
import { cx } from "@/lib/cx";
import { useReveal } from "@/lib/motion";
import Segmented from "../Segmented";
import Select from "../Select";
import d from "../dash.module.css";
import { HubProvider, NO_FILTERS, useHub, type Filters } from "./HubContext";
import { viewBy } from "./views";
import st from "./hub.module.css";

const ALL_PF = "All portfolios";
const ALL_C = "All campaigns";
const ALL_AG = "All ad groups";

function Bar() {
  const { f, setF } = useHub();
  const [more, setMore] = useState(!!(f.minSpend || f.minClicks || f.minOrders || f.maxAcos));
  const set = (patch: Partial<Filters>) => setF({ ...f, ...patch });
  const pfs = useMemo(() => Array.from(new Set(account.campaigns.map((c) => c.portfolio))), []);
  const camps = account.campaigns.filter((c) => !f.pf || c.portfolio === f.pf).map((c) => c.name);
  const ags = Array.from(new Set(account.targets.filter((t) => t.campaign === f.campaign).map((t) => t.adGroup)));
  const active = (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter((k) => f[k] !== NO_FILTERS[k]).length;

  return (
    <div className={st.fbar}>
      <div className={st.frow}>
        <Select label="Portfolio" value={f.pf || ALL_PF} options={[ALL_PF, ...pfs]} onChange={(v) => set({ pf: v === ALL_PF ? "" : v, campaign: "", adGroup: "" })} />
        <Select label="Campaign" value={f.campaign || ALL_C} options={[ALL_C, ...camps]} onChange={(v) => set({ campaign: v === ALL_C ? "" : v, adGroup: "" })} />
        {f.campaign ? <Select label="Ad group" value={f.adGroup || ALL_AG} options={[ALL_AG, ...ags]} onChange={(v) => set({ adGroup: v === ALL_AG ? "" : v })} /> : null}
        <Segmented label="Ad type" size="sm" value={f.type} onChange={(v) => set({ type: v })} options={["all", "SP", "SB", "SD"].map((v) => ({ value: v, label: v === "all" ? "All" : v }))} />
        <input type="search" className={st.search} value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Contains…" aria-label="Rows containing" />
        <button type="button" className={cx("btn sm", st.moreBtn)} aria-expanded={more} onClick={() => setMore(!more)}>
          More filters
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {active ? (
          <button type="button" className={st.reset} onClick={() => setF(NO_FILTERS)}>
            Reset {active} filter{active === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
      <div className={cx(st.more, more && st.open)} inert={!more}>
        <div className={st.moreIn}>
          {(
            [
              ["minSpend", "Min spend €"],
              ["minClicks", "Min clicks"],
              ["minOrders", "Min orders"],
              ["maxAcos", "Max ACOS %"],
            ] as [keyof Filters, string][]
          ).map(([k, label]) => (
            <label key={k} className={st.numF}>
              <span>{label}</span>
              <input inputMode="decimal" value={f[k]} onChange={(e) => set({ [k]: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="any" />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function Head() {
  const slug = usePathname().split("/").filter(Boolean)[1] ?? "home";
  const v = viewBy(slug);
  const { period, setPeriod } = useHub();
  if (!v) return null;
  return (
    <>
      <header className={d["pg-head"]}>
        <div className="pg-title">
          <div className={d["pg-h"]}>
            <h1>{v.title}</h1>
            {v.period !== false ? (
              <span key={period} className={d["pg-kw"]}>
                {period === "7d" ? "7 days" : "30 days"}
                <small>
                  {periodRange(period)}
                  {period === "7d" ? ` · vs ${prevRange()}` : ""}
                </small>
              </span>
            ) : null}
          </div>
          <p className={d.meta}>Amazon.de · EUR · {v.about}</p>
        </div>
        {v.period !== false ? (
          <div className={d["pg-ctl"]}>
            <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS} />
          </div>
        ) : null}
      </header>
      {v.bar !== false ? <Bar /> : null}
    </>
  );
}

export default function HubShell({ children }: { children: ReactNode }) {
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);
  return (
    <HubProvider>
      <div className="wdp" ref={page}>
        <Head />
        {children}
      </div>
    </HubProvider>
  );
}
