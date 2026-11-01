import type { Metadata } from "next";
import Pending from "@/components/changes/Pending";

export const metadata: Metadata = { title: "Pending changes · Sportstech Console" };

export default function PendingPage() {
  return <Pending />;
}
