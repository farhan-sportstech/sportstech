// The Ads Hub views, in sidebar order. `bar: false` hides the shared filter bar on views that don't use it.
export type HubView = { slug: string; label: string; title: string; about: string; bar?: boolean; period?: boolean };

export const HUB_VIEWS: HubView[] = [
  { slug: "home", label: "Home", title: "Ads Hub", about: "the account at a glance", bar: false, period: false },
  { slug: "improvements", label: "Improvements", title: "Improvements", about: "one rule-based to-do list across coverage, bids, budgets and SQP" },
  { slug: "campaigns", label: "Campaigns", title: "Campaigns", about: "every campaign with budget use and performance" },
  { slug: "ad-groups", label: "Ad groups", title: "Ad groups", about: "ad groups with default bids and their targets summed" },
  { slug: "product-ads", label: "Product ads (SKUs)", title: "Product ads", about: "advertised SKUs in Sponsored Products campaigns" },
  { slug: "targeting", label: "Targeting", title: "Targeting", about: "keywords and product targets with bids" },
  { slug: "bid-optimizer", label: "Bid optimizer", title: "Bid optimizer", about: "suggested bids from CPC, ACOS and a target ACOS" },
  { slug: "search-terms", label: "All search terms", title: "Search terms", about: "what shoppers typed, and which target caught it" },
  { slug: "n-grams", label: "N-grams", title: "N-grams", about: "search terms split into words and phrases, metrics summed" },
  { slug: "portfolios", label: "By portfolio", title: "By portfolio", about: "portfolios with budgets, caps and performance" },
  { slug: "keyword-gaps", label: "Keyword gaps", title: "Keyword gaps", about: "search terms that convert but aren't targeted as keywords" },
  { slug: "asin-gaps", label: "ASIN gaps", title: "ASIN gaps", about: "product pages our ads landed on, and whether they are targeted" },
  { slug: "segments", label: "Segments", title: "Segments", about: "targets grouped by ad type, targeting group and match" },
  { slug: "placements", label: "Placements", title: "Placements", about: "Sponsored Products performance by placement" },
  { slug: "order-spread", label: "Order spread", title: "Order spread", about: "how orders and spend spread across terms and targets" },
  { slug: "trends", label: "Trends", title: "Trends", about: "13 weeks of PPC metrics by ad type", bar: false, period: false },
  { slug: "labels", label: "Label summary", title: "Label summary", about: "targets labelled Winner, Converting, High ACOS and more" },
  { slug: "roots", label: "Roots", title: "Roots", about: "the words search terms are built from, with SQP volume" },
  { slug: "sqp-monthly", label: "Monthly trend", title: "SQP monthly", about: "search query performance pivoted by month", bar: false, period: false },
  { slug: "sqp-weekly", label: "Weekly vs category", title: "SQP weekly", about: "our search funnel against the market, week by week", bar: false, period: false },
];
export const viewBy = (slug: string) => HUB_VIEWS.find((v) => v.slug === slug);
