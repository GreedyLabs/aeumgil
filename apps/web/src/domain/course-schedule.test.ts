import { describe, expect, it } from "vitest";
import { scheduleCourse } from "./course-schedule";
import type { Course, Spot } from "./types";
import { L } from "@/lib/i18n";
const spots: Spot[] = [
  { id: "a", lat: 37.77, lon: 128.94 }, { id: "b", lat: 38.2, lon: 128.59 },
].map((s) => ({ ...s, name: L(s.id), region: L("강원"), type: L("해변"), congestion: "calm", suitability: 80, weather: { tempC: 0, desc: L(""), icon: "sun" }, air: L(""), tags: [], rating: 0, reviewCount: 0 }));
const course: Course = { themeId: "sea", title: L("바다"), dayCount: 1, items: [
  { kind: "spot", refId: "a", day: 1, time: "10:00", durationMin: 120 },
  { kind: "spot", refId: "b", day: 1, time: "11:00", durationMin: 60 },
] };
describe("최종 일정 검증", () => {
  it("체류·이동시간이 다음 방문 시각에 반영된다", () => {
    const result = scheduleCourse(course, spots);
    expect(result.items[1]!.time > "12:00").toBe(true);
    expect(result.items[1]!.travelMinutes).toBeGreaterThan(0);
  });
  it("장거리 도보 구간을 하루 일정에 넣지 않는다", () => {
    expect(scheduleCourse(course, spots, "walk").items).toHaveLength(1);
  });
});
