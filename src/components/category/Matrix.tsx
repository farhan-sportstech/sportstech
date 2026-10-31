"use client";

import { useState } from "react";
import type { CategoryData, Mode } from "@/lib/category";
import { cx } from "@/lib/cx";
import Info from "../Info";
import Segmented from "../Segmented";
import Select from "../Select";
import { SCOPE_METRICS, fmtCell } from "@/lib/metrics";
import ov from "./Overall.module.css";

/** Every metric across the periods for one scope: the whole category, a family, or a single product. */
export default function Matrix({ data, family, mode }: { data: CategoryData; family: string; mode: Mode }) {
  const [depth, setDepth] = useState<"key" | "all">("key");
  const [scope, setScope] = useState("");
  const periods = data.periods[mode];

  const inFamily = data.pick(family);
  const options = [
    { label: family ? `All ${family.toLowerCase()}` : `All ${data.def.plural}`, value: "" },
    ...(family ? [] : (data.families.length > 1 ? data.families : []).map((f) => ({ label: f.name, value: f.name }))),
    ...inFamily.map((p) => ({ label: p.name, value: `asin:${p.asin}` })),
  ];
  // a scope from another family filter falls back to the whole selection
  const active = options.some((o) => o.value === scope) ? scope : "";
  const rows = data.totals(active || family, mode);
  const metrics = depth === "key" ? SCOPE_METRICS.filter((m) => m.key2) : SCOPE_METRICS;

  return (
    <section id="matrix" className="panel flush" aria-labelledby="mx-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="mx-h" className="ph">
            Weekly matrix
          </h2>
          <Info label="Weekly matrix">
            <p>Every metric across the five periods for the selected scope.</p>
            <p>Ad spend is split into own campaigns (campaigns that advertise only this category) and shared campaigns (account-wide catch-alls). Keyword, search-term and placement sections cover own campaigns only, because shared campaigns cannot be attributed to one product.</p>
          </Info>
        </div>
        <div className="filters">
          <Select label="Scope" value={options.find((o) => o.value === active)!.label} options={options.map((o) => o.label)} onChange={(v) => setScope(options.find((o) => o.label === v)!.value)} />
          <Segmented
            label="Metrics"
            size="sm"
            value={depth}
            onChange={setDepth}
            options={[
              { value: "key", label: "Key metrics" },
              { value: "all", label: "All metrics" },
            ]}
          />
        </div>
      </div>
      <div className="tscroll">
        <table className={ov.oa}>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              {periods.map((p, i) => (
                <th key={p.key} scope="col" className={i === 0 ? "n cur" : "n"}>
                  {p.kw}
                  <small>{p.label}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={`${active}${depth}${mode}${family}`} className="swap">
            {metrics.map((m) => (
              <tr key={m.key} className={cx(m.level && ov.sub, m.strong && ov.strong)}>
                <th scope="row">{m.label}</th>
                {rows.map((r, i) => (
                  <td key={i} className={i === 0 ? "n cur" : "n"}>
                    {fmtCell(m, r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
