import { HomeView } from "@/components/screens/home";
import { getRepository } from "@/data";
import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { selectHomeThemes } from "@/domain/theme-exposure";
import { Suspense } from "react";
import { TrafficOverview, TrafficOverviewLoading } from "@/components/screens/traffic-overview";
import { LanguageBoundary } from "@/components/language-boundary";
import { requestLanguage } from "@/server/request-language";

async function HomeTraffic() {
  return <TrafficOverview roads={await getRepository().getTravelTraffic()} />;
}

export default async function HomePage() {
  await connection();
  const seed = randomUUID();
  const repo = getRepository();
  const [themes, prompts, hero, lang] = await Promise.all([
    repo.listThemes(),
    repo.getSamplePrompts(),
    repo.getSpot("anmok-beach", { enrich: false }),
    requestLanguage(),
  ]);
  const featured = selectHomeThemes(themes, seed);
  return (
    <HomeView
      themes={featured}
      prompts={prompts}
      bestSpots={hero ? [hero] : []}
      traffic={
        <LanguageBoundary key="home-traffic" lang={lang}>
          <Suspense fallback={<TrafficOverviewLoading />}>
            <HomeTraffic />
          </Suspense>
        </LanguageBoundary>
      }
    />
  );
}
