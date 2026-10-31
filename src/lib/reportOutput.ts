// Report outputs. PDF: a print-styled document in a hidden frame, saved through the browser's print dialog
// (no library, keeps the dashboard's type and colours). PowerPoint: editable slides with native tables (pptxgenjs, loaded on demand).
import type { Report } from "./report";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// the app's self-hosted fonts, so the frame renders in the same type
function fontFaces(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) if (rule instanceof CSSFontFaceRule) out.push(rule.cssText);
    } catch {
      // cross-origin sheet: skip
    }
  }
  return out.join("\n");
}

function family(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || "system-ui";
}

function html(r: Report): string {
  const ui = family("--font-ui");
  const head = family("--font-display");
  const pages = r.pages
    .map(
      (p) => `
<section class="page">
  <header>
    <div><h1>${esc(p.name)}</h1><p class="meta">${esc(p.asin)}${p.family ? ` · ${esc(p.family)}` : ""}</p></div>
    <div class="r"><b>${esc(r.title)}</b><br>${esc(r.subtitle)}</div>
  </header>
  ${p.blocks
    .map(
      (b) => `
  <div class="block">
    <h2>${esc(b.title)}</h2>
    <p class="sum">${esc(b.summary)}</p>
    ${
      b.table && b.table.rows.length
        ? `<table><thead><tr>${b.table.head.map((h, i) => `<th class="${b.table!.num[i] ? "n" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${b.table.rows.map((row) => `<tr>${row.map((c, i) => `<td class="${b.table!.num[i] ? "n" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
        : ""
    }
  </div>`,
    )
    .join("")}
</section>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
${fontFaces()}
@page { size: A4 landscape; margin: 12mm 14mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${ui}, "Segoe UI", system-ui, sans-serif; color: #0f1420; font-size: 10.5pt; font-variant-numeric: tabular-nums; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { break-after: page; }
.page:last-child { break-after: auto; }
header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #3454f0; }
h1 { font-family: ${head}, ${ui}, sans-serif; font-size: 20pt; letter-spacing: -0.02em; }
.meta { color: #5b6678; margin-top: 2px; }
.r { text-align: right; color: #5b6678; font-size: 9pt; line-height: 1.4; }
.r b { color: #0f1420; }
.block { margin-bottom: 14px; break-inside: avoid; }
h2 { font-family: ${head}, ${ui}, sans-serif; font-size: 12.5pt; margin-bottom: 3px; }
.sum { color: #3c4657; margin-bottom: 6px; max-width: 200mm; line-height: 1.45; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
th { text-align: left; font-weight: 600; color: #3c4657; background: #f1f4f8; border-bottom: 1px solid #cbd3de; padding: 5px 8px; }
td { padding: 4px 8px; border-bottom: 1px solid #e8ecf2; }
tr { break-inside: avoid; }
.n { text-align: right; }
tbody tr td:first-child { font-weight: 600; }
</style></head><body>${pages}</body></html>`;
}

/** Opens the print dialog for the report; the user picks "Save as PDF". */
export function printPdf(r: Report): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(html(r));
    doc.close();
    const go = async () => {
      await frame.contentDocument?.fonts?.ready;
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      // keep the frame until the dialog has had the document
      setTimeout(() => frame.remove(), 1000);
      resolve();
    };
    if (doc.readyState === "complete") void go();
    else frame.addEventListener("load", () => void go(), { once: true });
  });
}

/** Builds and downloads a .pptx: a title slide, then one slide per section per product. */
export async function downloadPptx(r: Report, fileName: string): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  const ink = "0F1420";
  const ink3 = "5B6678";
  const accent = "3454F0";
  const font = "Segoe UI";

  const title = pres.addSlide();
  title.addShape(pres.ShapeType.rect, { x: 0.6, y: 2.75, w: 0.12, h: 1.3, fill: { color: accent } });
  title.addText(r.title, { x: 0.95, y: 2.6, w: 11.5, h: 0.9, fontFace: font, fontSize: 34, bold: true, color: ink });
  title.addText(r.subtitle, { x: 0.95, y: 3.45, w: 11.5, h: 0.6, fontFace: font, fontSize: 16, color: ink3 });

  for (const p of r.pages) {
    for (const b of p.blocks) {
      const s = pres.addSlide();
      s.addText(`${p.name} · ${b.title}`, { x: 0.5, y: 0.35, w: 9.5, h: 0.6, fontFace: font, fontSize: 24, bold: true, color: ink });
      s.addText(`${p.asin}${p.family ? ` · ${p.family}` : ""}`, { x: 9.6, y: 0.4, w: 3.2, h: 0.5, fontFace: font, fontSize: 11, color: ink3, align: "right" });
      s.addShape(pres.ShapeType.line, { x: 0.5, y: 1.0, w: 12.33, h: 0, line: { color: accent, width: 1.5 } });
      s.addText(b.summary, { x: 0.5, y: 1.15, w: 12.33, h: 0.8, fontFace: font, fontSize: 13, color: "3C4657", valign: "top" });
      if (b.table && b.table.rows.length) {
        const t = b.table;
        const rows = [
          t.head.map((h, i) => ({ text: h, options: { bold: true, color: "3C4657", fill: { color: "F1F4F8" }, align: (t.num[i] ? "right" : "left") as "right" | "left" } })),
          ...t.rows.map((row) => row.map((c, i) => ({ text: c, options: { color: ink, bold: i === 0, align: (t.num[i] ? "right" : "left") as "right" | "left" } }))),
        ];
        s.addTable(rows, { x: 0.5, y: 2.05, w: 12.33, fontFace: font, fontSize: 11, border: { type: "solid", pt: 0.5, color: "E2E7EE" }, autoPage: true, autoPageRepeatHeader: true, newSlideStartY: 0.5 });
      }
    }
  }
  await pres.writeFile({ fileName });
}
