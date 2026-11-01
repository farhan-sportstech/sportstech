"use client";

import type { ComponentType } from "react";
import Home from "./views/Home";
import Improvements from "./views/Improvements";
import Campaigns from "./views/Campaigns";
import AdGroups from "./views/AdGroups";
import ProductAds from "./views/ProductAds";
import Targeting from "./views/Targeting";
import BidOptimizer from "./views/BidOptimizer";
import SearchTerms from "./views/SearchTerms";
import NGrams from "./views/NGrams";
import Portfolios from "./views/Portfolios";
import KeywordGaps from "./views/KeywordGaps";
import AsinGaps from "./views/AsinGaps";
import Segments from "./views/Segments";
import Placements from "./views/Placements";
import OrderSpread from "./views/OrderSpread";
import Trends from "./views/Trends";
import Labels from "./views/Labels";
import Roots from "./views/Roots";
import SqpMonthly from "./views/SqpMonthly";
import SqpWeekly from "./views/SqpWeekly";

const VIEWS: Record<string, ComponentType> = {
  home: Home,
  improvements: Improvements,
  campaigns: Campaigns,
  "ad-groups": AdGroups,
  "product-ads": ProductAds,
  targeting: Targeting,
  "bid-optimizer": BidOptimizer,
  "search-terms": SearchTerms,
  "n-grams": NGrams,
  portfolios: Portfolios,
  "keyword-gaps": KeywordGaps,
  "asin-gaps": AsinGaps,
  segments: Segments,
  placements: Placements,
  "order-spread": OrderSpread,
  trends: Trends,
  labels: Labels,
  roots: Roots,
  "sqp-monthly": SqpMonthly,
  "sqp-weekly": SqpWeekly,
};

export default function HubViews({ slug }: { slug: string }) {
  const V = VIEWS[slug];
  return V ? <V key={slug} /> : null;
}
