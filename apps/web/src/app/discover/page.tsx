import { Suspense } from "react";
import { MapView } from "@/components/screens/map";
import { DiscoverView } from "@/components/screens/discover";
import { RegionVisitors } from "@/components/screens/region-visitors";
import { FestivalList } from "@/components/screens/festival-list";
import { getRepository } from "@/data";
import { randomUUID } from "node:crypto";
import { orderDiscoverThemes } from "@/domain/theme-exposure";
import { LanguageBoundary } from "@/components/language-boundary";
import { requestLanguage } from "@/server/request-language";
import { uiText } from "@/lib/i18n";

async function Festivals() {
  return <FestivalList listing={await getRepository().listFestivals()} />;
}

async function Visitors() {
  return <RegionVisitors snapshot={await getRepository().getRegionalVisitors()} />;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    region?: string;
    category?: string;
    accessibility?: string;
    page?: string;
  }>;
}) {
  const [params, lang] = await Promise.all([searchParams, requestLanguage()]);
  const activeTab = ["themes", "places", "festivals", "visitors"].includes(params.tab || "")
    ? params.tab!
    : "themes";
  const themes =
    activeTab === "themes"
      ? orderDiscoverThemes(await getRepository().listThemes(), randomUUID())
      : [];
  const places =
    activeTab === "places"
      ? await getRepository().searchSpots({ ...params, page: Number(params.page || 1) })
      : null;
  return (
    <DiscoverView
      themes={themes}
      activeTab={activeTab}
      places={places && <MapView result={places} embedded />}
      visitors={
        activeTab === "visitors" && (
          <LanguageBoundary lang={lang}>
            <Suspense
              fallback={<p role="status">{uiText("지역 방문 통계를 확인하고 있어요…", lang)}</p>}
            >
              <Visitors />
            </Suspense>
          </LanguageBoundary>
        )
      }
      festivals={
        activeTab === "festivals" && (
          <LanguageBoundary lang={lang}>
            <Suspense
              fallback={
                <p role="status" className="section-description">
                  {uiText("다가오는 행사를 확인하고 있어요…", lang)}
                </p>
              }
            >
              <Festivals />
            </Suspense>
          </LanguageBoundary>
        )
      }
    />
  );
}
