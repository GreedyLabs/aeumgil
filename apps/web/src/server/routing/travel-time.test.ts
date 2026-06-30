import { describe, expect, it } from "vitest";
import { buildTravelTimeLookup } from "./travel-time";
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
});
