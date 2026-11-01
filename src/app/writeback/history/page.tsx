import type { Metadata } from "next";
import History from "@/components/changes/History";

export const metadata: Metadata = { title: "Change history · Sportstech Console" };

export default function HistoryPage() {
  return <History />;
}
