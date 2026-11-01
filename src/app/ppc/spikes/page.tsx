import type { Metadata } from "next";
import Spikes from "@/components/ppc/Spikes";

export const metadata: Metadata = { title: "Spike alerts · Sportstech Console" };

export default function SpikesPage() {
  return <Spikes />;
}
