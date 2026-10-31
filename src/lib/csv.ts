/** Builds a CSV (semicolon-separated with a BOM, which German Excel opens cleanly) and hands it to the browser. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
