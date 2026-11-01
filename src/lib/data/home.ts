// The Weekly Dash from Supabase: dash_period, category_metrics, asin_metrics + asin_meta + asin_sku, ov_period and
// sbsd_period for the home page, shaped like the sample module so the sections don't change. Sample data without a key.
import { cacheLife } from "next/cache";
import type { Dataset, Sbsd } from "../mock";
import { SAMPLE_HOME, type HomeData } from "../homeSample";
import { lastLoad, selectAll } from "./supabase";
import { ASIN_COLS, META_COLS, buildProducts, day, fmtDate, listingsOf, mon, n, ovRow, snapshotsOf, toPeriod, toRow, type AsinRow, type MetaRow, type MetricRow, type Num, type OvRaw, type PeriodRow } from "./shared";

export async function getHome(): Promise<HomeData> {
  "use cache";
  cacheLife("hours");
  const [per, cats, am, meta, skus, ov, sb, page, asOf, gens, nosRaw, xwn, src] = await Promise.all([
    selectAll<PeriodRow>("dash_period", "select=period_key,ord,start_date,end_date,kw&slug=eq.home&order=ord"),
    selectAll<MetricRow & { category: string; spend_sp: Num }>("category_metrics", "select=category,period_key,sales,units,spend,ad_sales,ad_sales_halo,spend_sp&slug=eq.home&category=neq.__total__"),
    selectAll<AsinRow>("asin_metrics", `select=${ASIN_COLS}&slug=eq.home`),
    selectAll<MetaRow>("asin_meta", `select=${META_COLS}&slug=eq.home&order=ord`),
    selectAll<{ asin: string; sku: string; ord: number }>("asin_sku", "select=asin,sku,ord&slug=eq.home&order=ord"),
    selectAll<OvRaw>("ov_period", "select=*&slug=eq.home&scope=eq.t&order=ord"),
    selectAll<{ period_key: string; spend: Num; adsales: Num }>("sbsd_period", "select=period_key,spend,adsales"),
    selectAll<{ latest_data_date: string | null }>("dash_page", "select=latest_data_date&slug=eq.home"),
    lastLoad(),
    selectAll<{ gen: number }>("wdx_gen", "select=gen&status=eq.ok&order=gen.desc&limit=1"),
    selectAll<{ gen: number; period: string; grp: string; name: string | null; asin: string | null; parent: string | null; spend: Num; clicks: Num; impressions: Num; sales: Num }>(
      "wdx_nos",
      "select=gen,period,grp,name,asin,parent,spend,clicks,impressions,sales&slug=eq.home&order=ord",
    ),
    selectAll<{ kind: string; period_key: string; name: string; sub: string | null; sp1: Num; sa1: Num; a0: Num; spp: Num; slp: Num }>("xwn_row", "select=kind,period_key,name,sub,sp1,sa1,a0,spp,slp&order=ord"),
    selectAll<{ source: string; as_of: string | null }>("dash_page_source", "select=source,as_of&slug=eq.home"),
  ]);
  if (!per || !cats || !am || !meta || !skus || !ov || !sb) return SAMPLE_HOME;

  // periods: w1…w5 and m0…m4, newest first, the order every row array follows
  const weeks = per.filter((p) => p.period_key.startsWith("w"));
  const months = per.filter((p) => p.period_key.startsWith("m"));
  const lastDay = page?.[0]?.latest_data_date ?? months[0]?.end_date;
  const wk = weeks.map((p) => p.period_key);
  const mk = months.map((p) => p.period_key);
  const series = (rows: MetricRow[], keys: string[]) => keys.map((k) => toRow(rows.find((r) => r.period_key === k)));
  const dataset = (ps: PeriodRow[], monthly: boolean): Dataset => {
    const keys = ps.map((p) => p.period_key);
    const names = Array.from(new Set(cats.map((c) => c.category)));
    return { periods: ps.map((p) => toPeriod(p, monthly, lastDay)), categories: names.map((name) => ({ name, rows: series(cats.filter((c) => c.category === name), keys) })) };
  };

  // account totals per period, for the "share of account" product metrics
  const acctOf = (k: string) => {
    const xs = cats.filter((c) => c.period_key === k);
    return { sales: xs.reduce((a, c) => a + n(c.sales), 0), sp: xs.reduce((a, c) => a + n(c.spend_sp), 0) };
  };
  const products = buildProducts(meta, am, skus, wk, mk, acctOf, (m) => m.category ?? "Other");

  // weekly overview rows newer than the dashboard's focus week (the running week) are left out so row 0 lines up
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

  // Wins campaign / keyword lines and their no-ad-sales lists: xwn_row holds the 4 newest weeks (w1…w4)
  const xweeks = wk.slice(0, 4);
  const winLine = (r: NonNullable<typeof xwn>[number]) => ({ name: r.name, sub: r.sub ?? "", spend: n(r.sp1), sales: n(r.sa1), prevAcos: r.a0 === null ? null : n(r.a0), spendPct: n(r.spp), salesPct: n(r.slp) });
  const wins = xwn?.length
    ? { campaigns: xweeks.map((k) => xwn.filter((r) => r.kind === "c" && r.period_key === k).map(winLine)), keywords: xweeks.map((k) => xwn.filter((r) => r.kind === "k" && r.period_key === k).map(winLine)) }
    : null;

  // spend without ad sales: child ASINs from wdx_nos (current generation), campaigns and keywords from xwn_row with no ad sales
  const gen = gens?.[0]?.gen;
  const nos =
    nosRaw && xwn && gen !== undefined
      ? {
          periods: weeks.slice(0, 4).map((p) => toPeriod(p, false)),
          sets: xweeks.map((k) => ({
            products: nosRaw
              .filter((r) => r.gen === gen && r.grp === "p" && r.period === k)
              .map((r) => ({ name: r.name ?? r.asin ?? "—", sub: `${r.asin ?? ""}${r.parent && r.parent !== r.asin ? ` · parent ${r.parent}` : ""}`, adSpend: n(r.spend), clicks: n(r.clicks), impressions: n(r.impressions), sales: r.sales === null ? null : n(r.sales) })),
            campaigns: xwn.filter((r) => r.kind === "c" && r.period_key === k && n(r.sa1) === 0).map((r) => ({ name: r.name, sub: r.sub ?? "", adSpend: n(r.sp1), clicks: null, impressions: null, sales: null })),
            keywords: xwn.filter((r) => r.kind === "k" && r.period_key === k && n(r.sa1) === 0).map((r) => ({ name: r.name, sub: r.sub ?? "", adSpend: n(r.sp1), clicks: null, impressions: null, sales: null })),
          })),
        }
      : null;

  const catOf = new Map(meta.filter((m) => m.level === "parents").map((m) => [m.asin, m.category ?? "Other"]));
  const listings = listingsOf(meta, (parent) => (parent && catOf.get(parent)) || "Other");

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
    nos,
    wins,
    listings,
    snapshots: snapshotsOf(src),
    live: true,
  };
}
