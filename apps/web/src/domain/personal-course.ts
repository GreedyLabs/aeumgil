import { z } from "zod";
import type { CourseItem } from "./types";
import { calendarDay, courseDateProblem } from "./course-dates";

const travelDate = z
  .string()
  .refine((value) => calendarDay(value) !== undefined, "실제 여행 날짜를 확인해 주세요.")
  .optional();
const startTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "출발 시간을 확인해 주세요.");
const dayKey = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((value) => Number.isSafeInteger(Number(value)));
const dayStartTimes = z
  .record(dayKey, startTime)
  .refine(
    (value) => Object.keys(value).length <= 30,
    "날짜별 출발 시간은 최대 30개까지 설정할 수 있어요.",
  );

export const personalCourseDraft = z.object({
  id: z.string().uuid().optional(),
  version: z.number().int().nonnegative().optional(),
  title: z.string().trim().max(60),
  transport: z.enum(["car", "transit", "walk"]).default("car"),
  startTime: startTime.default("09:30"),
  dayStartTimes: dayStartTimes.optional(),
  note: z.string().trim().max(500),
  startDate: travelDate,
  endDate: travelDate,
  items: z
    .array(
      z.object({
        kind: z.enum(["spot", "eat", "stay", "festival"]),
        refId: z.string().min(1).max(100),
        day: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
        durationMin: z.number().int().min(15).max(720),
        notBeforeTime: z
          .string()
          .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "방문 예정 시각을 확인해 주세요.")
          .optional(),
      }),
    )
    .max(30),
});

export const personalCourseInput = personalCourseDraft.superRefine((value, ctx) => {
  const dateProblem = courseDateProblem(value, value.items);
  if (dateProblem) ctx.addIssue({ code: "custom", message: dateProblem, path: ["endDate"] });
  if (!value.title) ctx.addIssue({ code: "custom", message: "코스 이름을 입력해 주세요." });
  if (!value.items.length)
    ctx.addIssue({ code: "custom", message: "장소를 하나 이상 추가해 주세요." });
  const keys = value.items.map((item) => `${item.day}:${item.kind}:${item.refId}`);
  if (new Set(keys).size !== keys.length)
    ctx.addIssue({ code: "custom", message: "같은 날에 같은 장소를 중복 추가할 수 없어요." });
  if (value.id && value.version === undefined)
    ctx.addIssue({ code: "custom", message: "수정할 코스의 버전이 필요해요." });
});
export type PersonalCourseInput = z.infer<typeof personalCourseInput>;
export interface PersonalCourse extends Omit<PersonalCourseInput, "id" | "version"> {
  id: string;
  version: number;
  updatedAt: string;
}
export type PersonalCourseItem = PersonalCourseInput["items"][number];

/** 따로 정한 일차만 저장한다. 날짜 범위 전체를 순회하거나 배열로 만들지 않는다. */
export function personalDayStartTime(
  course: Pick<PersonalCourseInput, "startTime" | "dayStartTimes">,
  day: number,
): string {
  return course.dayStartTimes?.[String(day)] ?? course.startTime;
}

/** 추천의 첫날 오후 도착과 이후 오전 출발을 개인 코스로 복사한다. */
export function toPersonalDayStartTimes(items: CourseItem[]): Record<string, string> {
  const times: Record<string, string> = {};
  for (const item of items) {
    const key = String(item.day);
    if (times[key] === undefined || item.time < times[key]!) times[key] = item.time;
  }
  return times;
}

/** 각 날짜의 순서를 보존하고 날짜만 정렬한다. 원본 배열은 변경하지 않는다. */
export function orderPersonalItems(items: PersonalCourseItem[]): PersonalCourseItem[] {
  return [...items].sort((a, b) => a.day - b.day);
}
export function toPersonalItems(items: CourseItem[]): PersonalCourseItem[] {
  return items.map((item) => ({
    kind: item.kind,
    refId: item.refId,
    day: item.day,
    durationMin: item.durationMin ?? 60,
    notBeforeTime: item.time,
  }));
}
