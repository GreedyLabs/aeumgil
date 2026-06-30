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
