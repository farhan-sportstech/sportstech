// A category page from Supabase, as plain data the browser turns back into CategoryData (lib/category.ts):
// dash_period, category_metrics (the category row), asin_metrics (products, children and family rows "fam_…"),
// asin_meta, asin_sku, product_family, ov_period, yoy_comparison, adtype_period and dash_page_source.
import { cacheLife } from "next/cache";
import type { AdType, Mode, OverallRow, ToDate } from "../category";
import type { Listing, OvRow, Period, Product } from "../mock";
import { lastLoad, selectAll } from "./supabase";
import { ASIN_COLS, META_COLS, buildProducts, day, dt, listingsOf, mon, n, ovRow, snapshotsOf, toPeriod, type AsinRow, type MetaRow, type MetricRow, type Num, type OvRaw, type PeriodRow } from "./shared";

type Grain = "daily" | "weekly" | "monthly";
export type CatRaw = {
  periods: Record<Mode, Period[]>;
  products: Product[];
  families: { name: string; asins: string[] }[];
  /** "" = the whole category, otherwise a family name; index-aligned with periods */
  totals: Record<string, Record<Mode, OverallRow[]>>;
  overview: Record<string, Record<Grain, OvRow[]>>;
  toDate: Record<string, ToDate[]>;
  /** whole category only, and only where the database has the ad-type report */
  adTypes: Record<Mode, AdType[]> | null;
  listings: (Listing & { parent: string | null })[];
  snapshots: { bsr: string; bsrPrev: string; price: string; pricePrev: string; report: string };
  asOf: string | null;
};

type CatRow = MetricRow & { orders: Num; sessions: Num; spend_owned: Num; spend_shared: Num; spend_sp: Num };
const AD_TYPES: { key: string; name: AdType["name"]; short: string; perAsin: boolean }[] = [
  { key: "sp", name: "Sponsored Products", short: "SP", perAsin: true },
  { key: "sd", name: "Sponsored Display", short: "SD", perAsin: true },
  { key: "sb", name: "Sponsored Brands", short: "SB", perAsin: false },
];
const range = (s: string, e: string) => {
  const wd = dt(e).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return s === e ? `${wd}, ${day(e)} ${mon(e)} ${e.slice(0, 4)}` : `${day(s)} ${mon(s)} – ${wd}, ${day(e)} ${mon(e)} ${e.slice(0, 4)}`;
};

export async function getCategoryRaw(slug: string): Promise<CatRaw | null> {
  "use cache";
  cacheLife("hours");
  const q = `slug=eq.${encodeURIComponent(slug)}`;
  const [per, cat, am, meta, skus, fams, ov, yoy, ad, page, src, asOf] = await Promise.all([
    selectAll<PeriodRow>("dash_period", `select=period_key,ord,start_date,end_date,kw&${q}&order=ord`),
    selectAll<CatRow>("category_metrics", `select=period_key,sales,units,spend,ad_sales,ad_sales_halo,orders,sessions,spend_owned,spend_shared,spend_sp&${q}`),
    selectAll<AsinRow>("asin_metrics", `select=${ASIN_COLS}&${q}`),
    selectAll<MetaRow>("asin_meta", `select=${META_COLS}&${q}&order=ord`),
    selectAll<{ asin: string; sku: string; ord: number }>("asin_sku", `select=asin,sku,ord&${q}&order=ord`),
    selectAll<{ fid: string; name: string; products: string[] | null; ord: number }>("product_family", `select=fid,name,products,ord&${q}&order=ord`),
    selectAll<OvRaw>("ov_period", `select=*&${q}&order=ord`),
    selectAll<{ scope: string; period_kind: string; metric: string; title: string; cur_start: string; cur_end: string; ly_start: string; ly_end: string; cur_value: Num; ly_value: Num }>(
      "yoy_comparison",
      `select=scope,period_kind,metric,title,cur_start,cur_end,ly_start,ly_end,cur_value,ly_value&${q}&metric=in.(sales,units,spend,ad_sales)`,
    ),
    selectAll<{ period_key: string; ad_type: string; impressions: Num; clicks: Num; spend: Num; sales: Num; orders: Num }>("adtype_period", `select=period_key,ad_type,impressions,clicks,spend,sales,orders&${q}`),
    selectAll<{ latest_data_date: string | null }>("dash_page", `select=latest_data_date&${q}`),
    selectAll<{ source: string; as_of: string | null }>("dash_page_source", `select=source,as_of&${q}`),
    lastLoad(),
  ]);
  if (!per?.length || !cat || !am || !meta || !skus || !fams || !ov || !yoy) return null;

  const weeks = per.filter((p) => p.period_key.startsWith("w"));
  const months = per.filter((p) => p.period_key.startsWith("m"));
  const lastDay = page?.[0]?.latest_data_date ?? months[0]?.end_date;
  const keys: Record<Mode, string[]> = { weekly: weeks.map((p) => p.period_key), monthly: months.map((p) => p.period_key) };

  const acctOf = (k: string) => {
    const r = cat.find((c) => c.period_key === k);
    return { sales: n(r?.sales), sp: n(r?.spend_sp) };
  };
  const products = buildProducts(meta, am, skus, keys.weekly, keys.monthly, acctOf, () => "");

  // family names can repeat (two "sWalk" families); the ASIN keeps them apart
  const seen = new Map<string, number>();
  for (const f of fams) seen.set(f.name, (seen.get(f.name) ?? 0) + 1);
  const famName = (f: { fid: string; name: string }) => (seen.get(f.name)! > 1 ? `${f.name} (${f.fid.replace(/^fam_/, "")})` : f.name);
  const families = fams.map((f) => ({ name: famName(f), asins: f.products ?? [] }));
  const nameOfFid = new Map(fams.map((f) => [f.fid, famName(f)]));

  // totals: the category row for the whole page, the stored "fam_…" rows for each family
  const overall = (r: (MetricRow & { orders: Num; sessions: Num; spend_owned?: Num; spend_shared?: Num }) | undefined): OverallRow => {
    const spend = n(r?.spend);
    const shared = n(r?.spend_shared);
    return {
      sales: n(r?.sales),
      units: n(r?.units),
      adSpend: spend,
      adSales: n(r?.ad_sales ?? r?.ad_sales_halo),
      orders: n(r?.orders),
      sessions: n(r?.sessions),
      ownSpend: r?.spend_owned === null || r?.spend_owned === undefined ? spend - shared : n(r.spend_owned),
      sharedSpend: shared,
      // Sponsored Brands isn't split per category in the database yet
      sbSpend: 0,
    };
  };
  const totals: CatRaw["totals"] = {
    "": { weekly: keys.weekly.map((k) => overall(cat.find((c) => c.period_key === k))), monthly: keys.monthly.map((k) => overall(cat.find((c) => c.period_key === k))) },
  };
  for (const f of fams) {
    const rows = am.filter((r) => r.level === "parents" && r.asin === f.fid);
    totals[famName(f)] = { weekly: keys.weekly.map((k) => overall(rows.find((r) => r.period_key === k))), monthly: keys.monthly.map((k) => overall(rows.find((r) => r.period_key === k))) };
  }

  // overview: scope "t" is the category, "s/fam_…" a family; weekly rows after the focus week are left out
  const focusWeek = weeks[0]?.start_date ?? "";
  const overview: CatRaw["overview"] = {};
  for (const scope of Array.from(new Set(ov.map((r) => r.scope)))) {
    const key = scope === "t" ? "" : nameOfFid.get(scope.replace(/^s\//, ""));
    if (key === undefined) continue;
    const rows = ov.filter((r) => r.scope === scope);
    overview[key] = {
      daily: rows.filter((r) => r.grain === "daily").map(ovRow),
      weekly: rows.filter((r) => r.grain === "weekly" && r.period_key <= focusWeek).map(ovRow),
      monthly: rows.filter((r) => r.grain === "monthly").map(ovRow),
    };
  }

  // to date vs last year: Today, This week and This month for the category ("ALL") and each family
  const toDate: CatRaw["toDate"] = {};
  for (const scope of Array.from(new Set(yoy.map((r) => r.scope)))) {
    const key = scope === "ALL" ? "" : nameOfFid.get(scope);
    if (key === undefined) continue;
    toDate[key] = ["day", "week", "month"]
      .map((kind) => {
        const xs = yoy.filter((r) => r.scope === scope && r.period_kind === kind);
        if (!xs.length) return null;
        const v = (m: string, side: "cur_value" | "ly_value") => n(xs.find((x) => x.metric === m)?.[side]);
        const x = xs[0];
        return {
          label: x.title.replace(/ \(KW \d+\)$/, ""),
          sub: range(x.cur_start, x.cur_end),
          lySub: range(x.ly_start, x.ly_end),
          cur: { sales: v("sales", "cur_value"), units: v("units", "cur_value"), adSpend: v("spend", "cur_value"), adSales: v("ad_sales", "cur_value") },
          ly: { sales: v("sales", "ly_value"), units: v("units", "ly_value"), adSpend: v("spend", "ly_value"), adSales: v("ad_sales", "ly_value") },
        };
      })
      .filter((t): t is ToDate => t !== null);
  }

  // some categories carry empty ad-type rows (every figure null): that counts as no report
  const adTypes = ad?.some((r) => r.spend !== null)
    ? (Object.fromEntries(
        (["weekly", "monthly"] as Mode[]).map((mode) => [
          mode,
          AD_TYPES.map((t) => {
            const at = (k: string) => ad.find((r) => r.ad_type === t.key && r.period_key === k);
            const col = (f: "spend" | "sales" | "orders" | "clicks" | "impressions") => keys[mode].map((k) => n(at(k)?.[f]));
            return { name: t.name, short: t.short, spend: col("spend"), sales: col("sales"), orders: col("orders"), clicks: col("clicks"), impressions: col("impressions"), perAsin: t.perAsin };
          }),
        ]),
      ) as Record<Mode, AdType[]>)
    : null;

  return {
    periods: { weekly: weeks.map((p) => toPeriod(p, false)), monthly: months.map((p) => toPeriod(p, true, lastDay)) },
    products,
    families,
    totals,
    overview,
    toDate,
    adTypes,
    listings: listingsOf(meta, () => ""),
    snapshots: snapshotsOf(src),
    asOf,
  };
}
