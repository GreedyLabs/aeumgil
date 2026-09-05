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
import { env } from "@/lib/env";
import { apiCache } from "@/server/cache";
import { createLogger } from "@/server/log";

const log = createLogger("routing");
const ROUTE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_API_PAIRS = 80;

export interface DirectionsPort {
  estimate(a: Coord, b: Coord, mode: TravelMode): Promise<TravelEstimate | null>;
}

export interface BuildTravelTimeLookupOptions {
  mode?: TravelMode;
  port?: DirectionsPort;
  /** 실제 API 호출 구간 상한. 초과 구간은 근사값으로 폴백한다. */
  maxApiPairs?: number;
  /**
   * 실호출 우선 대상 쌍(예: 코스 타임라인 인접 구간 + 대체지↔인접 스팟).
   * 지정하면 이 쌍만(상한 내) API 를 태우고, 그 외 쌍은 조회 시 근사값으로 답한다.
   * 미지정 시 전쌍(N×N) — 후보가 많은 호출부는 반드시 지정할 것. (운영-준비-플랜 §3.3)
   */
  apiPairs?: [Coord, Coord][];
}

interface KakaoDirectionsPortOptions {
  apiKey: string;
  fetcher?: typeof fetch;
}

function isCoord(v: unknown): v is Coord {
  const c = v as Partial<Coord>;
  return (
    typeof c?.lat === "number" &&
    Number.isFinite(c.lat) &&
    typeof c.lon === "number" &&
    Number.isFinite(c.lon)
  );
}

function coordKey(c: Coord): string {
  return `${c.lat.toFixed(5)},${c.lon.toFixed(5)},${c.region ?? ""}`;
}

function pairKey(a: Coord, b: Coord, mode: TravelMode): string {
  return `${mode}:${coordKey(a)}->${coordKey(b)}`;
}

function routeCacheKey(a: Coord, b: Coord, mode: TravelMode): string {
  return `route:v2:${mode}:${a.lon.toFixed(5)},${a.lat.toFixed(5)}:${b.lon.toFixed(5)},${b.lat.toFixed(5)}`;
}

export const approximateDirectionsPort: DirectionsPort = {
  async estimate(a, b, mode) {
    return estimateDrive(a, b, mode, approxTravelTimeLookup);
  },
};

export function kakaoDirectionsPort({
  apiKey,
  fetcher = fetch,
}: KakaoDirectionsPortOptions): DirectionsPort {
  return {
    async estimate(a, b, mode) {
      // Kakao Mobility Directions 는 자동차 경로 API다. 대중교통/도보는 현재 근사 포트로 유지한다.
      if (mode !== "car") return null;
      return apiCache.cached(routeCacheKey(a, b, mode), ROUTE_TTL_MS, async () => {
        const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
        url.searchParams.set("origin", `${a.lon},${a.lat}`);
        url.searchParams.set("destination", `${b.lon},${b.lat}`);
        url.searchParams.set("priority", "RECOMMEND");
        url.searchParams.set("car_fuel", "GASOLINE");
        url.searchParams.set("car_hipass", "false");
        url.searchParams.set("alternatives", "false");
        url.searchParams.set("road_details", "true");

        const started = Date.now();
        const res = await fetcher(url, {
          headers: { Authorization: `KakaoAK ${apiKey}` },
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) {
          throw new Error(`Kakao directions HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          routes?: {
            sections?: { roads?: { vertexes?: number[] }[] }[];
            result_code?: number;
            summary?: { distance?: number; duration?: number };
          }[];
        };
        const route = json.routes?.[0];
        if (!route?.summary || (route.result_code ?? 0) !== 0) {
          throw new Error(`Kakao directions result_code ${route?.result_code ?? "missing"}`);
        }
        const distanceM = route.summary.distance;
        const durationSec = route.summary.duration;
        if (typeof distanceM !== "number" || typeof durationSec !== "number") {
          throw new Error("Kakao directions summary missing distance/duration");
        }
        const path: { lat: number; lon: number }[] = [];
        for (const section of route.sections ?? [])
          for (const road of section.roads ?? []) {
            const points = road.vertexes ?? [];
            for (let i = 0; i + 1 < points.length && path.length < 12000; i += 2) {
              const lon = points[i]!,
                lat = points[i + 1]!;
              if (
                Number.isFinite(lat) &&
                Number.isFinite(lon) &&
                lat >= 33 &&
                lat <= 39 &&
                lon >= 124 &&
                lon <= 132
              )
                path.push({ lat, lon });
            }
          }
        if (log.on)
          log.log(`kakao ${coordKey(a)} → ${coordKey(b)} ${Math.round(Date.now() - started)}ms`);
        return {
          distanceKm: Math.round((distanceM / 1000) * 10) / 10,
          driveMinutes: Math.max(1, Math.round(durationSec / 60)),
          mode,
          source: "api",
          ...(path.length > 1 ? { path } : {}),
        };
      });
    },
  };
}

export function routingPortFromEnv(): DirectionsPort {
  if (env.ROUTING_PROVIDER === "kakao" && env.KAKAO_MOBILITY_API_KEY) {
    return kakaoDirectionsPort({ apiKey: env.KAKAO_MOBILITY_API_KEY });
  }
  return approximateDirectionsPort;
}

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
  const port = options.port ?? routingPortFromEnv();
  const maxApiPairs = options.maxApiPairs ?? DEFAULT_MAX_API_PAIRS;
  const points = uniqueCoords(coords);
  const matrix = new Map<string, TravelEstimate>();

  // 근사 포트는 조회 시 폴백 계산과 동일하므로 사전 매트릭스를 만들 필요가 없다.
  if (port !== approximateDirectionsPort) {
    const candidates: [Coord, Coord][] =
      options.apiPairs ??
      points.flatMap((from) => points.map((to) => [from, to] as [Coord, Coord]));

    // 상한은 호출 목록을 먼저 만들어 사전 슬라이스로 적용한다.
    // (병렬 콜백 안에서 카운터를 증가시키는 방식은 상한이 정확히 걸리지 않는다 — §3.3)
    const seen = new Set<string>();
    const attempts: [Coord, Coord][] = [];
    for (const [from, to] of candidates) {
      if (attempts.length >= maxApiPairs) break;
      if (!isCoord(from) || !isCoord(to)) continue;
      if (coordKey(from) === coordKey(to)) continue;
      const key = pairKey(from, to, mode);
      if (seen.has(key)) continue;
      seen.add(key);
      attempts.push([from, to]);
    }

    await Promise.all(
      attempts.map(async ([from, to]) => {
        try {
          const estimate = await port.estimate(from, to, mode);
          if (estimate) matrix.set(pairKey(from, to, mode), estimate);
        } catch {
          // 구간 단위 실패는 전체 코스 생성을 막지 않는다. 조회 시 근사값으로 폴백한다.
        }
      }),
    );
    if (log.on)
      log.log(`lookup built: ${attempts.length} api pair(s) attempted, ${matrix.size} resolved`);
  }

  return {
    estimate(a, b, requestedMode = mode) {
      return (
        matrix.get(pairKey(a, b, requestedMode)) ??
        approxTravelTimeLookup.estimate(a, b, requestedMode)
      );
    },
  };
}
