import { describe, expect, it } from "vitest";
import { inferCourseOptions, parseCourseOptions } from "./course-options";
describe("여행 조건 전달", () => {
  it("일수·이동·동행·출발권역을 자연어에서 전달한다", () => {
    expect(
      inferCourseOptions("강릉에서 출발해서 부모님과 대중교통으로 1박 2일 여유롭게 여행"),
    ).toEqual({
      days: 2,
      transport: "transit",
      companion: "family",
      pace: "calm",
      startRegion: "강릉",
    });
  });
  it("표현하지 않은 조건을 임의로 만들지 않는다", () => {
    expect(inferCourseOptions("바다 보고 싶어")).toEqual({});
  });
  it("URL의 임의 문자열·과도한 일수를 무시한다", () => {
    expect(
      parseCourseOptions({
        days: "100",
        pace: "hack",
        companion: "x",
        startRegion: "서울",
        transport: "plane",
      }),
    ).toEqual({});
  });
  it("3박 4일·4박 5일을 전달하고 15일을 5일로 오독하지 않는다", () => {
    expect(inferCourseOptions("강원 3박 4일").days).toBe(4);
    expect(inferCourseOptions("동해안 4박5일").days).toBe(5);
    expect(parseCourseOptions({ days: "5" }).days).toBe(5);
    expect(inferCourseOptions("15일 여행").days).toBeUndefined();
    expect(inferCourseOptions("9월 5일에 출발").days).toBeUndefined();
    expect(inferCourseOptions("9월5일 출발").days).toBeUndefined();
    expect(inferCourseOptions("9월5일 출발 1박2일").days).toBe(2);
    expect(inferCourseOptions("9월 5일에 출발해서 2박 3일 강원 여행").days).toBe(3);
  });
});
