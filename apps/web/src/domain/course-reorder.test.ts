// 혼잡 기반 코스 재정렬 단위 테스트.

import { describe, expect, it } from "vitest";
import { reorderSpotsByCongestion, type ScheduledSpot } from "./course-reorder";

// 오전에 한산한 스팟(오후 피크 = 해변형)
const morningQuiet = (refId: string, time: string): ScheduledSpot => ({
  refId,
  time,
  hourly: [
    { hour: 9, index: 10 },
    { hour: 15, index: 90 },
  ],
});
// 오후에 한산한 스팟(오전 피크 = 산악형)
const afternoonQuiet = (refId: string, time: string): ScheduledSpot => ({
  refId,
  time,
  hourly: [
    { hour: 9, index: 90 },
    { hour: 15, index: 10 },
  ],
});

describe("reorderSpotsByCongestion", () => {
  it("스팟이 1개면 재정렬하지 않는다", () => {
    const r = reorderSpotsByCongestion([morningQuiet("a", "09:00")]);
    expect(r.changed).toBe(false);
    expect(r.order).toHaveLength(1);
  });

  it("이미 최적 배치면 그대로 둔다(changed=false)", () => {
    // A(오전한산)→09시, B(오후한산)→15시 : 이미 최적
    const r = reorderSpotsByCongestion([morningQuiet("A", "09:00"), afternoonQuiet("B", "15:00")]);
    expect(r.changed).toBe(false);
    expect(r.order.map((o) => o.refId)).toEqual(["A", "B"]);
    expect(r.saved).toBe(0);
  });

  it("뒤바뀐 배치는 한산한 시각으로 swap 한다", () => {
    // A(오전한산)가 15시, B(오후한산)가 09시 → swap 이 유리
    const r = reorderSpotsByCongestion([morningQuiet("A", "15:00"), afternoonQuiet("B", "09:00")]);
    expect(r.changed).toBe(true);
    // 슬롯 시각 집합은 유지, 각 슬롯에 더 한산한 스팟 배정
    const at = (t: string) => r.order.find((o) => o.time === t)!.refId;
    expect(at("09:00")).toBe("A"); // 오전엔 오전한산 A
    expect(at("15:00")).toBe("B"); // 오후엔 오후한산 B
    expect(r.saved).toBeGreaterThan(0);
    expect(r.movedRefIds.sort()).toEqual(["A", "B"]);
  });

  it("슬롯 시각의 집합은 보존된다", () => {
    const r = reorderSpotsByCongestion([morningQuiet("A", "15:00"), afternoonQuiet("B", "09:00")]);
    expect(r.order.map((o) => o.time)).toEqual(["15:00", "09:00"]); // 입력 슬롯 순서 유지
  });

  it("3개 스팟도 총 혼잡이 최소가 되도록 배정한다", () => {
    // 각 스팟이 서로 다른 시각에 뚜렷한 최저점(단일 최소)을 갖도록 구성.
    const curve = (refId: string, time: string, h9: number, h12: number, h15: number): ScheduledSpot => ({
      refId,
      time,
      hourly: [
        { hour: 9, index: h9 },
        { hour: 12, index: h12 },
        { hour: 15, index: h15 },
      ],
    });
    const r = reorderSpotsByCongestion([
      curve("A", "15:00", 10, 40, 90), // 오전 최저
      curve("M", "12:00", 60, 10, 60), // 정오 최저
      curve("B", "09:00", 90, 40, 10), // 오후 최저
    ]);
    const at = (t: string) => r.order.find((o) => o.time === t)!.refId;
    expect(at("09:00")).toBe("A");
    expect(at("12:00")).toBe("M");
    expect(at("15:00")).toBe("B");
    expect(r.changed).toBe(true);
  });
});
