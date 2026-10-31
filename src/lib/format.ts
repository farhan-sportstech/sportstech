import type { Row } from "./mock";

export const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const eur2 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const int = new Intl.NumberFormat("de-DE");
export const pct1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const pct2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const acosOf = (adSpend: number, adSales: number) => (adSales ? (adSpend / adSales) * 100 : 0);
export const tacosOf = (adSpend: number, sales: number) => (sales ? (adSpend / sales) * 100 : 0);
export const acos = (r: Row) => acosOf(r.adSpend, r.adSales);
export const tacos = (r: Row) => tacosOf(r.adSpend, r.sales);
export const change = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : 0);
export const sumRows = (rows: Row[]): Row =>
  rows.reduce(
    (a, r) => ({ sales: a.sales + r.sales, units: a.units + r.units, adSpend: a.adSpend + r.adSpend, adSales: a.adSales + r.adSales }),
    { sales: 0, units: 0, adSpend: 0, adSales: 0 },
  );
