// Mapping helpers shared by the page loaders (Weekly Dash, category pages): database rows → the shapes the UI reads.
import type { Listing, OvRow, Period, Product, Row } from "../mock";

export type Num = string | number | null;
export const n = (v: Num | undefined) => (v === null || v === undefined ? 0 : Number(v));
export const nul = (v: Num | undefined) => (v === null || v === undefined || Number(v) === 0 ? null : Number(v));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dt = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const day = (iso: string) => dt(iso).getUTCDate();
export const mon = (iso: string) => MON[dt(iso).getUTCMonth()];
export const fmtDate = (iso: string) => `${day(iso)} ${mon(iso)} ${dt(iso).getUTCFullYear()}`;

export type PeriodRow = { period_key: string; ord: number; start_date: string; end_date: string; kw: string };
// ad sales sit in ad_sales on category pages and in ad_sales_halo on the home page (the stored acos matches it)
export type MetricRow = { period_key: string; sales: Num; units: Num; spend: Num; ad_sales: Num; ad_sales_halo: Num };
export type AsinRow = MetricRow & {
  asin: string;
  level: string;
  orders: Num;
  sessions: Num;
  clicks: Num;
  impressions: Num;
  ad_orders: Num;
  spend_sp: Num;
  spend_owned?: Num;
  spend_shared?: Num;
  bsr_sub: Num;
  bsr_main: Num;
};
export const ASIN_COLS = "asin,level,period_key,sales,units,spend,ad_sales,ad_sales_halo,orders,sessions,clicks,impressions,ad_orders,spend_sp,spend_owned,spend_shared,bsr_sub,bsr_main";

export const toRow = (m: MetricRow | undefined): Row => ({ sales: n(m?.sales), units: n(m?.units), adSpend: n(m?.spend), adSales: n(m?.ad_sales ?? m?.ad_sales_halo) });
/** A product row carrying the traffic, ad and rank fields the product tables show (see extend() in lib/metrics). */
export const toXRow = (m: AsinRow | undefined, acct: { sales: number; sp: number }): Row =>
  ({
    ...toRow(m),
    orders: n(m?.orders),
    sessions: n(m?.sessions),
    clicks: n(m?.clicks),
    impressions: n(m?.impressions),
    adOrders: n(m?.ad_orders),
    spSpend: n(m?.spend_sp),
    ownSpend: n(m?.spend_owned),
    sharedSpend: n(m?.spend_shared),
    bsrSub: nul(m?.bsr_sub),
    bsrMain: nul(m?.bsr_main),
    acctSales: acct.sales,
    acctSp: acct.sp,
  }) as Row;

/** "19–25 Oct", or "28 Sep–4 Oct" across a month end */
export const weekLabel = (s: string, e: string) => (mon(s) === mon(e) ? `${day(s)}–${day(e)} ${mon(e)}` : `${day(s)} ${mon(s)}–${day(e)} ${mon(e)}`);

/** A dash_period row as a UI period; the running month stops at the last day with data. */
export function toPeriod(p: PeriodRow, monthly: boolean, lastDay?: string | null): Period {
  if (!monthly) return { key: p.period_key, kw: p.kw, label: weekLabel(p.start_date, p.end_date) };
  const end = lastDay && lastDay < p.end_date ? lastDay : p.end_date;
  return { key: p.period_key, kw: mon(p.start_date), label: end < p.end_date ? `1–${day(end)} ${mon(end)}` : `${mon(p.start_date)} ${p.start_date.slice(0, 4)}` };
}

export type OvRaw = Record<string, Num> & { grain: string; scope: string; ord: number; period_key: string; label: string; note: string | null };
export function ovRow(r: OvRaw): OvRow {
  const [label, sub] = r.label.split(" · ");
  const sales = n(r.sales);
  const ads = n(r.ads);
  const ppcSales = n(r.ppc_sales);
  const sessions = r.sessions === null ? null : n(r.sessions);
  return {
    label,
    sub: sessions === null ? "sessions pending" : sub,
    orders: n(r.orders),
    units: n(r.units),
    sales,
    profit: n(r.profit),
    ads,
    acos: ppcSales ? (ads / ppcSales) * 100 : 0,
    tacos: sales ? (ads / sales) * 100 : 0,
    organicOrders: n(r.org_orders),
    ppcSales,
    ppcOrders: n(r.ppc_orders),
    sessions,
    conversion: sessions ? (n(r.units) / sessions) * 100 : null,
    avgPrice: n(r.units) ? sales / n(r.units) : 0,
    margin: r.margin === null || r.margin === undefined ? undefined : n(r.margin),
    refunds: r.refunds === null || r.refunds === undefined ? undefined : n(r.refunds),
    refundRate: r.refund_rate === null || r.refund_rate === undefined ? undefined : n(r.refund_rate),
    payout: r.payout === null || r.payout === undefined ? undefined : n(r.payout),
  };
}

export type MetaRow = {
  asin: string;
  level: string;
  ord: number;
  kind?: string | null;
  family?: string | null;
  name: string | null;
  category: string | null;
  parent: string | null;
  children: string[] | null;
  bsr_sub: Num;
  bsr_sub_cat: string | null;
  bsr_main: Num;
  d_sub: Num;
  d_main: Num;
  list_price: Num;
  d_price: Num;
  price_src: string | null;
};
export const META_COLS = "asin,level,ord,kind,family,name,category,parent,children,bsr_sub,bsr_sub_cat,bsr_main,d_sub,d_main,list_price,d_price,price_src";

/** Child ASINs with a BSR snapshot and a listed price; previous values from the stored changes. */
export function listingsOf(meta: MetaRow[], categoryOf: (parent: string | null) => string): (Listing & { parent: string | null })[] {
  return meta
    .filter((m) => m.level === "children" && m.bsr_sub !== null && m.bsr_main !== null && m.list_price !== null)
    .map((m) => ({
      asin: m.asin,
      parent: m.parent,
      name: m.name ?? m.asin,
      category: categoryOf(m.parent),
      subCat: m.bsr_sub_cat ?? "",
      bsrSub: n(m.bsr_sub),
      bsrSubPrev: n(m.bsr_sub) - n(m.d_sub),
      bsrMain: n(m.bsr_main),
      bsrMainPrev: n(m.bsr_main) - n(m.d_main),
      price: n(m.list_price),
      pricePrev: n(m.list_price) - n(m.d_price),
      fromReport: Boolean(m.price_src),
    }));
}

/** Parent ASINs with their children as variants; every row array follows `wk` / `mk` (newest first). */
export function buildProducts(
  meta: MetaRow[],
  am: AsinRow[],
  skus: { asin: string; sku: string }[],
  wk: string[],
  mk: string[],
  acctOf: (periodKey: string) => { sales: number; sp: number },
  categoryOf: (m: MetaRow) => string,
): Product[] {
  const byAsin = new Map<string, AsinRow[]>();
  for (const r of am) byAsin.set(`${r.level}:${r.asin}`, [...(byAsin.get(`${r.level}:${r.asin}`) ?? []), r]);
  const skuOf = new Map<string, string>();
  for (const s of skus) if (!skuOf.has(s.asin)) skuOf.set(s.asin, s.sku);
  const xseries = (rows: AsinRow[], keys: string[]) => keys.map((k) => toXRow(rows.find((r) => r.period_key === k), acctOf(k)));
  return meta
    .filter((m) => m.level === "parents" && (m.kind ?? "product") !== "family")
    .map((m) => {
      const rows = byAsin.get(`parents:${m.asin}`) ?? [];
      return {
        asin: m.asin,
        name: m.name ?? m.asin,
        category: categoryOf(m),
        weekly: xseries(rows, wk),
        monthly: xseries(rows, mk),
        variants: (m.children ?? []).map((c) => {
          const cr = byAsin.get(`children:${c}`) ?? [];
          return { sku: skuOf.get(c) ?? c, label: c, weekly: xseries(cr, wk), monthly: xseries(cr, mk) };
        }),
      };
    });
}

/** Snapshot dates for Price & BSR from dash_page_source. */
export function snapshotsOf(src: { source: string; as_of: string | null }[] | null) {
  const at = (k: string) => {
    const v = src?.find((s) => s.source === k)?.as_of;
    return v ? `${day(v)} ${mon(v)}` : "—";
  };
  return { bsr: at("ac_bsr.bsr"), bsrPrev: at("ac_bsr.bsr_prev"), price: at("ac_bsr.price"), pricePrev: at("ac_bsr.price_prev"), report: at("price_list") };
}
