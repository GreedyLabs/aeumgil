import { z } from "zod";
import type { PersonalCourseItem } from "./personal-course";

export const appendPersonalCourseInput = z.object({
  courseId: z.string().uuid(),
  version: z.number().int().nonnegative(),
  day: z.number().int().min(1).max(5),
  places: z
    .array(
      z.object({
        kind: z.enum(["spot", "eat", "festival"]),
        refId: z.string().min(1).max(100),
      }),
    )
    .min(1)
    .max(3),
});

export type AppendPersonalCourseInput = z.infer<typeof appendPersonalCourseInput>;
export type CourseAddition = AppendPersonalCourseInput["places"][number];

/** 같은 날의 기존 장소는 유지하고, 새 장소만 선택한 날짜의 마지막에 붙인다. */
export function appendPersonalPlaces(
  current: PersonalCourseItem[],
  additions: CourseAddition[],
  day: number,
): { items: PersonalCourseItem[]; added: number; skipped: number } {
  const keys = new Set(current.map((item) => `${item.day}:${item.kind}:${item.refId}`));
  const fresh: PersonalCourseItem[] = [];
  for (const place of additions) {
    const key = `${day}:${place.kind}:${place.refId}`;
    if (keys.has(key)) continue;
    keys.add(key);
    fresh.push({
      ...place,
      day,
      durationMin: place.kind === "festival" ? 120 : 60,
    });
  }
  return {
    items: [...current, ...fresh].sort((a, b) => a.day - b.day),
    added: fresh.length,
    skipped: additions.length - fresh.length,
  };
}
