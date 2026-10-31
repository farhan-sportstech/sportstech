"use client";

import type { Period } from "@/lib/mock";
import type { OverallRow } from "@/lib/category";
import { change } from "@/lib/format";
import { cx } from "@/lib/cx";
import Delta from "../Delta";
import Info from "../Info";
import { SCOPE_METRICS, fmtCell } from "@/lib/metrics";
import st from "./Overall.module.css";

/** Every scope metric, one row each, periods across. The ad-spend total is split into own and shared campaigns
 *  underneath; Sponsored Brands sits on its own line because Amazon reports it per campaign, not per ASIN. */
export default function Overall({ title, periods, rows, mode }: { title: string; periods: Period[]; rows: OverallRow[]; mode: string }) {
  return (
    <section id="overall" className="panel flush" aria-labelledby="oa-h">
      <div className="ph-row">
        <div className="ph-t">
          <h2 id="oa-h" className="ph">
            {title} · overall
          </h2>
          <Info label="Overall">
            <p>Every product in scope, per period. The Ad spend total includes the catch-all and shared-campaign spend that landed on these ASINs, split out underneath rather than hidden.</p>
            <p>Sponsored Brands sits on its own line because Amazon publishes no per-ASIN report for it, so it is not part of the total.</p>
          </Info>
        </div>
      </div>
      <div className="tscroll">
        <table className={st.oa}>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              {periods.map((p, i) => (
                <th key={p.key} scope="col" className={i === 0 ? "n cur" : "n"}>
                  {p.kw}
                  <small>{p.label}</small>
                </th>
              ))}
              <th scope="col" className="n">
                vs {periods[1].kw}
              </th>
            </tr>
          </thead>
          <tbody key={mode + title} className="swap">
            {SCOPE_METRICS.map((m) => {
              const a = m.get(rows[0]);
              const b = m.get(rows[1]);
              return (
                <tr key={m.key} className={cx(m.level && st.sub, m.strong && st.strong)}>
                  <th scope="row">{m.label}</th>
                  {rows.map((r, i) => (
                    <td key={i} className={i === 0 ? "n cur" : "n"}>
                      {fmtCell(m, r)}
                    </td>
                  ))}
                  <td className="n">
                    {a === null || b === null ? (
                      <span className="na">—</span>
                    ) : (
                      <Delta value={m.ratio ? a - b : change(a, b)} unit={m.ratio ? " pp" : "%"} goodWhen={m.good} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
