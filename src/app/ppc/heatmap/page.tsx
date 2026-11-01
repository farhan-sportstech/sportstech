import type { Metadata } from "next";
import Heatmap from "@/components/ppc/Heatmap";

export const metadata: Metadata = { title: "Sales heatmap · Sportstech Console" };

export default function HeatmapPage() {
  return <Heatmap />;
}
