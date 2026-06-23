// ─────────────────────────────────────────────
// 큐레이션 스팟 ↔ 외부 데이터 매핑 시드.
//
// LiveRepository 가 각 큐레이션 스팟을 실데이터로 보강할 때 참조한다:
//   - tourContentId : TourAPI detailCommon2 로 이미지/주소/개요 보강 (없으면 생략)
//   - lat/lon       : 기상청 격자·대기질 권역 매칭용 (대표 좌표, 근사값)
//   - region        : 대기질 측정소/권역 폴백 키 (regions.ts)
//   - env           : 적합성 가중치용 장소 성격 (scoring.ts)
//
// tourContentId/좌표 확정 상태 (2026-06-23, find:content = searchKeyword2 강원 실조회):
//   확정: seorak-gwongeum(125798) / dongmyeong-port(129454) / sokcho-market(3354272)
//     / sacheon-beach(2773046, 사천진항 type12 근접 POI) / woljeongsa-trail(2022311,
//     오대산 선재길 type28) — 모두 좌표 실측치로 갱신.
//   contentId 미확정(적합 POI 없음, 좌표 근사 시드 유지):
//     - anmok-beach   : 후보 전부 숙박/음식점(안목해변 POI 없음)
//     - ojukheon      : 후보가 여행코스(type25)뿐, 오죽헌 POI(12) 없음
//     - daegwallyeong-sheep : 후보 "정선 양떼목장"은 평창 대관령과 다른 목장 → 미사용
//     - jumunjin-cafe : 카페 POI 없음(후보는 방파제/캠핑/음식점)
// ─────────────────────────────────────────────

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
  "anmok-beach": { tourContentId: null, lat: 37.7713, lon: 128.9472, region: "gangneung", env: "beach" },
  "sacheon-beach": { tourContentId: "2773046", lat: 37.8368418, lon: 128.8782046, region: "gangneung", env: "beach" },
  ojukheon: { tourContentId: null, lat: 37.7787652, lon: 128.8776815, region: "gangneung", env: "inland" },
  "daegwallyeong-sheep": { tourContentId: null, lat: 37.6889, lon: 128.7178, region: "pyeongchang", env: "mountain" },
  "woljeongsa-trail": { tourContentId: "2022311", lat: 37.7311846, lon: 128.5925087, region: "pyeongchang", env: "mountain" },
  "seorak-gwongeum": { tourContentId: "125798", lat: 38.164149, lon: 128.4881826, region: "sokcho", env: "mountain" },
  "sokcho-market": { tourContentId: "3354272", lat: 38.2040463, lon: 128.5905776, region: "sokcho", env: "inland" },
  "dongmyeong-port": { tourContentId: "129454", lat: 38.2114151, lon: 128.5998182, region: "sokcho", env: "beach" },
  "jumunjin-cafe": { tourContentId: null, lat: 37.8939, lon: 128.8311, region: "gangneung", env: "beach" },
};

export function getSpotMapping(spotId: string): SpotMapping | null {
  return SPOT_MAPPING[spotId] ?? null;
}
