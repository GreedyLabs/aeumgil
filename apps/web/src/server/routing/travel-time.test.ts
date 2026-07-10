import { describe, expect, it } from "vitest";
import { buildTravelTimeLookup, kakaoDirectionsPort } from "./travel-time";
import type { Coord } from "@/domain/travel-time";

const gangneung: Coord = { lat: 37.7713, lon: 128.9472, region: "강릉" };
const sokcho: Coord = { lat: 38.204, lon: 128.5906, region: "속초" };

describe("server routing travel-time", () => {
  it("주입된 길찾기 포트 결과를 동기 lookup 으로 노출한다", async () => {
    const lookup = await buildTravelTimeLookup([gangneung, sokcho], {
      mode: "car",
      port: {
        async estimate(_a, _b, mode) {
          return { distanceKm: 12, driveMinutes: 34, mode, source: "api" };
        },
      },
    });

    expect(lookup.estimate(gangneung, sokcho, "car")).toMatchObject({
      driveMinutes: 34,
      source: "api",
    });
  });

  it("포트 실패 구간은 근사 이동시간으로 폴백한다", async () => {
    const lookup = await buildTravelTimeLookup([gangneung, sokcho], {
      port: {
        async estimate() {
          throw new Error("directions down");
        },
      },
    });

    const estimate = lookup.estimate(gangneung, sokcho, "car");

    expect(estimate).not.toBeNull();
    expect(estimate!.source).toBe("approx");
    expect(estimate!.driveMinutes).toBeGreaterThan(0);
  });

  it("maxApiPairs 상한을 정확히 지킨다 (사전 슬라이스 — §3.3)", async () => {
    let calls = 0;
    const yangyang: Coord = { lat: 38.0754, lon: 128.619, region: "양양" };
    const lookup = await buildTravelTimeLookup([gangneung, sokcho, yangyang], {
      mode: "car",
      maxApiPairs: 3, // 전쌍은 3×2=6쌍
      port: {
        async estimate(_a, _b, mode) {
          calls++;
          return { distanceKm: 10, driveMinutes: 20, mode, source: "api" };
        },
      },
    });

    expect(calls).toBe(3);
    // 상한 밖 쌍도 조회는 근사값으로 항상 답한다.
    expect(lookup.estimate(yangyang, sokcho, "car")).not.toBeNull();
  });

  it("apiPairs 지정 시 그 쌍만 실호출하고 나머지는 근사로 답한다 (§3.3)", async () => {
    const called: string[] = [];
    const lookup = await buildTravelTimeLookup([gangneung, sokcho], {
      mode: "car",
      apiPairs: [
        [gangneung, sokcho],
        [gangneung, sokcho], // 중복은 1회만
        [gangneung, gangneung], // 자기 자신 제외
      ],
      port: {
        async estimate(a, b, mode) {
          called.push(`${a.region}->${b.region}`);
          return { distanceKm: 12, driveMinutes: 34, mode, source: "api" };
        },
      },
    });

    expect(called).toEqual(["강릉->속초"]);
    expect(lookup.estimate(gangneung, sokcho, "car")!.source).toBe("api");
    // 지정하지 않은 역방향은 근사 폴백.
    expect(lookup.estimate(sokcho, gangneung, "car")!.source).toBe("approx");
  });

  it("Kakao Mobility Directions 응답을 TravelEstimate 로 정규화한다", async () => {
    const calls: string[] = [];
    const port = kakaoDirectionsPort({
      apiKey: "test-key",
      fetcher: (async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return {
          ok: true,
          json: async () => ({
            routes: [{ result_code: 0, summary: { distance: 12340, duration: 2340 } }],
          }),
        } as Response;
      }) as typeof fetch,
    });

    const estimate = await port.estimate(gangneung, sokcho, "car");

    expect(estimate).toEqual({ distanceKm: 12.3, driveMinutes: 39, mode: "car", source: "api" });
    expect(calls[0]).toContain("origin=128.9472%2C37.7713");
    expect(calls[0]).toContain("destination=128.5906%2C38.204");
  });

  it("Kakao 어댑터는 자동차 외 이동수단을 호출하지 않고 근사 폴백 대상으로 남긴다", async () => {
    let called = false;
    const port = kakaoDirectionsPort({
      apiKey: "test-key",
      fetcher: (async () => {
        called = true;
        throw new Error("should not fetch");
      }) as typeof fetch,
    });

    expect(await port.estimate(gangneung, sokcho, "walk")).toBeNull();
    expect(called).toBe(false);
  });
});
