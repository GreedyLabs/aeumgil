import regions from "@/domain/gangwon-regions.json";
import { latLonToGrid, type GridXY } from "./grid";

export type RegionKey =
  | "chuncheon"
  | "wonju"
  | "gangneung"
  | "donghae"
  | "taebaek"
  | "sokcho"
  | "samcheok"
  | "hongcheon"
  | "hoengseong"
  | "yeongwol"
  | "pyeongchang"
  | "jeongseon"
  | "cheorwon"
  | "hwacheon"
  | "yanggu"
  | "inje"
  | "goseong"
  | "yangyang";
export interface RegionInfo {
  key: RegionKey;
  ko: string;
  en: string;
  lat: number;
  lon: number;
  station: string;
}
/** 강원 18개 시군 대표 좌표·측정소. 개별 장소의 날씨는 장소 좌표로 조회한다. */
export const REGIONS = Object.fromEntries(
  regions.map((r) => [r.key, { ...r, key: r.key as RegionKey }]),
) as unknown as Record<RegionKey, RegionInfo>;
export const DISTRICT_CODES = Object.fromEntries(
  regions.map((r) => [r.key, `51${r.code}`]),
) as Record<RegionKey, string>;
export function regionGrid(key: RegionKey): GridXY {
  const r = REGIONS[key];
  return latLonToGrid(r.lat, r.lon);
}
export function gridForSpot(
  coords: { lat: number; lon: number } | null,
  fallback: RegionKey,
): GridXY {
  return coords ? latLonToGrid(coords.lat, coords.lon) : regionGrid(fallback);
}
