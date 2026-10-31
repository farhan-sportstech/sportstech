"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CategoryData, Mode } from "@/lib/category";
import { KW_DEFAULT, KW_METRICS, PERF_DEFAULT, PERF_METRICS, RPT_SECTIONS, SQP_DEFAULT, SQP_METRICS, buildReport, type RptSection } from "@/lib/report";
import { cx } from "@/lib/cx";
import MultiSelect from "../MultiSelect";
import Segmented from "../Segmented";
import Select from "../Select";
import st from "./ReportBuilder.module.css";

type Format = "pdf" | "pptx";
const TOPS = ["Top 8 rows", "Top 12 rows", "Top 20 rows", "Top 40 rows"];

function Check({ on, onChange, children, sub }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode; sub?: string }) {
  return (
    <label className={cx(st.check, on && st.checkOn)}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className={st.box} aria-hidden="true">
        <svg viewBox="0 0 12 12">
          <path d="M2.5 6.2 5 8.5 9.5 3.5" />
        </svg>
      </span>
      <span className={st.lbl}>
        {children}
        {sub ? <small>{sub}</small> : null}
      </span>
    </label>
  );
}

const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

// browser storage as an external store: other tabs notify via "storage", this tab via a local event
const EVT = "wd:targets";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
};
const readStore = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked: nothing is kept
  }
  window.dispatchEvent(new Event(EVT));
};

/** Per-product review, one product per page: PDF through the print dialog, or editable PowerPoint slides. */
export default function ReportBuilder({ data, family, mode, open }: { data: CategoryData; family: string; mode: Mode; open: boolean }) {
  const periods = data.periods[mode];
  const unit = mode === "weekly" ? "week" : "month";
  const products = data.pick(family);
  const [format, setFormat] = useState<Format>("pdf");
  const [picked, setPicked] = useState<number[]>([0, 1, 2, 3, 4]);
  const [asins, setAsins] = useState<string[]>(products.map((p) => p.asin));
  const [sections, setSections] = useState<RptSection[]>(["performance", "campaigns", "keywords", "queries"]);
  const [perf, setPerf] = useState(PERF_DEFAULT);
  const [kw, setKw] = useState(KW_DEFAULT);
  const [sqp, setSqp] = useState(SQP_DEFAULT);
  const [top, setTop] = useState(TOPS[1]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const key = `wd:targets:${data.def.slug}`;

  // monthly order targets live in this browser only; read through an external-store subscription
  const raw = useSyncExternalStore(subscribe, () => readStore(key), () => null);
  const targets = useMemo<Record<string, number>>(() => {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [raw]);
  const saveTargets = (t: Record<string, number>) => writeStore(key, JSON.stringify(t));

  const countLabel = (n: number) => `Last ${n} ${unit}${n === 1 ? "" : "s"}`;
  const counts = periods.map((_, i) => countLabel(i + 1));
  const ready = picked.length > 0 && asins.length > 0 && sections.length > 0;

  const generate = async () => {
    if (!ready) return;
    setBusy(true);
    setStatus(format === "pdf" ? "Preparing the print view…" : "Building slides…");
    try {
      const report = buildReport({ data, mode, periods: picked, asins, sections, perf, kw, sqp, topN: Number(top.replace(/\D/g, "")), targets });
      const out = await import("@/lib/reportOutput");
      if (format === "pdf") {
        await out.printPdf(report);
        setStatus("Print dialog opened: choose “Save as PDF”.");
      } else {
        await out.downloadPptx(report, `sportstech-${data.def.slug}-review-${periods[Math.min(...picked)].kw.replace(/\s+/g, "")}.pptx`);
        setStatus(`Downloaded ${report.pages.length} product${report.pages.length === 1 ? "" : "s"} as PowerPoint.`);
      }
    } catch (e) {
      setStatus(`Could not build the report: ${e instanceof Error ? e.message : "unknown error"}.`);
    } finally {
      setBusy(false);
    }
  };

  const copyTargets = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(targets));
      setStatus("Targets copied.");
    } catch {
      setStatus("Could not copy targets.");
    }
  };
  const pasteTargets = async () => {
    try {
      const t = JSON.parse(await navigator.clipboard.readText());
      if (t && typeof t === "object") saveTargets(t);
      setStatus("Targets pasted.");
    } catch {
      setStatus("The clipboard does not hold targets.");
    }
  };

  return (
    <div className={cx(st.wrap, open && st.open)} inert={!open}>
      <div className={st.inner}>
        <section className="panel" aria-labelledby="rb-h" id="report">
          <div className={st.hd}>
            <div>
              <h2 id="rb-h" className="ph">
                Report builder
              </h2>
              <p className={st.lede}>A per-product review, one product per page. Every section gets a short summary computed from exactly the periods and metrics you pick.</p>
            </div>
            <Segmented
              label="Format"
              value={format}
              onChange={setFormat}
              options={[
                { value: "pdf", label: "PDF" },
                { value: "pptx", label: "PowerPoint" },
              ]}
            />
          </div>

          <div className={st.grid}>
            <div className={st.col}>
              <h3>
                Periods <small>{picked.length} picked</small>
              </h3>
              <Select label="How many periods" value={counts[picked.length - 1] ?? counts[0]} options={counts} onChange={(v) => setPicked(periods.map((_, i) => i).slice(0, counts.indexOf(v) + 1))} />
              <div className={st.list}>
                {periods.map((p, i) => (
                  <Check key={p.key} on={picked.includes(i)} onChange={(on) => setPicked((x) => toggle(x, i, on).sort((a, b) => a - b))} sub={p.label}>
                    {p.kw}
                  </Check>
                ))}
              </div>
              <Select label="Rows per table" value={top} options={TOPS} onChange={setTop} />
            </div>

            <div className={st.col}>
              <h3>
                Products <small>one page each</small>
                <span className={st.acts}>
                  <button type="button" onClick={() => setAsins(products.map((p) => p.asin))}>
                    All
                  </button>
                  <button type="button" onClick={() => setAsins([])}>
                    None
                  </button>
                </span>
              </h3>
              <div className={st.list}>
                {products.map((p) => (
                  <Check key={p.asin} on={asins.includes(p.asin)} onChange={(on) => setAsins((x) => toggle(x, p.asin, on))} sub={p.asin}>
                    {p.name}
                  </Check>
                ))}
              </div>
            </div>

            <div className={st.col}>
              <h3>
                Sections <small>in this order</small>
              </h3>
              <div className={st.list}>
                {RPT_SECTIONS.map((s) => (
                  <Check key={s.key} on={sections.includes(s.key)} onChange={(on) => setSections((x) => RPT_SECTIONS.map((r) => r.key).filter((k) => (k === s.key ? on : x.includes(k))))}>
                    {s.label}
                  </Check>
                ))}
              </div>
            </div>

            <div className={st.col}>
              <h3>
                Metrics <small>per section</small>
              </h3>
              <div className={st.mets}>
                <span>Performance</span>
                <MultiSelect label="Metrics" value={perf} onChange={setPerf} options={PERF_METRICS.map((m) => ({ value: m.key, label: m.label }))} presets={[{ label: "Default", value: PERF_DEFAULT }]} />
                <span>Keywords</span>
                <MultiSelect label="Metrics" value={kw} onChange={setKw} options={KW_METRICS.map((m) => ({ value: m.key, label: m.label }))} presets={[{ label: "Default", value: KW_DEFAULT }]} />
                <span>Search queries</span>
                <MultiSelect label="Metrics" value={sqp} onChange={setSqp} options={SQP_METRICS.map((m) => ({ value: m.key, label: m.label }))} presets={[{ label: "Default", value: SQP_DEFAULT }]} />
              </div>
            </div>
          </div>

          <div className={st.targets}>
            <h3>
              Monthly order targets <small>optional · kept in this browser only</small>
            </h3>
            <div className={st.tgtRow}>
              {products
                .filter((p) => asins.includes(p.asin))
                .map((p) => (
                  <label key={p.asin} className={st.tgt}>
                    <span>{p.name}</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="orders"
                      value={targets[p.asin] ?? ""}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const next = { ...targets };
                        if (e.target.value === "" || !Number.isFinite(v)) delete next[p.asin];
                        else next[p.asin] = v;
                        saveTargets(next);
                      }}
                    />
                  </label>
                ))}
            </div>
            <div className={st.tgtActs}>
              <button type="button" className="btn sm" onClick={copyTargets}>
                Copy targets
              </button>
              <button type="button" className="btn sm" onClick={pasteTargets}>
                Paste targets
              </button>
              <button type="button" className="btn sm" onClick={() => saveTargets({})}>
                Clear
              </button>
              <span className={st.hint}>Add the Targets section to show pace and the gap still to close.</span>
            </div>
          </div>

          <div className={st.go}>
            <button type="button" className={st.primary} onClick={generate} disabled={!ready || busy}>
              {busy ? "Working…" : format === "pdf" ? "Generate PDF" : "Generate PowerPoint"}
            </button>
            <span className={st.status} aria-live="polite">
              {!ready ? "Pick at least one period, product and section." : status || `${asins.length} product${asins.length === 1 ? "" : "s"} · ${sections.length} sections · ${picked.length} ${unit}${picked.length === 1 ? "" : "s"}. Summaries are computed from the numbers.`}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
