// 동적 혼잡 산출 단위 테스트 — 계수 방향성·분산 곡선·추천 시간대 검증.
// Date 는 명시 컴포넌트로 생성해 getDay/getHours 가 TZ 무관하게 결정적이다.

import { describe, expect, it } from "vitest";
import { estimateCongestion, type CongestionInput } from "./congestion";

// 2026-08-15 = 토요일(여름 성수기), 15시 = 해변 피크
const beachPeak: CongestionInput = {
  baseline: "busy",
  kind: "beach",
  at: new Date(2026, 7, 15, 15, 0),
  pop: 0,
  pty: 0,
};
// 2026-01-13 = 화요일(겨울 비수기), 08시 = 이른 오전
const beachOffPeak: CongestionInput = {
  baseline: "busy",
  kind: "beach",
  at: new Date(2026, 0, 13, 8, 0),
  pop: 0,
  pty: 0,
};

describe("estimateCongestion", () => {
  it("성수기·주말·피크 시각이 겹치면 busy 이고 지수가 높다", () => {
    const r = estimateCongestion(beachPeak);
    expect(r.level).toBe("busy");
    expect(r.index).toBeGreaterThan(80);
    expect(r.reason.ko).toMatch(/주말|성수기|피크/);
  });

  it("같은 스팟도 비수기·평일·이른 오전이면 한산해진다", () => {
    const peak = estimateCongestion(beachPeak).index;
    const off = estimateCongestion(beachOffPeak).index;
    expect(off).toBeLessThan(peak);
    expect(estimateCongestion(beachOffPeak).level).toBe("calm");
  });

  it("인기 prior 가 높을수록 같은 시각 혼잡 지수가 높다", () => {
    const busy = estimateCongestion(beachPeak).index;
    const calm = estimateCongestion({ ...beachPeak, baseline: "calm" }).index;
    expect(busy).toBeGreaterThan(calm);
  });

  it("강수(pty>0)는 야외(해변)를 실내(시장)보다 더 크게 낮춘다", () => {
    const at = new Date(2026, 7, 15, 15, 0);
    const beachDry = estimateCongestion({ baseline: "busy", kind: "beach", at }).index;
    const beachRain = estimateCongestion({ baseline: "busy", kind: "beach", at, pty: 1 }).index;
    const inlandDry = estimateCongestion({ baseline: "busy", kind: "inland", at }).index;
    const inlandRain = estimateCongestion({ baseline: "busy", kind: "inland", at, pty: 1 }).index;
    const beachDrop = (beachDry - beachRain) / beachDry;
    const inlandDrop = (inlandDry - inlandRain) / inlandDry;
    expect(beachDrop).toBeGreaterThan(inlandDrop);
  });

  it("하루 분산 곡선은 개장시간(8~20시) 13개 구간을 준다", () => {
    const { hourly } = estimateCongestion(beachPeak);
    expect(hourly).toHaveLength(13);
    expect(hourly[0]!.hour).toBe(8);
    expect(hourly[hourly.length - 1]!.hour).toBe(20);
  });

  it("추천 방문 시간대(bestHours)는 곡선의 최저 구간을 가리킨다", () => {
    const { hourly, bestHours } = estimateCongestion(beachPeak);
    expect(bestHours).toHaveLength(2);
    const maxOfBest = Math.max(...bestHours.map((h) => hourly.find((x) => x.hour === h)!.index));
    const others = hourly.filter((x) => !bestHours.includes(x.hour)).map((x) => x.index);
    expect(maxOfBest).toBeLessThanOrEqual(Math.min(...others));
    // 해변(오후 피크) → 이른 오전이 가장 한산
    expect(bestHours[0]).toBeLessThan(12);
  });

  it("busy 시각에는 분산 안내가 한산 시간대를 제안한다", () => {
    const { tip } = estimateCongestion(beachPeak);
    expect(tip.ko).toContain("한산");
    expect(tip.en.length).toBeGreaterThan(0);
  });

  it("지수는 항상 0~100 범위", () => {
    for (const input of [beachPeak, beachOffPeak]) {
      const r = estimateCongestion(input);
      expect(r.index).toBeGreaterThanOrEqual(0);
      expect(r.index).toBeLessThanOrEqual(100);
    }
  });
});
