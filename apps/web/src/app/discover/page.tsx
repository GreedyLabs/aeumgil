import { Suspense } from "react";
import { DiscoverView } from "@/components/screens/discover";
import { RegionVisitors } from "@/components/screens/region-visitors";
import { FestivalList } from "@/components/screens/festival-list";
import { getRepository } from "@/data";

async function Festivals() {
  return <FestivalList listing={await getRepository().listFestivals()} />;
}

async function Visitors() {
  return <RegionVisitors snapshot={await getRepository().getRegionalVisitors()} />;
}

export default async function DiscoverPage() {
  const themes = await getRepository().listThemes();
  return (
    <DiscoverView
      themes={themes}
      visitors={
        <Suspense fallback={<p role="status">지역 방문 통계를 확인하고 있어요…</p>}>
          <Visitors />
        </Suspense>
      }
      festivals={
        <Suspense
          fallback={
            <p role="status" className="section-description">
              다가오는 행사를 확인하고 있어요…
            </p>
          }
        >
          <Festivals />
        </Suspense>
      }
    />
  );
}
