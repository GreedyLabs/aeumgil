// ─────────────────────────────────────────────
// 기동 워밍 — 재배포 직후 콜드 캐시 완화 (운영-준비-플랜 §2.3).
//
// 재배포 직후는 트래픽과 콜드 캐시가 정확히 겹치는 시점이다(§5.1). 첫 사용자가
// 공공 API 팬아웃(타임아웃 8s×여러 건)을 그대로 맞지 않도록, 서버 기동 시
// 실시간 키(wx:* / air:*)를 백그라운드로 1회 프리페치해 둔다.
//   - 대상: 큐레이션 스팟이 실제로 조회하는 키만 — KMA 격자(중복 제거), 스팟 권역.
//     repository.ts enrich 와 동일한 캐시 키·TTL 이라 워밍 결과가 그대로 HIT 된다.
//   - 베스트 에포트: 개별 실패는 삼키고 요약만 남긴다. 기동을 막지 않는다(instrumentation
//     에서 await 없이 발사). 서비스키 미설정이면 해당 API 는 건너뛴다.
// ─────────────────────────────────────────────

import { env } from "@/lib/env";
import { apiCache } from "@/server/cache";
import { createLogger } from "@/server/log";
import { getWeatherByCoords, weatherCacheKey } from "@/server/public-api/kma";
import { getAirForStation } from "@/server/public-api/airkorea";
import { REGIONS, type RegionKey } from "@/server/public-api/regions";
import { SPOT_MAPPING } from "@/data/live/spot-mapping";

const log = createLogger("warmup");

/** repository.ts enrich 와 동일 TTL(30분) — 값이 어긋나면 워밍이 무효가 된다. */
const TTL_MS = 30 * 60 * 1000;

/** 테스트에서 실호출·캐시를 대체하기 위한 주입 포트. */
export interface WarmupDeps {
  cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
  weather(lat: number, lon: number): Promise<unknown>;
  air(station: string): Promise<unknown>;
  hasWeatherKey: boolean;
  hasAirKey: boolean;
}

function defaultDeps(): WarmupDeps {
  return {
    cached: apiCache.cached,
    weather: getWeatherByCoords,
    air: getAirForStation,
    hasWeatherKey: Boolean(env.DATA_GO_KR_SERVICE_KEY),
    hasAirKey: Boolean(env.DATA_GO_KR_SERVICE_KEY),
  };
}

/**
 * 실시간 캐시(wx:*, air:*) 프리페치. 성공/실패 건수를 반환한다(테스트·로그용).
 * 던지지 않는다 — 호출부(instrumentation)가 결과를 기다리지 않아도 안전하다.
 */
export async function warmupRealtimeCaches(
  deps: WarmupDeps = defaultDeps(),
): Promise<{ ok: number; failed: number; skipped: boolean }> {
  const tasks: Array<Promise<unknown>> = [];

  // 날씨: 스팟 좌표를 격자 캐시 키로 묶어 중복 제거(같은 격자는 실호출 1회).
  if (deps.hasWeatherKey) {
    const grids = new Map<string, { lat: number; lon: number }>();
    for (const m of Object.values(SPOT_MAPPING)) {
      const key = weatherCacheKey(m.lat, m.lon);
      if (!grids.has(key)) grids.set(key, { lat: m.lat, lon: m.lon });
    }
    for (const [key, { lat, lon }] of grids) {
      tasks.push(deps.cached(key, TTL_MS, () => deps.weather(lat, lon)));
    }
  }

  // 대기질: 스팟이 참조하는 권역만(전체 8권역이 아니라 실제 핫 키).
  if (deps.hasAirKey) {
    const regions = new Set<RegionKey>(Object.values(SPOT_MAPPING).map((m) => m.region));
    for (const region of regions) {
      const station = REGIONS[region].station;
      tasks.push(deps.cached(`air:${region}`, TTL_MS, () => deps.air(station)));
    }
  }

  if (tasks.length === 0) {
    log.log("skip (서비스키 미설정)");
    return { ok: 0, failed: 0, skipped: true };
  }

  const elapsed = log.timer();
  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === "rejected").length;
  const ok = results.length - failed;
  if (failed > 0) log.warn(`prefetch ${ok}/${results.length} ok, ${failed} failed (${elapsed()}ms)`);
  else log.log(`prefetch ${ok}/${results.length} ok (${elapsed()}ms)`);
  return { ok, failed, skipped: false };
}
