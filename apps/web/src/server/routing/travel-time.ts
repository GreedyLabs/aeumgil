// ─────────────────────────────────────────────
// 이동시간 포트 — 서버 계층.
//
// [학습 메모] 코스 생성 순수 함수는 외부 API를 직접 호출하지 않는다. 대신 서버에서
// 길찾기 API 또는 근사 계산으로 "좌표쌍 → 이동시간" 조회 포트를 만든 뒤 주입한다.
// 이렇게 두면 API 실패/키 없음 상황에서는 근사값으로 폴백하고, 나중에 Kakao/Naver 등
// 실제 길찾기 어댑터를 추가해도 composer 의 결정형 계약은 유지된다.
// ─────────────────────────────────────────────

import {
  approxTravelTimeLookup,
  estimateDrive,
  type Coord,
  type TravelEstimate,
  type TravelMode,
  type TravelTimeLookup,
} from "@/domain/travel-time";

export interface DirectionsPort {
  estimate(a: Coord, b: Coord, mode: TravelMode): Promise<TravelEstimate | null>;
}

export interface BuildTravelTimeLookupOptions {
  mode?: TravelMode;
  port?: DirectionsPort;
}

function isCoord(v: unknown): v is Coord {
  const c = v as Partial<Coord>;
  return typeof c?.lat === "number" && Number.isFinite(c.lat) && typeof c.lon === "number" && Number.isFinite(c.lon);
}

function coordKey(c: Coord): string {
  return `${c.lat.toFixed(5)},${c.lon.toFixed(5)},${c.region ?? ""}`;
}

function pairKey(a: Coord, b: Coord, mode: TravelMode): string {
  return `${mode}:${coordKey(a)}->${coordKey(b)}`;
}

export const approximateDirectionsPort: DirectionsPort = {
  async estimate(a, b, mode) {
    return estimateDrive(a, b, mode, approxTravelTimeLookup);
  },
};

function uniqueCoords(coords: Coord[]): Coord[] {
  const seen = new Set<string>();
  const out: Coord[] = [];
  for (const c of coords) {
    if (!isCoord(c)) continue;
    const key = coordKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * 좌표 후보군 전체에 대한 이동시간 매트릭스를 미리 만든다.
 * 실제 API 어댑터는 `port` 로 주입하고, 실패한 구간은 조회 시 근사값으로 폴백한다.
 */
export async function buildTravelTimeLookup(
  coords: Coord[],
  options: BuildTravelTimeLookupOptions = {},
): Promise<TravelTimeLookup> {
  const mode = options.mode ?? "car";
  const port = options.port ?? approximateDirectionsPort;
  const points = uniqueCoords(coords);
  const matrix = new Map<string, TravelEstimate>();

  await Promise.all(
    points.flatMap((from) =>
      points
        .filter((to) => coordKey(to) !== coordKey(from))
        .map(async (to) => {
          try {
            const estimate = await port.estimate(from, to, mode);
            if (estimate) matrix.set(pairKey(from, to, mode), estimate);
          } catch {
            // 구간 단위 실패는 전체 코스 생성을 막지 않는다. 조회 시 근사값으로 폴백한다.
          }
        }),
    ),
  );

  return {
    estimate(a, b, requestedMode = mode) {
      return matrix.get(pairKey(a, b, requestedMode)) ?? approxTravelTimeLookup.estimate(a, b, requestedMode);
    },
  };
}
