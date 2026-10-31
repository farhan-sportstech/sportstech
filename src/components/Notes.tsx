"use client";

import { useRef } from "react";
import { meta } from "@/lib/mock";
import st from "./Notes.module.css";

const TERMS: [string, string][] = [
  ["ACOS", "Ad spend divided by sales that Amazon attributes to ads. Lower is better."],
  ["TACoS", "Ad spend divided by total product sales, ads and organic together. Shows how much of revenue goes to advertising."],
  ["Organic", "Total sales minus ad sales, floored at 0."],
  ["Unit session %", "Units divided by sessions over the same days."],
];

/** Full data notes, kept in a dialog so they never crowd the page. */
export default function Notes() {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn" onClick={() => ref.current?.showModal()}>
        Data notes
      </button>
      <dialog ref={ref} className={st["notes-dlg"]} aria-labelledby="nt-h" onClick={(e) => e.target === ref.current && ref.current.close()}>
        <div className={st["dlg-in"]}>
          <div className={st["dlg-hd"]}>
            <h2 id="nt-h" className="ph">
              Data notes
            </h2>
            <button type="button" className={st["dlg-x"]} aria-label="Close" onClick={() => ref.current?.close()}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className={st["dlg-body"]}>
            <h3>Source</h3>
            <p>
              Everything in the weekly and monthly tables comes from tool4seller (store j Germany, amazon.de): sales and traffic by child ASIN and advertising by ASIN. Weeks are ISO weeks, Monday to Sunday. Data through {meta.dataThrough}; refreshed manually on {meta.lastRefresh}, with no automatic schedule.
            </p>
            <h3>Sales and sessions</h3>
            <p>
              Sales, units and sessions are per child ASIN, summed to parents and categories. Sessions are browser and mobile app sessions. Sessions cover only through {meta.sessionsThrough} because tool4seller has no traffic for later days yet; those rows show “pending”.
            </p>
            <h3>Advertising</h3>
            <p>
              Ad spend and ad sales are tool4seller advertising by ASIN, all ad types it can assign to an ASIN; ad sales are all-attributed. Account level uses the same figures as the tool4seller website, so rows add up to the account total. Sponsored Brands and Display spend that tool4seller does not tie to a product (about 2–5%) is not in Ad spend, ACOS or TACoS.
            </p>
            <h3>Campaigns and keywords</h3>
            <p>
              tool4seller campaign and keyword-target reports per ISO week, own campaigns only. Their ad sales are campaign-attributed. Shared catch-all campaigns are not split by product and are not listed. Auto and product (ASIN) targets are not in the keyword table.
            </p>
            <h3>Not shown</h3>
            <p>Search-term, ad-type and Search Query Performance tables, the SP/SD split and own/shared spend: there is no verified current source for them.</p>
            <h3>Terms</h3>
            <dl className={st.terms}>
              {TERMS.map(([t, d]) => (
                <div key={t}>
                  <dt>{t}</dt>
                  <dd>{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </dialog>
    </>
  );
}
