import type { Metadata } from "next";
import KpiDash from "@/components/kpi/KpiDash";

export const metadata: Metadata = { title: "Weekly KPIs · Sportstech Console" };

export default function KpiPage() {
  return <KpiDash />;
}
