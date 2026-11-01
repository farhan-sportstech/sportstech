// The Weekly Dash data shape and its sample values. A plain module, so both the server loader and the client
// provider can import it.
import { listings, meta, monthly, overview, products, sbsd, snapshots, weekly, type Dataset, type Listing, type NoSale, type OvRow, type Period, type Product, type Sbsd } from "./mock";

/** One campaign or keyword in Wins & TACoS for one week, as the database stores it. */
export type WinLine = { name: string; sub: string; spend: number; sales: number; prevAcos: number | null; spendPct: number; salesPct: number };
export type NoSaleSet = { products: NoSale[]; campaigns: NoSale[]; keywords: NoSale[] };

export type HomeData = {
  weekly: Dataset;
  monthly: Dataset;
  overview: Record<"daily" | "weekly" | "monthly", OvRow[]>;
  products: Product[];
  sbsd: Record<"weekly" | "monthly", Sbsd[]>;
  meta: typeof meta;
  /** spend without ad sales per week (live: the 4 weeks the database holds); null = use the sample sets */
  nos: { periods: Period[]; sets: NoSaleSet[] } | null;
  /** Wins campaign and keyword lines per week index (weekly only); null = sample */
  wins: { campaigns: WinLine[][]; keywords: WinLine[][] } | null;
  listings: Listing[];
  snapshots: typeof snapshots;
  /** true when the figures above come from Supabase */
  live: boolean;
};

export const SAMPLE_HOME: HomeData = { weekly, monthly, overview, products, sbsd, meta, nos: null, wins: null, listings, snapshots, live: false };
