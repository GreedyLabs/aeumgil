import { z } from "zod";
import type { CourseItem } from "./types";

export const personalCourseDraft = z.object({
  id: z.string().uuid().optional(),
  version: z.number().int().nonnegative().optional(),
  title: z.string().trim().max(60),
  transport: z.enum(["car", "transit", "walk"]).default("car"),
  startTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "출발 시간을 확인해 주세요.")
    .default("09:30"),
  note: z.string().trim().max(500),
  items: z
    .array(
      z.object({
        kind: z.enum(["spot", "eat", "stay", "festival"]),
        refId: z.string().min(1).max(100),
        day: z.number().int().min(1).max(5),
        durationMin: z.number().int().min(15).max(720),
      }),
    )
    .max(30),
});

export const personalCourseInput = personalCourseDraft.superRefine((value, ctx) => {
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
  }));
}
