import { describe, expect, it } from "vitest";
import { estimateDrive, estimateRouteMinutes, extraRouteMinutes, routePenaltyPoints } from "./travel-time";

const gangneung = { lat: 37.7713, lon: 128.9472, region: "강릉" };
const sacheon = { lat: 37.8368, lon: 128.8782, region: "강릉" };
const sokcho = { lat: 38.204, lon: 128.5906, region: "속초" };
const samcheok = { lat: 37.289, lon: 129.17, region: "삼척" };

describe("travel-time", () => {
  it("좌표 간 도로 이동시간을 분 단위로 근사한다", () => {
    const near = estimateDrive(gangneung, sacheon);
    const far = estimateDrive(gangneung, sokcho);

    expect(near).not.toBeNull();
    expect(far).not.toBeNull();
    expect(far!.driveMinutes).toBeGreaterThan(near!.driveMinutes);
    expect(far!.distanceKm).toBeGreaterThan(near!.distanceKm);
  });

  it("여러 방문지의 총 이동시간을 합산한다", () => {
    const total = estimateRouteMinutes([gangneung, sacheon, sokcho]);
    const first = estimateDrive(gangneung, sacheon)!.driveMinutes;
    const second = estimateDrive(sacheon, sokcho)!.driveMinutes;

    expect(total).toBe(first + second);
  });

  it("하루 동선에서 멀리 벗어나는 후보에 추가 이동분을 부여한다", () => {
    const nearExtra = extraRouteMinutes(gangneung, sacheon, { next: sokcho });
    const farExtra = extraRouteMinutes(gangneung, samcheok, { next: sokcho });

    expect(farExtra).not.toBeNull();
    expect(nearExtra).not.toBeNull();
    expect(farExtra!).toBeGreaterThan(nearExtra!);
    expect(routePenaltyPoints(gangneung, samcheok, { next: sokcho })).toBeGreaterThan(0);
  });
});
