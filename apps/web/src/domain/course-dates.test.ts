import { describe, expect, it } from "vitest";
import {
  calendarDay,
  calendarDateAt,
  courseDateCount,
  courseDateProblem,
  courseDayLabel,
  dayForCalendarDate,
} from "./course-dates";
import { personalCourseDraft, personalCourseInput } from "./personal-course";
import { appendPersonalCourseInput } from "./append-personal-course";

const base = {
  title: "나의 긴 여행",
  note: "",
  items: [{ kind: "spot", refId: "real-place", day: 8, durationMin: 60 }],
};

describe("실제 여행 날짜", () => {
  it("월말·연말·윤년을 실제 달력 기준으로 계산한다", () => {
    expect(calendarDateAt("2028-02-28", 2)).toBe("2028-02-29");
    expect(calendarDateAt("2028-02-28", 3)).toBe("2028-03-01");
    expect(calendarDateAt("2026-12-31", 2)).toBe("2027-01-01");
    expect(courseDateCount("2026-01-30", "2026-02-07")).toBe(9);
    expect(dayForCalendarDate("2028-02-28", "2028-03-07")).toBe(9);
  });

  it("일광절약시간 전환 주간에도 하루를 고정된 달력 단위로 센다", () => {
    expect(courseDateCount("2026-03-07", "2026-03-09")).toBe(3);
    expect(courseDateCount("2026-10-31", "2026-11-02")).toBe(3);
    expect(calendarDay("2026-03-09")! - calendarDay("2026-03-08")!).toBe(1);
  });

  it("존재하지 않는 날짜와 형식·지원 달력 밖의 날짜를 거절한다", () => {
    for (const date of [
      "",
      "2026-02-29",
      "2100-02-29",
      "2026-04-31",
      "2026-13-01",
      "0000-01-01",
      "2026-1-01",
      "2026-01-01T00:00:00Z",
    ])
      expect(calendarDay(date)).toBeUndefined();
    expect(calendarDay("2000-02-29")).toBeTypeOf("number");
    expect(calendarDateAt("0099-12-31", 2)).toBe("0100-01-01");
    expect(calendarDateAt("9999-12-31", 2)).toBeUndefined();
    expect(calendarDateAt("2026-01-01", Number.MAX_SAFE_INTEGER)).toBeUndefined();
  });

  it("당일 여행과 5일보다 긴 실제 여행을 저장할 수 있다", () => {
    expect(
      personalCourseInput.safeParse({ ...base, startDate: "2028-02-28", endDate: "2028-03-06" })
        .success,
    ).toBe(true);
    expect(
      personalCourseInput.safeParse({
        ...base,
        items: [{ ...base.items[0], day: 1 }],
        startDate: "2026-09-05",
        endDate: "2026-09-05",
      }).success,
    ).toBe(true);
    expect(courseDayLabel(8, "2028-02-28")).toBe("2028.03.06 · Day 8");
  });

  it("날짜 미정은 일차 상한 없이 유지하되 정수·장소 개수 계약은 지킨다", () => {
    for (const day of [6, 31, 366, 1000]) {
      expect(
        personalCourseInput.safeParse({ ...base, items: [{ ...base.items[0], day }] }).success,
      ).toBe(true);
      expect(
        appendPersonalCourseInput.safeParse({
          courseId: "123e4567-e89b-12d3-a456-426614174000",
          version: 0,
          day,
          places: [{ kind: "spot", refId: "place" }],
        }).success,
      ).toBe(true);
    }
    for (const day of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(
        personalCourseInput.safeParse({ ...base, items: [{ ...base.items[0], day }] }).success,
      ).toBe(false);
    expect(
      personalCourseInput.safeParse({
        ...base,
        items: Array.from({ length: 31 }, (_, index) => ({ ...base.items[0], day: index + 1 })),
      }).success,
    ).toBe(false);
  });

  it("한쪽 날짜만 입력한 초안은 복원하되 DB 저장은 거절한다", () => {
    const incomplete = { ...base, startDate: "2026-09-05" };
    expect(personalCourseDraft.safeParse(incomplete).success).toBe(true);
    expect(personalCourseInput.safeParse(incomplete).success).toBe(false);
    expect(courseDateProblem(incomplete, base.items)).toContain("모두 선택");
    expect(
      personalCourseInput.safeParse({ ...base, startDate: "2026-09-05", endDate: "2026-09-04" })
        .success,
    ).toBe(false);
  });

  it("기간을 줄여도 항목을 삭제하지 않고 날짜가 넘은 장소의 일차를 알린다", () => {
    const input = { ...base, startDate: "2026-09-05", endDate: "2026-09-06" };
    const items = structuredClone(input.items);
    expect(courseDateProblem(input, input.items)).toContain("2026.09.12 · Day 8");
    expect(personalCourseInput.safeParse(input).success).toBe(false);
    expect(personalCourseDraft.safeParse(input).success).toBe(true);
    expect(input.items).toEqual(items);
  });
});
