import { describe, expect, it } from "vitest";
import { normalizeUv, uvIssueTime } from "./living-weather";
import { scoreSuitability } from "@/domain/scoring";
describe("생활기상 자외선", () => {
  it("KST 자정 직후에는 전날 21시 발표를 요청한다", () => {
    expect(uvIssueTime(new Date("2026-09-05T15:10:00Z"))).toBe("2026090521");
    expect(uvIssueTime(new Date("2026-09-05T15:40:00Z"))).toBe("2026090600");
  });
  it("발표시각의 h0가 아닌 현재 3시간 구간을 고르고 야간 0도 보존한다", () => {
    const row = { date: "2026090515", h0: "6", h3: "0", h6: "" };
    expect(normalizeUv(row, new Date("2026-09-05T09:10:00Z"))?.index).toBe(0);
    expect(normalizeUv(row, new Date("2026-09-05T12:10:00Z"))).toBeUndefined();
    expect(normalizeUv(row, new Date("2026-09-05T01:00:00Z"))).toBeUndefined();
    expect(normalizeUv({ ...row, h3: "-999" }, new Date("2026-09-05T09:10:00Z"))).toBeUndefined();
  });
  it("자외선이 없으면 기존 적합도를 보존하고 높은 야외 노출만 감점한다", () => {
    const input = {
      congestion: "calm",
      pop: 0,
      windMs: 0,
      pty: 0,
      khaiGrade: 1,
      kind: "beach",
    } as const;
    expect(scoreSuitability(input).suitability).toBe(100);
    expect(scoreSuitability({ ...input, uvIndex: 9 }).suitability).toBe(90);
    expect(scoreSuitability({ ...input, uvIndex: 9, kind: "inland" }).suitability).toBe(95);
  });
});
