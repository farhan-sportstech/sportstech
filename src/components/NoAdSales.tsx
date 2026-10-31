"use client";

import { useState } from "react";
import { monthly, noAdSales, weekly, type NoSale } from "@/lib/mock";
import { eur, eur2, int } from "@/lib/format";
import Info from "./Info";
import Segmented from "./Segmented";
import Select from "./Select";

type View = "products" | "campaigns" | "keywords";
const sum = (a: NoSale[]) => a.reduce((t, z) => t + z.adSpend, 0);

export default function NoAdSales({ mode }: { mode: "weekly" | "monthly" }) {
  const data = mode === "weekly" ? weekly : monthly;
  const unit = mode === "weekly" ? "week" : "month";
  const options = data.periods.map((p) => `${p.kw} · ${p.label}`);
  const [picked, setPicked] = useState({ mode, i: 0 });
  const [view, setView] = useState<View>("products");
  const i = picked.mode === mode ? picked.i : 0;
  const set = noAdSales[mode][i];
  const rows = set[view];
  const total = sum(rows);

  return (
    <section id="nosales" className="panel flush" aria-labelledby="ns-h">
      <div className="ph-row between">
        <div className="ph-t">
          <h2 id="ns-h" className="ph">
            Ad spend with no ad sales
          </h2>
          <Info label="Ad spend with no ad sales">
            <p>Ad spend above €0 with €0 tool4seller ad sales in the selected {unit}.</p>
            <p>Total sales are all sales of that product (organic and ads, all channels), so a product can sell while its ads sold nothing.</p>
            <p>Campaigns are own campaigns only; shared catch-all campaigns are not split by product.</p>
          </Info>
        </div>
        <div className="filters">
          <Select label={unit === "week" ? "Week" : "Month"} value={options[i]} options={options} onChange={(v) => setPicked({ mode, i: options.indexOf(v) })} />
        </div>
      </div>
      <div className="ph-row tools">
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "products", label: `Products · ${set.products.length}` },
            { value: "campaigns", label: `Campaigns · ${set.campaigns.length}` },
            { value: "keywords", label: `Keywords · ${set.keywords.length}` },
          ]}
        />
        <p className="tot">
          <b>{eur2.format(sum(set.products) + sum(set.campaigns) + sum(set.keywords))}</b> spent with €0 ad sales this {unit}
        </p>
      </div>
      <div className="tscroll">
        <table className="ns">
          <thead>
            <tr>
              <th scope="col">{view === "products" ? "Product (child ASIN)" : view === "campaigns" ? "Campaign" : "Keyword"}</th>
              <th scope="col" className="n">
                Ad spend
              </th>
              <th scope="col" className="n">
                Ad sales
              </th>
              <th scope="col" className="n">
                Clicks
              </th>
              <th scope="col" className="n">
                Impr.
              </th>
              {view === "products" ? (
                <th scope="col" className="n">
                  Total sales
                  <small>all channels</small>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody key={`${mode}${i}${view}`} className="swap">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  None this {unit}.
                </td>
              </tr>
            ) : null}
            {rows.map((z, n) => (
              <tr key={`${z.name}${n}`}>
                <th scope="row">
                  {z.name}
                  <small>{z.sub}</small>
                </th>
                <td className="n strong">{eur2.format(z.adSpend)}</td>
                <td className="n zero">€0,00</td>
                <td className="n">{int.format(z.clicks)}</td>
                <td className="n">{int.format(z.impressions)}</td>
                {view === "products" ? <td className="n">{z.sales === null ? <span className="na">—</span> : eur.format(z.sales)}</td> : null}
              </tr>
            ))}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className="n">{eur2.format(total)}</td>
                <td className="n">€0,00</td>
                <td className="n">{int.format(rows.reduce((t, z) => t + z.clicks, 0))}</td>
                <td className="n">{int.format(rows.reduce((t, z) => t + z.impressions, 0))}</td>
                {view === "products" ? <td /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}
