import type { NavIcon as Name } from "@/lib/nav";

type IconName = Name | "chev" | "col" | "menu";

// One 24px grid, 1.7 stroke, round caps: drawn to match, not mixed from libraries.
const PATHS: Record<IconName, React.ReactNode> = {
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  tiers: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3 2 8l10 5 10-5-10-5z" />
      <path d="m2 13 10 5 10-5" />
    </>
  ),
  vib: (
    <>
      <rect x="4" y="15" width="16" height="4" rx="1.5" />
      <path d="M8 15V9h8v6M12 9V4M7 21h10" />
    </>
  ),
  bike: (
    <>
      <circle cx="6" cy="17" r="3.5" />
      <circle cx="18" cy="17" r="3.5" />
      <path d="M6 17l4-8h5l3 8M9 6h3M10 9l2 8" />
    </>
  ),
  cross: <path d="M7 21l4-9 4 9M11 12V4M8 4h6M5 21h14" />,
  row: <path d="M3 18h18M5 18l4-6h6l4 6M12 12V7M9 7h6" />,
  dumbbell: <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />,
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  home: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11v3h3l8 4V7L6 11H3z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  box: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  hash: <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />,
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5h6v2M3 13h18" />
    </>
  ),
  puzzle: <path d="M4 6h6v3a2 2 0 1 0 4 0V6h6v6h-3a2 2 0 1 0 0 4h3v4H4z" />,
  barcode: <path d="M4 5v14M7 5v14M11 5v14M14 5v14M17 5v14M20 5v14" />,
  pie: (
    <>
      <path d="M12 3v9h9" />
      <path d="M20.5 15A9 9 0 1 1 9 3.5" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.2" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5z" />
    </>
  ),
  bars: <path d="M5 20V11M12 20V4M19 20v-6" />,
  compare: <path d="M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7" />,
  alert: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4M12 17v.1" />
    </>
  ),
  checks: (
    <>
      <path d="M10 6h11M10 12h11M10 18h11" />
      <path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 8v4l3 2" />
    </>
  ),
  chev: <path d="m6 9 6 6 6-6" />,
  col: <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
};

export default function Icon({ name, className = "ic" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
