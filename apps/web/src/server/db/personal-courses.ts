import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { PersonalCourse, PersonalCourseInput } from "@/domain/personal-course";
import { orderPersonalItems } from "@/domain/personal-course";
import type { Database } from "./index";
import { personalCourses } from "./schema";

function toCourse(row: typeof personalCourses.$inferSelect): PersonalCourse {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    transport: row.transport,
    startTime: row.startTime,
    dayStartTimes: row.dayStartTimes ?? {},
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    items: row.items,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}
export async function fetchPersonalCourses(
  db: Database,
  userId: string,
): Promise<PersonalCourse[]> {
  return (
    await db
      .select()
      .from(personalCourses)
      .where(eq(personalCourses.userId, userId))
      .orderBy(desc(personalCourses.updatedAt))
  ).map(toCourse);
}
export async function fetchPersonalCourse(
  db: Database,
  userId: string,
  id: string,
): Promise<PersonalCourse | null> {
  const [row] = await db
    .select()
    .from(personalCourses)
    .where(and(eq(personalCourses.id, id), eq(personalCourses.userId, userId)))
    .limit(1);
  return row ? toCourse(row) : null;
}
export async function savePersonalCourse(
  db: Database,
  userId: string,
  input: PersonalCourseInput,
): Promise<PersonalCourse> {
  const values = {
    title: input.title,
    note: input.note,
    transport: input.transport,
    startTime: input.startTime,
    dayStartTimes: input.dayStartTimes ?? {},
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    items: orderPersonalItems(input.items),
    updatedAt: new Date(),
  };
  if (!input.id) {
    const [row] = await db
      .insert(personalCourses)
      .values({ ...values, id: randomUUID(), userId })
      .returning();
    return toCourse(row!);
  }
  // 소유자와 읽었던 버전을 함께 제한한다. 다른 탭에서 바꾼 내용을 조용히 덮어쓰지 않는다.
  const [row] = await db
    .update(personalCourses)
    .set({ ...values, version: input.version! + 1 })
    .where(
      and(
        eq(personalCourses.id, input.id),
        eq(personalCourses.userId, userId),
        eq(personalCourses.version, input.version!),
      ),
    )
    .returning();
  if (!row) throw new Error("코스가 변경되었거나 더 이상 없어요. 새로고침 후 다시 확인해 주세요.");
  return toCourse(row);
}
export async function removePersonalCourse(
  db: Database,
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(personalCourses)
    .where(and(eq(personalCourses.id, id), eq(personalCourses.userId, userId)));
}
