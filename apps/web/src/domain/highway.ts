import type { HighwayStatus } from "./types";

export const HIGHWAY_ROUTES = [
  { code: "0500", number: "50", name: "영동고속도로" },
  { code: "0600", number: "60", name: "서울양양고속도로" },
  { code: "0650", number: "65", name: "동해고속도로", scope: "삼척–속초 구간" },
] as const;

export const HIGHWAY_MAX_AGE_MS = 20 * 60_000;

/** 여러 검지기를 합친 최저속도의 표시 기준이며 도로공사 공식 소통 등급은 아니다. */
export function highwaySpeedLevel(speed: number): "slow" | "delayed" | "clear" {
  return speed < 40 ? "slow" : speed < 80 ? "delayed" : "clear";
}

export function emptyHighwayStatus(route: (typeof HIGHWAY_ROUTES)[number]): HighwayStatus {
  return {
    routeCode: route.code,
    route: route.name,
    status: "unavailable",
    segments: 0,
    slowSegments: 0,
    delayedSegments: 0,
    staleSegments: 0,
    unavailableSegments: 0,
    details: [],
  };
}
