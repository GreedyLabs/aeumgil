import { MapView, type MapPoi } from "@/components/screens/map";
import { getRepository } from "@/data";
import { congestionNow, nowKst } from "@/data/live/congestion-now";
import { getSpotMapping } from "@/data/live/spot-mapping";

// 지도는 목록성 화면이라 enrich:false(§2.3) — 혼잡 등급은 시각·요일 기반 모델로
// 서버에서 산출하고, 좌표는 스팟 프로필(없으면 큐레이션 매핑)에서 내려준다.
export default async function MapPage() {
  const spots = await getRepository().listSpots({ enrich: false });
  const at = nowKst();

  const pois: MapPoi[] = spots.flatMap((s) => {
    const m = getSpotMapping(s.id);
    const lat = s.lat ?? m?.lat;
    const lon = s.lon ?? m?.lon;
    if (lat === undefined || lon === undefined) return []; // 좌표 없는 스팟은 지도 미표시
    return [{ id: s.id, name: s.name, lat, lon, congestion: congestionNow(s, at) }];
  });

  return <MapView pois={pois} />;
}
