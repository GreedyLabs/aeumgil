import { expect, it } from "vitest";
import {
  orderPersonalItems,
  personalCourseInput,
  personalDayStartTime,
  toPersonalDayStartTimes,
  toPersonalItems,
} from "./personal-course";
import { schedulePersonalCourseDay } from "./personal-course-schedule";
import type { CourseItem } from "./types";
import { L } from "@/lib/i18n";
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

it("이동수단과 출발 시간을 보존하고 잘못된 시간은 거절한다", () => {
  const base = { title: "내 여행", note: "", items: [item] };
  expect(personalCourseInput.parse(base)).toMatchObject({ transport: "car", startTime: "09:30" });
  expect(
    personalCourseInput.parse({ ...base, transport: "transit", startTime: "10:45" }),
  ).toMatchObject({ transport: "transit", startTime: "10:45" });
  for (const startTime of ["", "24:00", "09:60", "9:30"])
    expect(personalCourseInput.safeParse({ ...base, startTime }).success).toBe(false);
  expect(personalCourseInput.safeParse({ ...base, transport: "flight" }).success).toBe(false);
});

it("일차별 출발 시간은 양수 안전 정수와 정상 시각만 최대 30개까지 저장한다", () => {
  const base = { title: "내 여행", note: "", items: [item] };
  const valid = { "1": "13:00", "2": "09:00", "9007199254740991": "08:30" };
  const parsed = personalCourseInput.parse({ ...base, dayStartTimes: valid });
  expect(parsed.dayStartTimes).toEqual(valid);
  expect(personalDayStartTime(parsed, 1)).toBe("13:00");
  expect(personalDayStartTime(parsed, 2)).toBe("09:00");
  expect(personalDayStartTime(parsed, 3)).toBe("09:30");
  for (const dayStartTimes of [
    { "0": "09:00" },
    { "01": "09:00" },
    { "1.5": "09:00" },
    { "9007199254740992": "09:00" },
    { "1": "24:00" },
    { "1": "9:30" },
    Object.fromEntries(Array.from({ length: 31 }, (_, index) => [String(index + 1), "09:00"])),
  ])
    expect(personalCourseInput.safeParse({ ...base, dayStartTimes }).success).toBe(false);
  expect(
    personalCourseInput.safeParse({
      ...base,
      dayStartTimes: Object.fromEntries(
        Array.from({ length: 30 }, (_, index) => [String(index + 1), "09:00"]),
      ),
    }).success,
  ).toBe(true);
});

it("추천 복사는 실제 장소가 있는 일차의 첫 시각만 보존하고 기본 시간으로 되돌릴 수 있다", () => {
  const source = [
    { ...item, day: 2, time: "10:30" },
    { ...item, time: "14:30" },
    { ...item, time: "13:00" },
    { ...item, day: 2, time: "09:00" },
  ];
  const copied = toPersonalDayStartTimes(source);
  expect(copied).toEqual({ "1": "13:00", "2": "09:00" });
  expect(source[0]?.time).toBe("10:30");
  delete copied["2"];
  expect(personalDayStartTime({ startTime: "09:30", dayStartTimes: copied }, 2)).toBe("09:30");
});

it("개인 복사에서 점심·숙소 대기 시각을 유지하고 출발이 늦으면 이동 뒤로 미룬다", () => {
  const source: CourseItem[] = [
    { ...item, refId: "spot-a", time: "09:00" },
    { ...item, kind: "eat", refId: "lunch", time: "12:00" },
    { ...item, refId: "spot-b", time: "14:00" },
    { ...item, kind: "stay", refId: "hotel", time: "17:30", durationMin: 480 },
  ];
  const places = Object.fromEntries(
    source.map((row) => [
      row.refId,
      {
        id: row.refId,
        name: L(row.refId),
        lat: 37.3,
        lon: 127.9,
      },
    ]),
  );
  const copied = personalCourseInput.parse({
    title: "식사와 체크인 시각 유지",
    note: "",
    items: toPersonalItems(source),
    startTime: "09:00",
  });
  expect(copied.items.map((row) => row.notBeforeTime)).toEqual([
    "09:00",
    "12:00",
    "14:00",
    "17:30",
  ]);
  expect(schedulePersonalCourseDay(copied, places, 1).stops.map((row) => row.time)).toEqual([
    "09:00",
    "12:00",
    "14:00",
    "17:30",
  ]);
  expect(
    schedulePersonalCourseDay({ ...copied, dayStartTimes: { "1": "15:00" } }, places, 1).stops.map(
      (row) => row.time,
    ),
  ).toEqual(["15:00", "16:04", "17:08", "18:12"]);
  const changed = {
    ...copied,
    items: copied.items.map((row) =>
      row.kind === "stay" ? { ...row, notBeforeTime: "19:00" } : row,
    ),
  };
  expect(schedulePersonalCourseDay(changed, places, 1).stops.at(-1)?.time).toBe("19:00");
  const unconstrained = {
    ...copied,
    items: copied.items.map(({ notBeforeTime: _removed, ...row }) => row),
  };
  expect(schedulePersonalCourseDay(unconstrained, places, 1).stops.map((row) => row.time)).toEqual([
    "09:00",
    "10:04",
    "11:08",
    "12:12",
  ]);
  expect(copied.items.at(-1)?.notBeforeTime).toBe("17:30");
  expect(schedulePersonalCourseDay(copied, places, 1).tooLong).toBe(false);
});

it("방문 예정 시각은 선택 사항이며 잘못된 시각은 저장하지 않는다", () => {
  const base = { title: "내 여행", note: "" };
  for (const notBeforeTime of ["", "24:00", "09:60", "9:30"])
    expect(
      personalCourseInput.safeParse({ ...base, items: [{ ...item, notBeforeTime }] }).success,
    ).toBe(false);
  expect(
    personalCourseInput.parse({ ...base, items: [item] }).items[0]?.notBeforeTime,
  ).toBeUndefined();
});
