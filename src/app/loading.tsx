import DashSkeleton from "@/components/Skeleton";

// Shown while the page's data streams in (the Supabase fetch, once it replaces the mock).
export default function Loading() {
  return <DashSkeleton />;
}
