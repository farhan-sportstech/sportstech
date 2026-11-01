// Server-only reads from Supabase's REST API. The key never reaches the browser: this module is only imported by
// server code, and the env vars have no NEXT_PUBLIC_ prefix. Without them every read returns null and the pages
// keep showing sample data.
import "server-only";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasDb = () => Boolean(URL_ && KEY);

/**
 * Every row of `table` matching the PostgREST `query` (e.g. "select=a,b&order=week_start.desc").
 * Pages through 1.000 rows at a time, the API's per-request cap. Returns null when the database isn't
 * configured or the read fails, so the caller can fall back to sample data.
 */
export async function selectAll<T>(table: string, query: string): Promise<T[] | null> {
  if (!URL_ || !KEY) return null;
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + page - 1}`, "Range-Unit": "items" },
    });
    if (!res.ok) {
      console.error(`supabase ${table}: ${res.status} ${await res.text()}`);
      return null;
    }
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < page) return out;
  }
}

/** When the last full load finished, for the "data as of" line. */
export async function lastLoad(): Promise<string | null> {
  const rows = await selectAll<{ finished_at: string }>("refresh_runs", "select=finished_at&status=eq.ok&source=like.sb/load.py*&order=run_id.desc&limit=1");
  return rows?.[0]?.finished_at ?? null;
}
