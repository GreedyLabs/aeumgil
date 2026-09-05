// 기동 워밍 테스트 — 운영-준비-플랜 §2.3
// 실호출·캐시를 주입 포트로 대체해 "어떤 키를 몇 번 워밍하는지"를 결정적으로 검증한다.

import { describe, expect, it } from "vitest";
import { warmupRealtimeCaches, type WarmupDeps } from "./warmup";
import { weatherCacheKey } from "@/server/public-api/kma";
import { SPOT_MAPPING } from "@/data/live/spot-mapping";

/** SPOT_MAPPING 에서 기대되는 유니크 격자 키/권역 수를 소스에서 직접 계산. */
const expectedGridKeys = new Set(
  Object.values(SPOT_MAPPING).map((m) => weatherCacheKey(m.lat, m.lon)),
);
const expectedRegions = new Set(Object.values(SPOT_MAPPING).map((m) => m.region));

function makeDeps(overrides: Partial<WarmupDeps> = {}) {
  const cachedKeys: string[] = [];
  let weatherCalls = 0;
  let airCalls = 0;
  const deps: WarmupDeps = {
    cached: (key, _ttl, fn) => {
      cachedKeys.push(key);
      return fn();
    },
    weather: async () => {
      weatherCalls++;
      return {};
    },
    air: async () => {
      airCalls++;
      return {};
    },
    hasWeatherKey: true,
    hasAirKey: true,
    ...overrides,
  };
  return { deps, cachedKeys, counts: () => ({ weatherCalls, airCalls }) };
}

describe("warmupRealtimeCaches", () => {
  it("격자·권역을 중복 제거해 유니크 키만 1회씩 워밍한다", async () => {
    const { deps, cachedKeys, counts } = makeDeps();
    const result = await warmupRealtimeCaches(deps);

    const wxKeys = cachedKeys.filter((k) => k.startsWith("wx:v2:g"));
    const airKeys = cachedKeys.filter((k) => k.startsWith("air:"));
    // 스팟 수(9)보다 적은 유니크 격자만 — 같은 격자 스팟(속초시장/동명항)은 1회 공유
    expect(new Set(wxKeys)).toEqual(expectedGridKeys);
    expect(wxKeys.length).toBe(expectedGridKeys.size);
    expect(wxKeys.length).toBeLessThan(Object.keys(SPOT_MAPPING).length);
    // 권역은 스팟이 참조하는 것만(REGIONS 전체 8개가 아니라)
    expect(new Set(airKeys)).toEqual(new Set([...expectedRegions].map((r) => `air:${r}`)));
    expect(counts()).toEqual({ weatherCalls: wxKeys.length, airCalls: airKeys.length });
    expect(result).toEqual({ ok: cachedKeys.length, failed: 0, skipped: false });
  });

  it("리포지토리 enrich 와 동일한 캐시 키 형식을 쓴다 (워밍 결과가 그대로 HIT)", async () => {
    const { deps, cachedKeys } = makeDeps();
    await warmupRealtimeCaches(deps);
    // repository.ts: weatherCacheKey(lat,lon) / `air:${region}`
    for (const key of cachedKeys) expect(key).toMatch(/^(wx:v2:g-?\d+,-?\d+|air:[a-z]+)$/);
  });

  it("개별 실패를 삼키고 성공/실패 건수만 보고한다 (기동에 영향 없음)", async () => {
    const { deps } = makeDeps({
      weather: async () => {
        throw new Error("KMA 응답 오류");
      },
    });
    const result = await warmupRealtimeCaches(deps);
    expect(result.failed).toBe(expectedGridKeys.size);
    expect(result.ok).toBe(expectedRegions.size);
  });

  it("서비스키가 없으면 해당 API 를 건너뛴다", async () => {
    const { deps, cachedKeys } = makeDeps({ hasWeatherKey: false });
    await warmupRealtimeCaches(deps);
    expect(cachedKeys.every((k) => k.startsWith("air:"))).toBe(true);

    const none = makeDeps({ hasWeatherKey: false, hasAirKey: false });
    const result = await warmupRealtimeCaches(none.deps);
    expect(result).toEqual({ ok: 0, failed: 0, skipped: true });
  });
});
