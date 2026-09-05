import { describe, expect, it } from "vitest";
import { scheduleCourse } from "./course-schedule";
import type { Course, Eat, Spot, Stay } from "./types";
import { L } from "@/lib/i18n";
const spots: Spot[] = [
  { id: "a", lat: 37.77, lon: 128.94 }, { id: "b", lat: 38.2, lon: 128.59 },
].map((s) => ({ ...s, name: L(s.id), region: L("강원"), type: L("해변"), congestion: "calm", suitability: 80, weather: { tempC: 0, desc: L(""), icon: "sun" }, air: L(""), tags: [], rating: 0, reviewCount: 0 }));
const course: Course = { themeId: "sea", title: L("바다"), dayCount: 1, items: [
  { kind: "spot", refId: "a", day: 1, time: "10:00", durationMin: 120 },
  { kind: "spot", refId: "b", day: 1, time: "11:00", durationMin: 60 },
] };
const eat: Eat = {
  id: "meal", name: L("식사"), type: L("음식점"), price: "", rating: 0,
  region: L("강원"), lat: 38.2, lon: 128.59,
};
const stay: Stay = {
  id: "hotel", name: L("숙소"), type: L("숙소"), price: L(""), rating: 0,
  region: L("강원"), lat: 38.2, lon: 128.59,
};
const minuteOf = (time: string) => {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
};
describe("최종 일정 검증", () => {
  it("체류·이동시간이 다음 방문 시각에 반영된다", () => {
    const result = scheduleCourse(course, spots);
    expect(result.items[1]!.time > "12:00").toBe(true);
    expect(result.items[1]!.travelMinutes).toBeGreaterThan(0);
  });
  it("장거리 도보 구간을 하루 일정에 넣지 않는다", () => {
    expect(scheduleCourse(course, spots, "walk").items).toHaveLength(1);
  });

  it("관광지에서 식당으로, 식당에서 다음 관광지로 가는 이동을 각각 식사와 분리한다", () => {
    const result = scheduleCourse({ ...course, items: [
      { kind: "spot", refId: "a", day: 1, time: "10:00", durationMin: 120 },
      { kind: "eat", refId: "meal", day: 1, time: "12:00", durationMin: 60 },
      { kind: "spot", refId: "a", day: 1, time: "13:00", durationMin: 60 },
    ] }, spots, "car", { eats: { meal: eat } });

    const meal = result.items[1]!;
    const afterMeal = result.items[2]!;
    expect(meal.travelMinutes).toBeGreaterThan(0);
    expect(minuteOf(meal.time)).toBe(12 * 60 + meal.travelMinutes!);
    expect(afterMeal.travelMinutes).toBeGreaterThan(0);
    expect(minuteOf(afterMeal.time)).toBe(minuteOf(meal.time) + 60 + afterMeal.travelMinutes!);
  });

  it("식당 좌표가 없는 기존 호출도 식사 종료 이후에 알려진 관광지 간 이동을 반영한다", () => {
    const result = scheduleCourse({ ...course, items: [
      { kind: "spot", refId: "a", day: 1, time: "10:00", durationMin: 120 },
      { kind: "eat", refId: "meal", day: 1, time: "12:00", durationMin: 60 },
      { kind: "spot", refId: "b", day: 1, time: "13:00", durationMin: 60 },
    ] }, spots);
    const next = result.items[2]!;
    expect(result.items[1]!.time).toBe("12:00");
    expect(next.travelMinutes).toBeGreaterThan(0);
    expect(minuteOf(next.time)).toBe(13 * 60 + next.travelMinutes!);
  });

  it("그날 숙소까지 이동을 포함하고 날짜가 바뀌면 첫 장소 이동은 별도로 남긴다", () => {
    const result = scheduleCourse({ ...course, dayCount: 2, items: [
      { kind: "spot", refId: "a", day: 1, time: "18:00", durationMin: 120 },
      { kind: "stay", refId: "hotel", day: 1, time: "20:00" },
      { kind: "spot", refId: "a", day: 2, time: "09:00", durationMin: 60 },
    ] }, spots, "car", { stays: { hotel: stay } });
    const hotel = result.items[1]!;
    expect(hotel.kind).toBe("stay");
    expect(hotel.travelMinutes).toBeGreaterThan(0);
    expect(minuteOf(hotel.time)).toBe(20 * 60 + hotel.travelMinutes!);
    expect(result.items[2]!.time).toBe("09:00");
    expect(result.items[2]!.travelMinutes).toBeUndefined();
  });

  it("숙소 다음에도 같은 날 방문이 있으면 숙소 위치에서 이동을 계산한다", () => {
    const result = scheduleCourse({ ...course, dayCount: 2, items: [
      { kind: "spot", refId: "a", day: 1, time: "10:00", durationMin: 60 },
      { kind: "stay", refId: "hotel", day: 1, time: "12:00", durationMin: 30 },
      { kind: "spot", refId: "a", day: 1, time: "12:30", durationMin: 60 },
      { kind: "spot", refId: "b", day: 2, time: "09:00", durationMin: 60 },
    ] }, spots, "car", { stays: { hotel: stay } });
    const afterHotel = result.items[2]!;
    expect(afterHotel.travelMinutes).toBeGreaterThan(0);
    expect(minuteOf(afterHotel.time)).toBe(minuteOf(result.items[1]!.time) + 30 + afterHotel.travelMinutes!);
  });

  it("도보로 먼 식당은 제외하고 마지막으로 남은 장소를 다음 이동 기준으로 쓴다", () => {
    const result = scheduleCourse({ ...course, items: [
      { kind: "spot", refId: "a", day: 1, time: "10:00", durationMin: 60 },
      { kind: "eat", refId: "meal", day: 1, time: "12:00" },
      { kind: "spot", refId: "a", day: 1, time: "14:00", durationMin: 60 },
    ] }, spots, "walk", { eats: { meal: eat } });
    expect(result.items.map((item) => item.refId)).toEqual(["a", "a"]);
    expect(result.items[1]!.time).toBe("14:00");
  });

  it("이동 재계산 뒤 이전 배치의 travelMinutes를 남기지 않는다", () => {
    const result = scheduleCourse({ ...course, items: [
      { kind: "spot", refId: "a", day: 1, time: "10:00", durationMin: 60, travelMinutes: 999 },
      { kind: "eat", refId: "meal", day: 1, time: "12:00", travelMinutes: 999 },
    ] }, spots);
    expect(result.items.map((item) => item.travelMinutes)).toEqual([undefined, undefined]);
  });

  it("종료 시각을 넘긴 날을 제거한 뒤 남은 일차와 마지막 숙소를 정규화한다", () => {
    const result = scheduleCourse({ ...course, dayCount: 3, items: [
      { kind: "spot", refId: "a", day: 1, time: "10:00", durationMin: 60 },
      { kind: "stay", refId: "hotel", day: 1, time: "18:00" },
      { kind: "spot", refId: "b", day: 2, time: "19:30", durationMin: 60 },
      { kind: "spot", refId: "b", day: 3, time: "10:00", durationMin: 60 },
      { kind: "stay", refId: "hotel", day: 3, time: "18:00" },
    ] }, spots, "car", { stays: { hotel: stay } });
    expect(result.dayCount).toBe(2);
    expect(result.items.map((item) => [item.kind, item.day])).toEqual([
      ["spot", 1], ["stay", 1], ["spot", 2],
    ]);
    expect(result.reorderNote?.ko).toContain("제외");
  });
});
