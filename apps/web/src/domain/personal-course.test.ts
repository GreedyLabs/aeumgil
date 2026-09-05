import { expect, it } from "vitest";
import { orderPersonalItems, personalCourseInput } from "./personal-course";
const item = { kind: "spot" as const, refId: "anmok-beach", day: 1, durationMin: 60 };
it("빈 코스와 잘못된 일정·체류시간, 같은 날 중복 장소를 저장하지 않는다", () => {
  for (const items of [
    [],
    [item, item],
    [{ ...item, day: 0 }],
    [{ ...item, durationMin: -1 }],
    Array.from({ length: 31 }, (_, i) => ({ ...item, refId: String(i) })),
  ])
    expect(personalCourseInput.safeParse({ title: "내 여행", note: "", items }).success).toBe(
      false,
    );
  expect(
    personalCourseInput.safeParse({
      title: "내 여행",
      note: "",
      items: [item, { ...item, day: 2 }],
    }).success,
  ).toBe(true);
});
it("다른 날짜를 옮겨도 날짜 내 방문 순서와 원본은 보존한다", () => {
  const rows = [
    { ...item, day: 2 },
    { ...item, refId: "b" },
    { ...item, refId: "c" },
  ];
  expect(orderPersonalItems(rows).map((i) => i.refId)).toEqual(["b", "c", "anmok-beach"]);
  expect(rows[0]?.day).toBe(2);
});
it("기존 개인 코스 수정에는 읽었던 버전이 필요하다", () => {
  const input = {
    title: "코스",
    note: "",
    items: [item],
    id: "123e4567-e89b-12d3-a456-426614174000",
  };
  expect(personalCourseInput.safeParse(input).success).toBe(false);
  expect(personalCourseInput.safeParse({ ...input, version: 0 }).success).toBe(true);
});
