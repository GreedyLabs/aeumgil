// ─────────────────────────────────────────────
// 큐레이션 스팟 ↔ 외부 데이터 매핑 시드.
//
// LiveRepository 가 각 큐레이션 스팟을 실데이터로 보강할 때 참조한다:
//   - tourContentId : TourAPI detailCommon2 로 이미지/주소/개요 보강 (없으면 생략)
//   - lat/lon       : 기상청 격자·대기질 권역 매칭용 (대표 좌표, 근사값)
//   - region        : 대기질 측정소/권역 폴백 키 (regions.ts)
//   - env           : 적합성 가중치용 장소 성격 (scoring.ts)
//
// 2026-09-05: 법정동 코드 51로 재조회해 8개 POI 확정. 사천진항을 실제 사천진해변으로 정정.
// 주문진 언덕 카페는 실명 POI가 확인되지 않아 임의 매핑하지 않는다.

import type { EnvKind } from "@/domain/scoring";
import type { RegionKey } from "@/server/public-api/regions";

export interface SpotMapping {
  /** TourAPI contentId (확정 전 null) */
  tourContentId: string | null;
  lat: number;
  lon: number;
  region: RegionKey;
  env: EnvKind;
}

/** 큐레이션 스팟 id → 매핑 */
export const SPOT_MAPPING: Record<string, SpotMapping> = {
  "anmok-beach": { tourContentId: "127722", lat: 37.7722617595, lon: 128.9482754051, region: "gangneung", env: "beach" },
  "sacheon-beach": { tourContentId: "585526", lat: 37.8411688239134, lon: 128.8753206888, region: "gangneung", env: "beach" },
  ojukheon: { tourContentId: "129784", lat: 37.7791388748, lon: 128.8796621017, region: "gangneung", env: "inland" },
  "daegwallyeong-sheep": { tourContentId: "129263", lat: 37.6875878491, lon: 128.7533011556, region: "pyeongchang", env: "mountain" },
  "woljeongsa-trail": { tourContentId: "2022311", lat: 37.7311846, lon: 128.5925087, region: "pyeongchang", env: "mountain" },
  "seorak-gwongeum": { tourContentId: "125798", lat: 38.164149, lon: 128.4881826, region: "sokcho", env: "mountain" },
  "sokcho-market": { tourContentId: "1260275", lat: 38.2040463, lon: 128.5905776, region: "sokcho", env: "inland" },
  "dongmyeong-port": { tourContentId: "129454", lat: 38.2114151, lon: 128.5998182, region: "sokcho", env: "beach" },
  "jumunjin-cafe": { tourContentId: null, lat: 37.8939, lon: 128.8311, region: "gangneung", env: "beach" },
};

export function getSpotMapping(spotId: string): SpotMapping | null {
  return SPOT_MAPPING[spotId] ?? null;
}
