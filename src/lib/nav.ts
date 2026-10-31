export type NavIcon =
  | "grid"
  | "layers"
  | "trend"
  | "bolt"
  | "tiers"
  | "clock"
  | "vib"
  | "bike"
  | "cross"
  | "row"
  | "dumbbell"
  | "home"
  | "bulb"
  | "megaphone"
  | "folder"
  | "box"
  | "target"
  | "sliders"
  | "search"
  | "hash"
  | "briefcase"
  | "puzzle"
  | "barcode"
  | "pie"
  | "layout"
  | "calendar"
  | "tag"
  | "sprout"
  | "bars"
  | "compare"
  | "alert"
  | "checks"
  | "history";

export type NavLeaf = { label: string; href: string; icon: NavIcon };
export type NavHeading = { heading: string };
export type NavGroup = {
  label: string;
  id: string;
  icon: NavIcon;
  children: (NavLeaf | NavHeading)[];
};
export type NavItem = NavLeaf | NavGroup;
export type NavSection = { name: string; items: NavItem[] };

export const NAV_TITLE = "Sportstech Console";

export const NAV: NavSection[] = [
  {
    name: "Dashboards",
    items: [
      { label: "Weekly Dash", href: "/", icon: "grid" },
      {
        label: "Categories",
        id: "cats",
        icon: "layers",
        children: [
          { label: "Vibration Plates", href: "/vibration-plates/", icon: "vib" },
          { label: "Exercise Bikes", href: "/exercise-bikes/", icon: "bike" },
          { label: "Cross Trainers", href: "/cross-trainers/", icon: "cross" },
          { label: "Rowing Machines", href: "/rowing-machines/", icon: "row" },
          { label: "Strength Training", href: "/strength-training/", icon: "dumbbell" },
          { label: "Treadmills", href: "/treadmills/", icon: "trend" },
          { label: "Benches & Weights", href: "/benches-weights/", icon: "dumbbell" },
          { label: "Small Equipment", href: "/small-equipment/", icon: "layers" },
          { label: "Hoverboards & Scooters", href: "/hoverboards-scooters/", icon: "bolt" },
          { label: "Trampolines", href: "/trampolines/", icon: "grid" },
        ],
      },
    ],
  },
  { name: "KPI", items: [{ label: "Weekly KPIs", href: "/kpi/", icon: "trend" }] },
  {
    name: "PPC tools",
    items: [
      {
        label: "PPC tools",
        id: "ppc",
        icon: "bolt",
        children: [
          { label: "Spike alerts", href: "/ppc/spikes/", icon: "alert" },
          { label: "ACOS & CPC tiers", href: "/ppc/tiers/", icon: "tiers" },
          { label: "Sales heatmap", href: "/ppc/heatmap/", icon: "clock" },
        ],
      },
    ],
  },
  {
    name: "Ads Hub",
    items: [
      {
        label: "Ads Hub",
        id: "hub",
        icon: "megaphone",
        children: [
          { heading: "Start" },
          { label: "Home", href: "/hub/#home", icon: "home" },
          { label: "Improvements", href: "/hub/#impr", icon: "bulb" },
          { heading: "Campaigns" },
          { label: "Campaigns", href: "/hub/#camp", icon: "megaphone" },
          { label: "Ad groups", href: "/hub/#ag", icon: "folder" },
          { label: "Product ads (SKUs)", href: "/hub/#prod", icon: "box" },
          { label: "Targeting", href: "/hub/#tgt", icon: "target" },
          { heading: "Optimize" },
          { label: "Bid optimizer", href: "/hub/#bid", icon: "sliders" },
          { heading: "Search terms" },
          { label: "All search terms", href: "/hub/#st", icon: "search" },
          { label: "N-grams", href: "/hub/#ng", icon: "hash" },
          { heading: "Coverage" },
          { label: "By portfolio", href: "/hub/#pf", icon: "briefcase" },
          { label: "Keyword gaps", href: "/hub/#kwgap", icon: "puzzle" },
          { label: "ASIN gaps", href: "/hub/#asingap", icon: "barcode" },
          { heading: "Performance" },
          { label: "Segments", href: "/hub/#seg", icon: "pie" },
          { label: "Placements", href: "/hub/#plc", icon: "layout" },
          { label: "Order spread", href: "/hub/#os", icon: "calendar" },
          { label: "Trends", href: "/hub/#trd", icon: "trend" },
          { heading: "Keywords" },
          { label: "Label summary", href: "/hub/#lbl", icon: "tag" },
          { label: "Roots", href: "/hub/#root", icon: "sprout" },
          { heading: "SQP" },
          { label: "Monthly trend", href: "/hub/#sqpm", icon: "bars" },
          { label: "Weekly vs category", href: "/hub/#sqpw", icon: "compare" },
        ],
      },
    ],
  },
  {
    name: "Changes",
    items: [
      { label: "Pending changes", href: "/writeback/pending/", icon: "checks" },
      { label: "Change history", href: "/writeback/history/", icon: "history" },
    ],
  },
];

export function isGroup(i: NavItem): i is NavGroup {
  return "children" in i;
}
export function isHeading(i: NavLeaf | NavHeading): i is NavHeading {
  return "heading" in i;
}
