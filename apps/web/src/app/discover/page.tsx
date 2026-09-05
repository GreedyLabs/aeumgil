import { TrafficOverview } from "@/components/screens/traffic-overview";
import { Suspense } from "react";
import { MapView } from "@/components/screens/map";
import { DiscoverView } from "@/components/screens/discover";
import { RegionVisitors } from "@/components/screens/region-visitors";
import { FestivalList } from "@/components/screens/festival-list";
import { getRepository } from "@/data";
import { randomUUID } from "node:crypto";
import { orderDiscoverThemes } from "@/domain/theme-exposure";

async function Festivals() {
  return <FestivalList listing={await getRepository().listFestivals()} />;
}

async function Visitors() {
  const [snapshot, roads] = await Promise.all([
    getRepository().getRegionalVisitors(),
    getRepository().getTravelTraffic(),
  ]);
  return (
    <>
      <RegionVisitors snapshot={snapshot} />
      <TrafficOverview roads={roads} />
    </>
  );
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
  const params = await searchParams;
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
          <Suspense fallback={<p role="status">지역 방문 통계를 확인하고 있어요…</p>}>
            <Visitors />
          </Suspense>
        )
      }
      festivals={
        activeTab === "festivals" && (
          <Suspense
            fallback={
              <p role="status" className="section-description">
                다가오는 행사를 확인하고 있어요…
              </p>
            }
          >
            <Festivals />
          </Suspense>
        )
      }
    />
  );
}
