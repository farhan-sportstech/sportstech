import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryDash from "@/components/category/CategoryDash";
import DashSkeleton from "@/components/Skeleton";
import { CATEGORY_DEFS } from "@/lib/category";

export function generateStaticParams() {
  return CATEGORY_DEFS.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[category]">): Promise<Metadata> {
  const { category } = await params;
  const def = CATEGORY_DEFS.find((c) => c.slug === category);
  return { title: def ? `${def.title} · Sportstech Console` : "Sportstech Console" };
}

// Reading params inside Suspense lets navigation paint the skeleton at once and stream the page in.
async function Category({ params }: { params: PageProps<"/[category]">["params"] }) {
  const { category } = await params;
  if (!CATEGORY_DEFS.some((c) => c.slug === category)) notFound();
  return <CategoryDash slug={category} />;
}

export default function CategoryPage({ params }: PageProps<"/[category]">) {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Category params={params} />
    </Suspense>
  );
}
