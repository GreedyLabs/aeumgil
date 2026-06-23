// 방문 적합성 스코어 단위 테스트 — 감점 경계값과 사유 생성 검증.

import { describe, expect, it } from "vitest";
import { scoreSuitability, type ScoreInput } from "./scoring";

const base: ScoreInput = {
  congestion: "calm",
  pop: 0,
  windMs: 0,
  pty: 0,
  khaiGrade: 1,
  kind: "inland",
};

describe("scoreSuitability", () => {
  it("악조건이 전혀 없으면 만점이고 쾌적 사유를 준다", () => {
    const r = scoreSuitability(base);
    expect(r.suitability).toBe(100);
    expect(r.reason.ko).toContain("쾌적");
  });

  it("혼잡(busy)은 감점되고 사유에 '혼잡'이 들어간다", () => {
    const r = scoreSuitability({ ...base, congestion: "busy" });
    expect(r.suitability).toBe(72); // 100 - 28
    expect(r.reason.ko).toContain("혼잡");
  });

  it("강수확률 40% 이하는 감점하지 않는다(경계값)", () => {
    expect(scoreSuitability({ ...base, pop: 40 }).suitability).toBe(100);
  });

  it("강수확률 40% 초과부터 감점한다", () => {
    expect(scoreSuitability({ ...base, pop: 70 }).suitability).toBeLessThan(100);
  });

  it("산악은 같은 강수확률에서 해변보다 더 크게 감점된다(가중치)", () => {
    const mountain = scoreSuitability({ ...base, kind: "mountain", pop: 100 }).suitability;
    const beach = scoreSuitability({ ...base, kind: "beach", pop: 100 }).suitability;
    expect(mountain).toBeLessThan(beach);
  });

  it("강풍 7m/s 이하는 감점하지 않고, 초과하면 감점한다(경계값)", () => {
    expect(scoreSuitability({ ...base, windMs: 7 }).suitability).toBe(100);
    expect(scoreSuitability({ ...base, windMs: 14, kind: "beach" }).suitability).toBeLessThan(100);
  });

  it("대기 매우나쁨(4)은 나쁨(3)보다 더 크게 감점된다", () => {
    const g3 = scoreSuitability({ ...base, khaiGrade: 3 }).suitability;
    const g4 = scoreSuitability({ ...base, khaiGrade: 4 }).suitability;
    expect(g4).toBeLessThan(g3);
    expect(scoreSuitability({ ...base, khaiGrade: 4 }).reason.ko).toContain("매우나쁨");
  });

  it("점수는 0~100 범위로 클램프된다", () => {
    const r = scoreSuitability({
      congestion: "busy",
      pop: 100,
      windMs: 30,
      pty: 2,
      khaiGrade: 4,
      kind: "mountain",
    });
    expect(r.suitability).toBeGreaterThanOrEqual(0);
    expect(r.suitability).toBeLessThanOrEqual(100);
  });
});
