// LiveRepository 테스트 — DB 스팟 기본값 유지(회복력) + 성공 시 실데이터 보강.
// fetch 를 URL 별로 라우팅하는 목으로 막는다.

import { afterEach, describe, expect, it, vi } from "vitest";
import { L } from "@/lib/i18n";
import type { Spot } from "@/domain/types";
import { LiveRepository } from "./repository";

const mocks = vi.hoisted(() => ({
  requireDb: vi.fn(),
  fetchSpotProfile: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  requireDb: mocks.requireDb,
}));

vi.mock("@/server/db/course-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db/course-catalog")>();
  return {
    ...actual,
    fetchSpotProfile: mocks.fetchSpotProfile,
  };
});

vi.mock("@/server/cache", () => ({ apiCache: { cached: async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn() } }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function dbSpot(id: string, congestion: Spot["congestion"] = "calm"): Spot {
  return {
    id,
    name: L(id),
    type: L("항구"),
    region: L("속초"),
    congestion,
    suitability: 75,
    weather: { tempC: 0, desc: L("실시간 확인 전"), icon: "sun" },
    air: L("실시간 확인 전"),
    rating: 4.5,
    reviewCount: 10,
    tags: [L("바다")],
    lat: 38.211,
    lon: 128.597,
  };
}

function routeFetch(routes: { match: string; payload: unknown }[], fail = false) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      if (fail) throw new Error("network down");
      const url = String(input);
      const hit = routes.find((r) => url.includes(r.match));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(hit?.payload ?? {}),
      };
    }),
  );
}

describe("LiveRepository 폴백(회복력)", () => {
  it("외부 API 가 실패하면 해당 스팟은 DB 기본값을 그대로 반환한다", async () => {
    routeFetch([], true); // 모든 fetch 실패
    const base = dbSpot("seorak-gwongeum", "moderate");
    mocks.requireDb.mockReturnValue({ __db: true });
    mocks.fetchSpotProfile.mockResolvedValue(base);
    const live = new LiveRepository();

    const got = await live.getSpot("seorak-gwongeum");
    expect(got?.name).toEqual(base.name);
    expect(got?.weather).toEqual(base.weather);
    expect(got?.suitability).toBe(base.suitability);
    expect(got?.conditions).toMatchObject({ weather: "unavailable", air: "unavailable" });
    expect(got?.crowdHourly).toHaveLength(13);
  });
});

describe("LiveRepository 보강(성공)", () => {
  it("날씨·대기질·적합성을 실데이터로 덮어쓴다", async () => {
    // 동적 혼잡이 실시각에 의존하므로 한산한 시각으로 고정(겨울·평일 오전 KST).
    // 2026-01-12 23:00 UTC = 2026-01-13(화) 08:00 KST → beach 한산 → 혼잡 감점 0.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 12, 23, 0)));
    routeFetch([
      {
        match: "getVilageFcst",
        payload: {
          response: {
            body: {
              items: {
                item: [
                  { category: "TMP", fcstDate: "20260113", fcstTime: "0900", fcstValue: "17" },
                  { category: "POP", fcstDate: "20260113", fcstTime: "0900", fcstValue: "10" },
                  { category: "PTY", fcstDate: "20260113", fcstTime: "0900", fcstValue: "0" },
                  { category: "SKY", fcstDate: "20260113", fcstTime: "0900", fcstValue: "1" },
                  { category: "WSD", fcstDate: "20260113", fcstTime: "0900", fcstValue: "3" },
                ],
              },
            },
          },
        },
      },
      {
        match: "getCtprvnRltmMesureDnsty",
        payload: {
          response: {
            body: { items: [{ stationName: "중앙동(강원)", khaiGrade: "1", pm10Value: "20", pm25Value: "8" }] },
          },
        },
      },
      {
        match: "detailCommon2",
        payload: {
          response: {
            body: { items: { item: [{ contentid: "129454", title: "동명항", overview: "속초 동명항 설명" }] } },
          },
        },
      },
    ]);

    mocks.requireDb.mockReturnValue({ __db: true });
    mocks.fetchSpotProfile.mockResolvedValue(dbSpot("dongmyeong-port", "calm"));
    const live = new LiveRepository();
    const spot = await live.getSpot("dongmyeong-port"); // calm + 맑음 + 대기 좋음
    expect(spot).not.toBeNull();
    expect(spot!.weather.tempC).toBe(17);
    expect(spot!.air.ko).toBe("좋음");
    expect(spot!.congestion).toBe("calm"); // 겨울·평일 오전 → 동적 혼잡 한산
    expect(spot!.crowdTip?.ko).toBeTruthy(); // 분산 안내 노출
    expect(spot!.suitability).toBe(100); // 악조건 없음(한산)
    expect(spot!.description?.ko).toBe("속초 동명항 설명"); // contentId 있어 개요로 보강
  });
});

it("날씨가 실패해도 정상 대기질과 관광 개요는 유지한다", async () => {
  routeFetch([
    { match: "getCtprvnRltmMesureDnsty", payload: { response: { body: { items: [{ stationName: "중앙동", khaiGrade: "2", pm10Value: "31" }] } } } },
    { match: "detailCommon2", payload: { response: { body: { items: { item: [{ contentid: "129454", overview: "실제 관광 개요" }] } } } } },
  ]);
  mocks.requireDb.mockReturnValue({});
  mocks.fetchSpotProfile.mockResolvedValue(dbSpot("dongmyeong-port"));
  const spot = await new LiveRepository().getSpot("dongmyeong-port");
  expect(spot?.air.ko).toBe("보통");
  expect(spot?.description?.ko).toBe("실제 관광 개요");
  expect(spot?.conditions).toMatchObject({ weather: "unavailable", air: "available" });
  expect(spot?.suitability).toBe(75);
});
