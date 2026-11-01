import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HubViews from "@/components/hub/HubViews";
import { HUB_VIEWS, viewBy } from "@/components/hub/views";

export function generateStaticParams() {
  return HUB_VIEWS.map((v) => ({ view: v.slug }));
}

export async function generateMetadata({ params }: PageProps<"/hub/[view]">): Promise<Metadata> {
  const { view } = await params;
  return { title: `${viewBy(view)?.label ?? "Ads Hub"} · Ads Hub · Sportstech Console` };
}

// Reading params inside Suspense lets navigation paint the hub frame at once and stream the view in.
async function View({ params }: { params: PageProps<"/hub/[view]">["params"] }) {
  const { view } = await params;
  if (!viewBy(view)) notFound();
  return <HubViews slug={view} />;
}

export default function HubViewPage({ params }: PageProps<"/hub/[view]">) {
  return (
    <Suspense fallback={<section className="panel" style={{ minHeight: 420 }} aria-busy="true" />}>
      <View params={params} />
    </Suspense>
  );
}
