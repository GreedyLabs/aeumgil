import { TourismMedia } from "@/components/tourism-media";
import type { Spot } from "@/domain/types";
import { requestLanguage } from "@/server/request-language";
import { getSpotTourismMedia } from "@/server/public-api/tourism-media";

/** 상세에서만 미디어를 수집하며 본문·지도·계획 편집의 렌더링은 기다리게 하지 않는다. */
export async function SpotMediaSection({ spot }: { spot: Spot }) {
  if (spot.lat === undefined || spot.lon === undefined) return null;
  const lang = await requestLanguage();
  const media = await getSpotTourismMedia(
    { id: spot.id, nameKo: spot.name.ko, regionKo: spot.region.ko, lat: spot.lat, lng: spot.lon },
    lang,
  );
  return <TourismMedia media={media} lang={lang} />;
}
