# Sportstech Console: data handoff

Which Supabase table feeds each page of the new Next.js app, what is missing, and what we need from the
database side before the sample data can be switched off.

- Supabase project: `weekly-dash` (`zgmqrchwlzcjvkwbgrvz`), schema `public`. Read on 1 Nov 2026; last refresh run 31 Oct, status ok.
- App: `farhan-sportstech/sportstech`. Every page currently reads invented sample data from `src/lib/*.ts`. Those
  files were shaped after these tables on purpose, so the switch is mostly mapping.
- Status per item: **Ready** = table and columns exist · **Reshape** = data exists, needs a view or small change ·
  **Missing** = not in the database.

---

## 1. Ground rules (architecture)

1. **Reads happen on the server.** Every table has RLS on and no policies, so the browser can't read anything.
   The app will read in server components with a key that never reaches the browser. Please confirm which:
   - (a) the service-role key in a server-only env var, or
   - (b) a dedicated read-only Postgres role plus `select` policies or `security_invoker` views. (b) is safer and is our preference.
2. **One read surface for the app.** Please expose what the app reads as views in a separate schema (e.g. `api`).
   Then the generator's tables can change without breaking the app, and grants stay in one place.
   Section 3 lists the views that would cover every page.
3. **Current generation.** `wdx_*` tables carry `gen` (3 and 4 both present); the others carry `last_run_id`.
   The views should return only the current generation / latest successful run. The app shouldn't have to know the rule.
4. **Dates, not only relative keys.** `period_key` values are relative (`w1`…`w5`, `m0`…`m4`). Fine as keys, but every
   period row should carry `start_date`, `end_date` and `partial` (as `dash_period` already does). Then the app never
   guesses which week `w1` is.
5. **IDs next to names.** Several hub tables identify ad groups, targets and placements by name only. Write-back needs IDs (section 4.2).
6. **Not for the app.** `page_json`, `page_inline`, `inl_leaf`, `wdx_scx_map`, `rank_hist*`, `page_cfg_meta` and
   presentation columns (`ord`, `n_cols`, `key_order`) belong to the old static generator. The new app won't read them.
   They can be retired once the static site is switched off.
7. **Secrets.** `dash_kv` holds `t4s:client` and PKCE entries. Keep that table out of any app-readable role or view.

---

## 2. Page by page

### Weekly Dash (`/`) — `src/lib/mock.ts`, `metrics.ts`, `Overview.tsx`, `Products.tsx`, `Comparisons.tsx`, `Wins.tsx`, `NoAdSales.tsx`, `PriceBsr.tsx`

| Section | Source | Status |
|---|---|---|
| Periods (5 weeks / 5 months, labels, partial) | `dash_period` (slug `home`) | Ready |
| Account glance, category table (sales, units, spend, ad sales, ACOS, TACoS) | `category_metrics` (slug `home`) | Ready |
| Overview daily / weekly / monthly | `ov_period` (`grain`, `scope`) | Ready |
| Products table and variants | `asin_metrics` + `asin_meta` + `asin_sku` | Ready |
| Same period last year / to date | `yoy_comparison` | Ready |
| Deal weeks | `asin_deal_period` / `kpi_weekly.deal` | Ready |
| BSR and price snapshots | `asin_bsr_period`, `asin_price_period` | Ready |
| Wins | `wdx_win` (current `gen`) | Ready |
| Spend without ad sales (products / campaigns / keywords) | `wdx_nos` (`grp`) | Ready |
| SB / SD strip | `sbsd_period`, `v_wdx_spend_basis` | Ready |
| Campaign and keyword movers | `ppc_campaign_period`, `ppc_target_period` (slug `home`) | Ready |

### Category pages (`/treadmills` …) — `src/lib/category.ts`, `ads.ts`, `sqp.ts`, `placements.ts`, `ranks.ts`, `kwgaps.ts`

| Section | Source | Status |
|---|---|---|
| Page config (title, own ASINs, sections, rank dates) | `dash_page`, `dash_page_source` | Ready |
| Overall and by-family performance | `category_metrics`, `asin_metrics`, `product_family`, `family_product` | Ready |
| Products and AOV bands | `asin_metrics`, `asin_identity`, `asin_meta` | Ready |
| By ad type | `adtype_period` | Ready |
| Campaigns (own vs shared) | `ppc_campaign_period` (`own`, `parent_asin`) | Ready |
| Keywords & targets | `ppc_target_period` + `kw_class` / `kw_class_def` for buckets | Ready |
| Keyword coverage | `kwcov_row`, `kwcov_item`, `kwx_coverage` | Ready |
| Search queries (SQP) | `sqp_keyword`, `sqp_keyword_asin` | Ready |
| Branded vs non-branded | derived from `ppc_target_period` + `kw_class` | Ready |
| Placements by week | `placement_week_hist` + `placement_week_campaign_asin` | Ready |
| Organic rank | `asin_keyword_rank` (+ `_nt`) | Ready |
| Keyword gaps per product | `keyword_gaps`, `keyword_gap_asin`, `keyword_gap_build` | Ready |
| Market volume (H10 / Cerebro) | `h10_keyword`, `cerebro_keyword` | Ready |
| Comparisons / to date | `yoy_comparison` | Ready |

### Weekly KPIs (`/kpi`) — `src/lib/kpi.ts`, `kpiMetrics.ts`

| Field | Source | Status |
|---|---|---|
| Weekly / monthly rows, partial flag | `kpi_weekly`, `kpi_monthly` | Ready |
| Sales, orders, units, sessions, page views | same | Ready |
| SP / SB / SD spend, sales, clicks, impressions, orders | `sp_*`, `sb_*`, `sd_*` | Ready |
| Branded / non-branded | `brb_*`, `brn_*` | Ready |
| Defense / offense | `std_*`, `sto_*` | Ready (please confirm `std` = defense, `sto` = offense) |
| Match type exact / phrase / broad / auto / PAT | `mte_*`, `mtp_*`, `mtb_*`, `mta_*`, `mtt_*` | Ready (confirm `mtt` = product targeting) |
| Fees, refunds | `fee_rate`, `refund_rate` (rates; the app multiplies by sales) | Ready |
| SP placements (top / product pages / rest) per week | not in `kpi_weekly`; `placement_week_hist` has 12 weeks only | **Reshape**: add `tos_*`, `pp_*`, `ros_*` spend to `kpi_weekly`/`kpi_monthly` for all 27 weeks |
| Sales by category per week | `kpi_category_week` | Ready; months missing, **Reshape**: add `kpi_category_month` (or the app sums weeks) |

### PPC tools — `src/lib/spikes.ts`, `account.ts`, `heatmap.ts`

| Page | Source | Status |
|---|---|---|
| Sales heatmap | `ppc_heatmap` (category × dow × hour: sales, units, order lines) + `ppc_tool_meta` (`page='heatmap'`) | Ready |
| ACOS & CPC tiers | `ppc_tier` (pre-bucketed) + `ppc_tool_meta` (`page='tiers'`) | **Reshape**: the new page lets you click a cell to list the campaigns/targets in it. That needs the per-entity 30-day rows the tiers are built from (campaign / target, spend, sales, clicks, orders). The app will use the database's bands (CPC 0,10–0,25 … >2,00; ACOS 0–10 … >100%, spend no sales). |
| Spike alerts | `ppc_spike_series` (account-level daily sales / ad sales / spend / CTR / CVR), `ppc_spike_flag`, `ppc_spike_driver` | **Decision needed**, see question 1 |

### Ads Hub (`/hub/*`) — `src/lib/hub.ts`, `account.ts`

The database gives the hub two periods: **latest week vs the week before** (`hub_meta.w1_*`, `w2_*`, `prev_*` columns)
and **month to date** (`m0_*`). The app currently offers "Last 7 / Last 30 days" and will switch to these two.

| View | Source | Status |
|---|---|---|
| Home: tiles and daily trend | `hub_daily_adtype` (63 days), `hub_daily_category` | Ready |
| Home: mix by ad type / targeting / placement | `hub_total` (`adtype`, `targeting`, `pl1`, `pl2`) | Ready |
| Home: budget pacing | `hub_budget_pace` | Ready |
| Home: rank drops / climbs | `hub_rank_drop`, `hub_meta.home_drop/climb` | Ready |
| Home: by category | `hub_daily_category` + `hub_campaign_category` | Ready |
| Improvements | computed in the app from the hub tables + `sqp_week_query` | Ready |
| Campaigns | `hub_campaign` (incl. prev and m0, budget usage, bid strategy, targeting) | Ready |
| Ad groups | `hub_ad_group` | Ready; no prev / m0 columns, **Reshape** for deltas and month view |
| Product ads | `hub_product_ad` | Ready; no `state`, prev or m0, **Reshape** |
| Targeting | `hub_target` (incl. prev, m0, bid, state) | Ready; `target_id` / `ad_group_id` missing, see 4.2 |
| Bid optimizer | `hub_target` | Ready |
| Search terms, N-grams, Order spread, Roots (ad side) | `hub_search_term` (6.000 rows, top by spend) | Ready; no m0, so the month view isn't possible |
| By portfolio | `hub_campaign` + `hub_portfolio_budget` | Ready |
| Keyword gaps | `hub_term_gap` (E/P/B flags, prev, ranks `rk1`–`rk4`, branded, new) + `hub_meta.rank_dates` | Ready; search volume per term missing, **Reshape**: join `sqp_keyword` / `h10_keyword` volume |
| ASIN gaps | `hub_term_gap` + `asin_catalog` (title, image) | Ready |
| Segments | `hub_target` (`ad_type`, `targeting`, `match_type`) | Ready |
| Placements | `hub_placement` | Ready; campaign name only, no `campaign_id` |
| Order spread: items per order | `hub_items_per_order` | Ready |
| Trends (13 weeks by ad type) | `hub_trend` | Ready |
| Label summary | `hub_target` | Ready |
| Roots: SQP volume trend | `sqp_week_query` (25 weeks, 2.851 queries) | Ready |
| SQP monthly / weekly | `sqp_week`, `sqp_week_query` | Ready |
| Brand Metrics (not built yet) | `brand_metrics_category`, `_map`, `_week` | Ready when we add the section |

### Pending changes / Change history (`/writeback/*`) — `src/lib/queue.ts`

| Part | Source | Status |
|---|---|---|
| Queue | in the browser today; `dash_kv` key `changes:plans` exists | **Decision needed**, see question 4 |
| History | `dash_changes` (0 rows; columns fit: target, field, old/new value, user, action, status, payload) | Ready to write into |
| tool4seller connection status | `dash_kv` `t4s:*` (server only) | Ready on the server side |

---

## 3. Views we'd like in an `api` schema

One view per page area, current generation only, dates included, presentation columns dropped:

- `api.periods(slug)`: `period_key, start_date, end_date, label, kw, partial`
- `api.category_metrics`, `api.asin_metrics`: as today, minus `ord`/`key_order`
- `api.kpi_weekly`, `api.kpi_monthly`: as today, plus the placement columns from 2.3
- `api.hub_campaign`, `api.hub_ad_group`, `api.hub_target`, `api.hub_product_ad`, `api.hub_search_term`, `api.hub_placement`: with IDs (4.2) and the same `w1` / `w2` / `m0` column set on each
- `api.ppc_tier_entity`: per campaign / target over the tiers window
- `api.sqp_week`, `api.sqp_week_query`, `api.hub_term_gap` (with volume)

## 4. Asks for Grok, in priority order

1. **Read access:** decide 1.1 (a) or (b) and create the role / policies or views. Blocks everything else.
2. **IDs for write-back:** add `ad_group_id` and `target_id` (keyword or target ID) to `hub_target`. Add `campaign_id`
   and `ad_group_id` to `hub_product_ad`, and `campaign_id` to `hub_placement`. Without them Pending changes can't
   build a tool4seller call.
3. **Same period columns everywhere:** `prev_*` and `m0_*` on `hub_ad_group`, `hub_product_ad`, `hub_search_term`; `state` on `hub_product_ad`.
4. **Placements in KPIs:** `tos_*`, `pp_*`, `ros_*` spend (and sales) on `kpi_weekly` / `kpi_monthly`.
5. **Tiers per entity:** expose the campaign / target rows behind `ppc_tier`.
6. **Volume on gap terms:** search volume per term in `hub_term_gap`.
7. **Retire the static generator tables** (1.6) once the new app is live, not before.

## 5. Questions for Grok

1. **Spike alerts.** The database flags spikes for the whole account: daily sales / ad sales / CVR against a baseline,
   threshold 0,4, plus SP drivers. The new page flags individual campaigns (spend spike, ACOS spike, spend without
   sales, budget capped, sales drop), which needs **daily data per campaign** for about 30 days. Can you add a
   `campaign_day` table (campaign_id, day, impressions, clicks, spend, sales, orders, budget)? Or should the page go
   back to account-level spikes?
2. **Codes:** please confirm `std` = defense, `sto` = offense, `mtt` = product targeting, `brb` = branded,
   `brn` = non-branded. `hub_target.match_type` has `Category` and `Theme`, so the app will add both.
3. **Week basis:** is `kpi_weekly.week_start` always a Monday (ISO week)? `sqp_week.week_start` is a Sunday.
   Should the app show SQP weeks as Sun–Sat?
4. **Write-back queue:** keep the queue in the database (e.g. a `dash_change_queue` table, or the existing `dash_kv`
   `changes:plans`) so it is shared by everyone, or per browser? And who builds the server routes that call
   tool4seller: Grok, or us in this app?
5. **Refresh timing:** when does the refresh run each day, and should the app show `refresh_runs.finished_at` as "data as of"?
6. **Search terms:** `hub_search_term` holds the top 6.000 by spend. Is that a hard cap from Agent Central, and should the app say so?

## 6. What changes in the app (our side)

- Hub period switch becomes **Latest week (vs prior) / Month to date** to match the database.
- Tier bands switch to the database's bands.
- Placement names follow the database (`Top of Search on-Amazon`, `Detail Page on-Amazon`, `Other on-Amazon`, `Off Amazon`), shown as short labels.
- Match types add `Category` and `Theme`.
- A server-side data layer (`src/lib/data/*`) replaces the sample files one page at a time, starting with the Weekly Dash. Each page keeps working on sample data until its source is ready.
