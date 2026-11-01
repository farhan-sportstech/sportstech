// The Weekly Dash from Supabase: dash_period, category_metrics, asin_metrics + asin_meta + asin_sku, ov_period and
// sbsd_period for the home page, shaped like the sample module so the sections don't change. Sample data without a key.
import { cacheLife } from "next/cache";
import type { Dataset, OvRow, Period, Product, Row, Sbsd } from "../mock";
import { SAMPLE_HOME, type HomeData } from "../homeSample";
import { lastLoad, selectAll } from "./supabase";

type Num = string | number | null;
const n = (v: Num | undefined) => (v === null || v === undefined ? 0 : Number(v));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dt = (iso: string) => new Date(`${iso}T00:00:00Z`);
const day = (iso: string) => dt(iso).getUTCDate();
const mon = (iso: string) => MON[dt(iso).getUTCMonth()];
const fmtDate = (iso: string) => `${day(iso)} ${mon(iso)} ${dt(iso).getUTCFullYear()}`;

type PeriodRow = { period_key: string; ord: number; start_date: string; end_date: string; kw: string };
// on the home page ad_sales is empty and the attributed ad sales sit in ad_sales_halo (the stored acos matches it)
type MetricRow = { period_key: string; sales: Num; units: Num; spend: Num; ad_sales: Num; ad_sales_halo: Num };
type AsinRow = MetricRow & { asin: string; level: string; orders: Num; sessions: Num; clicks: Num; impressions: Num; ad_orders: Num; spend_sp: Num; bsr_sub: Num; bsr_main: Num };
const toRow = (m: MetricRow | undefined): Row => ({ sales: n(m?.sales), units: n(m?.units), adSpend: n(m?.spend), adSales: n(m?.ad_sales ?? m?.ad_sales_halo) });
const nul = (v: Num | undefined) => (v === null || v === undefined || Number(v) === 0 ? null : Number(v));
// a product row with the traffic, ad and rank fields the product table shows (see extend() in lib/metrics)
const toXRow = (m: AsinRow | undefined, acct: { sales: number; sp: number }): Row =>
  ({
    ...toRow(m),
    orders: n(m?.orders),
    sessions: n(m?.sessions),
    clicks: n(m?.clicks),
    impressions: n(m?.impressions),
    adOrders: n(m?.ad_orders),
    spSpend: n(m?.spend_sp),
    bsrSub: nul(m?.bsr_sub),
    bsrMain: nul(m?.bsr_main),
    acctSales: acct.sales,
    acctSp: acct.sp,
  }) as Row;

/** "19–25 Oct", or "28 Sep–4 Oct" across a month end */
const weekLabel = (s: string, e: string) => (mon(s) === mon(e) ? `${day(s)}–${day(e)} ${mon(e)}` : `${day(s)} ${mon(s)}–${day(e)} ${mon(e)}`);

export async function getHome(): Promise<HomeData> {
  "use cache";
  cacheLife("hours");
  const [per, cats, am, meta, skus, ov, sb, page, asOf] = await Promise.all([
    selectAll<PeriodRow>("dash_period", "select=period_key,ord,start_date,end_date,kw&slug=eq.home&order=ord"),
    selectAll<MetricRow & { category: string; spend_sp: Num }>("category_metrics", "select=category,period_key,sales,units,spend,ad_sales,ad_sales_halo,spend_sp&slug=eq.home&category=neq.__total__"),
    selectAll<AsinRow>("asin_metrics", "select=asin,level,period_key,sales,units,spend,ad_sales,ad_sales_halo,orders,sessions,clicks,impressions,ad_orders,spend_sp,bsr_sub,bsr_main&slug=eq.home"),
    selectAll<{ asin: string; level: string; ord: number; name: string | null; category: string | null; parent: string | null; children: string[] | null }>(
      "asin_meta",
      "select=asin,level,ord,name,category,parent,children&slug=eq.home&order=ord",
    ),
    selectAll<{ asin: string; sku: string; ord: number }>("asin_sku", "select=asin,sku,ord&slug=eq.home&order=ord"),
    selectAll<Record<string, Num> & { grain: string; ord: number; period_key: string; label: string; note: string | null }>("ov_period", "select=*&slug=eq.home&scope=eq.t&order=ord"),
    selectAll<{ period_key: string; spend: Num; adsales: Num }>("sbsd_period", "select=period_key,spend,adsales"),
    selectAll<{ latest_data_date: string | null }>("dash_page", "select=latest_data_date&slug=eq.home"),
    lastLoad(),
  ]);
  if (!per || !cats || !am || !meta || !skus || !ov || !sb) return SAMPLE_HOME;

  // periods: w1…w5 and m0…m4, newest first, the order every row array follows
  const weeks = per.filter((p) => p.period_key.startsWith("w"));
  const months = per.filter((p) => p.period_key.startsWith("m"));
  const lastDay = page?.[0]?.latest_data_date ?? months[0]?.end_date;
  const toPeriod = (p: PeriodRow, monthly: boolean): Period => {
    if (!monthly) return { key: p.period_key, kw: p.kw, label: weekLabel(p.start_date, p.end_date) };
    // the running month stops at the last day with data
    const end = lastDay && lastDay < p.end_date ? lastDay : p.end_date;
    return { key: p.period_key, kw: mon(p.start_date), label: end < p.end_date ? `1–${day(end)} ${mon(end)}` : `${mon(p.start_date)} ${p.start_date.slice(0, 4)}` };
  };
  const series = <T extends MetricRow>(rows: T[], keys: string[]) => keys.map((k) => toRow(rows.find((r) => r.period_key === k)));

  const dataset = (ps: PeriodRow[], monthly: boolean): Dataset => {
    const keys = ps.map((p) => p.period_key);
    const names = Array.from(new Set(cats.map((c) => c.category)));
    return { periods: ps.map((p) => toPeriod(p, monthly)), categories: names.map((name) => ({ name, rows: series(cats.filter((c) => c.category === name), keys) })) };
  };
  const wk = weeks.map((p) => p.period_key);
  const mk = months.map((p) => p.period_key);

  // products: parent ASINs with their children as variants
  const byAsin = new Map<string, AsinRow[]>();
  for (const r of am) byAsin.set(`${r.level}:${r.asin}`, [...(byAsin.get(`${r.level}:${r.asin}`) ?? []), r]);
  const skuOf = new Map<string, string>();
  for (const s of skus) if (!skuOf.has(s.asin)) skuOf.set(s.asin, s.sku);
  // account totals per period, for the "share of account" product metrics
  const acctOf = (k: string) => {
    const xs = cats.filter((c) => c.period_key === k);
    return { sales: xs.reduce((a, c) => a + n(c.sales), 0), sp: xs.reduce((a, c) => a + n(c.spend_sp), 0) };
  };
  const xseries = (rows: AsinRow[], keys: string[]) => keys.map((k) => toXRow(rows.find((r) => r.period_key === k), acctOf(k)));
  const products: Product[] = meta
    .filter((m) => m.level === "parents")
    .map((m) => {
      const rows = byAsin.get(`parents:${m.asin}`) ?? [];
      return {
        asin: m.asin,
        name: m.name ?? m.asin,
        category: m.category ?? "Other",
        weekly: xseries(rows, wk),
        monthly: xseries(rows, mk),
        variants: (m.children ?? []).map((c) => {
          const cr = byAsin.get(`children:${c}`) ?? [];
          return { sku: skuOf.get(c) ?? c, label: c, weekly: xseries(cr, wk), monthly: xseries(cr, mk) };
        }),
      };
    });

  // overview rows; weekly rows newer than the dashboard's focus week (the running week) are left out so row 0 lines up
  const ovRow = (r: (typeof ov)[number]): OvRow => {
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
    };
  };
  const focusWeek = weeks[0]?.start_date ?? "";
  const overview = {
    daily: ov.filter((r) => r.grain === "daily").map(ovRow),
    weekly: ov.filter((r) => r.grain === "weekly" && r.period_key <= focusWeek).map(ovRow),
    monthly: ov.filter((r) => r.grain === "monthly").map(ovRow),
  };

  const sbRow = (k: string): Sbsd => {
    const r = sb.find((x) => x.period_key === k);
    return { spend: n(r?.spend), adSales: n(r?.adsales) };
  };
  const sessionsDay = ov.filter((r) => r.grain === "daily" && r.sessions !== null).map((r) => r.period_key)[0];

  return {
    weekly: dataset(weeks, false),
    monthly: dataset(months, true),
    overview,
    products,
    sbsd: { weekly: wk.map(sbRow), monthly: mk.map(sbRow) },
    meta: {
      marketplace: "Amazon.de",
      currency: "EUR",
      dataThrough: lastDay ? fmtDate(lastDay) : "—",
      lastRefresh: asOf ? new Date(asOf).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "—",
      sessionsThrough: sessionsDay ? `${day(sessionsDay)} ${mon(sessionsDay)}` : "—",
    },
    live: true,
  };
}
