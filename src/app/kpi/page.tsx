import type { Metadata } from "next";
import KpiDash from "@/components/kpi/KpiDash";
import { getKpi } from "@/lib/data/kpi";

export const metadata: Metadata = { title: "Weekly KPIs · Sportstech Console" };

export default async function KpiPage() {
  const data = await getKpi();
  return <KpiDash data={data} />;
}
