import type { Metadata } from "next";
import Tiers from "@/components/ppc/Tiers";

export const metadata: Metadata = { title: "ACOS & CPC tiers · Sportstech Console" };

export default function TiersPage() {
  return <Tiers />;
}
