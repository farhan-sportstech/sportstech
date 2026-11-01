// The Weekly Dash data shape and its sample values. A plain module, so both the server loader and the client
// provider can import it.
import { meta, monthly, overview, products, sbsd, weekly, type Dataset, type OvRow, type Product, type Sbsd } from "./mock";

export type HomeData = {
  weekly: Dataset;
  monthly: Dataset;
  overview: Record<"daily" | "weekly" | "monthly", OvRow[]>;
  products: Product[];
  sbsd: Record<"weekly" | "monthly", Sbsd[]>;
  meta: typeof meta;
  /** true when the figures above come from Supabase */
  live: boolean;
};

export const SAMPLE_HOME: HomeData = { weekly, monthly, overview, products, sbsd, meta, live: false };
