import WeeklyDash from "@/components/WeeklyDash";
import { getHome } from "@/lib/data/home";
import { HomeDataProvider } from "@/lib/homeData";

export default async function Home() {
  const data = await getHome();
  return (
    <HomeDataProvider data={data}>
      <WeeklyDash />
    </HomeDataProvider>
  );
}
