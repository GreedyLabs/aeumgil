// ─────────────────────────────────────────────
// 강원특별자치도 권역 좌표·측정소 테이블 — 동적 데이터 호출의 기준 좌표.
//
// 용도:
//   - 기상청 단기예보: 권역 대표 위경도 → latLonToGrid() → nx/ny
//   - 에어코리아 대기질: sidoName="강원" + 권역 대표 측정소명(stationName)
//
// 큐레이션 스팟은 spot-mapping.ts 에서 이 권역키(RegionKey)를 참조한다.
// 측정소명은 에어코리아 "측정소정보" 기준 명칭. (없으면 시도 평균으로 폴백)
// ─────────────────────────────────────────────

import { latLonToGrid, type GridXY } from "./grid";

/** 강원 권역 키 — 큐레이션 스팟이 참조 */
export type RegionKey =
  | "gangneung"
  | "sokcho"
  | "yangyang"
  | "pyeongchang"
  | "jeongseon"
  | "inje"
  | "chuncheon"
  | "wonju";

export interface RegionInfo {
  key: RegionKey;
  /** 한글/영문 표기 */
  ko: string;
  en: string;
  /** 권역 대표 위경도(WGS84) */
  lat: number;
  lon: number;
  /** 에어코리아 측정소명 (sidoName=강원 기준) */
  station: string;
}

// 측정소명: 에어코리아 강원 실조회(find:content, 40개 측정소 전체 목록) 기준으로 확정.
// 응답에 "중앙동(강원)" 처럼 괄호 접미사가 붙어 오므로 airkorea.ts 에서 괄호·공백을 무시하고
// 매칭한다. 빈 문자열이었던 yangyang/jeongseon/inje 를 실목록의 양양읍/정선읍/인제읍으로 채우고,
// 목록에 없던 chuncheon("석사동")·wonju("명륜동")를 실목록 명칭(온의동·반곡동)으로 보정.
// (현재 9개 스팟은 gangneung/sokcho/pyeongchang 만 사용 — 나머지는 권역표 완성용.)
/** 강원 주요 권역 좌표·측정소 (대표 1점) */
export const REGIONS: Record<RegionKey, RegionInfo> = {
  gangneung: { key: "gangneung", ko: "강릉", en: "Gangneung", lat: 37.7519, lon: 128.8761, station: "옥천동" },
  sokcho: { key: "sokcho", ko: "속초", en: "Sokcho", lat: 38.207, lon: 128.5918, station: "중앙동" },
  yangyang: { key: "yangyang", ko: "양양", en: "Yangyang", lat: 38.0754, lon: 128.6189, station: "양양읍" },
  pyeongchang: { key: "pyeongchang", ko: "평창", en: "Pyeongchang", lat: 37.3705, lon: 128.3902, station: "평창읍" },
  jeongseon: { key: "jeongseon", ko: "정선", en: "Jeongseon", lat: 37.3805, lon: 128.6608, station: "정선읍" },
  inje: { key: "inje", ko: "인제", en: "Inje", lat: 38.0697, lon: 128.1707, station: "인제읍" },
  chuncheon: { key: "chuncheon", ko: "춘천", en: "Chuncheon", lat: 37.8813, lon: 127.7298, station: "온의동" },
  wonju: { key: "wonju", ko: "원주", en: "Wonju", lat: 37.3422, lon: 127.9202, station: "반곡동" },
};

/** 권역 대표 격자 좌표(nx/ny). 미리 계산해 두지 않고 변환식으로 도출. */
export function regionGrid(key: RegionKey): GridXY {
  const r = REGIONS[key];
  return latLonToGrid(r.lat, r.lon);
}

/** 위경도가 있으면 격자, 없으면 권역 대표 격자로 폴백. */
export function gridForSpot(coords: { lat: number; lon: number } | null, fallback: RegionKey): GridXY {
  if (coords) return latLonToGrid(coords.lat, coords.lon);
  return regionGrid(fallback);
}
