"use server";
import { revalidatePath } from "next/cache";
import { getRepository } from "@/data";
import {
  personalCourseInput,
  type PersonalCourse,
  type PersonalCourseInput,
} from "@/domain/personal-course";
import type { Eat, Stay } from "@/domain/types";
import type { PlaceSearchQuery } from "@/domain/place-search";
import { courseDateProblem } from "@/domain/course-dates";
import {
  courseSpotSearchResult,
  filterCourseCommerce,
  parseCoursePlaceSearch,
  type CoursePlaceSearchResult,
  type CourseSearchKind,
} from "@/domain/course-place-search";
import { requestLanguage } from "@/server/request-language";
import { createCache } from "@/server/cache";

import {
  appendPersonalCourseInput,
  appendPersonalPlaces,
  type AppendPersonalCourseInput,
} from "@/domain/append-personal-course";

// 개인 기록은 캐시하지 않는다. 공개 식당·숙소 DB 목록(현재 약 2,500곳)만 5분간 재사용한다.
const commerceSearchCache = createCache({
  async load() {
    return {};
  },
  async save() {},
});

export async function appendPersonalCourseAction(
  input: AppendPersonalCourseInput,
): Promise<
  | { ok: true; course: PersonalCourse; added: number; skipped: number }
  | { ok: false; error: string }
> {
  const parsed = appendPersonalCourseInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "추가할 코스와 날짜를 확인해 주세요." };
  try {
    const repo = getRepository();
    if (!(await repo.getCurrentUser())) return { ok: false, error: "다시 로그인해 주세요." };
    const current = await repo.getPersonalCourse(parsed.data.courseId);
    if (!current) return { ok: false, error: "추가할 코스를 찾을 수 없어요." };
    if (current.version !== parsed.data.version)
      return {
        ok: false,
        error: "다른 곳에서 이 코스를 변경했어요. 새로고침한 뒤 다시 추가해 주세요.",
      };
    const next = appendPersonalPlaces(current.items, parsed.data.places, parsed.data.day);
    const dateProblem = courseDateProblem(current, next.items);
    if (dateProblem) return { ok: false, error: dateProblem };
    if (!next.added) return { ok: false, error: "선택한 날짜에 이미 모두 담겨 있는 장소예요." };
    if (next.items.length > 30)
      return {
        ok: false,
        error: "한 코스에는 최대 30곳을 담을 수 있어요. 다른 코스를 골라주세요.",
      };
    // 전체 원본과 메타를 보존한다. Repository가 장소 존재 여부와 저장 시점의 버전을 재검증한다.
    const course = await repo.savePersonalCourse({ ...current, items: next.items });
    revalidatePath("/saved");
    revalidatePath(`/my-courses/${course.id}`);
    return { ok: true, course, added: next.added, skipped: next.skipped };
  } catch {
    return {
      ok: false,
      error: "장소를 추가하지 못했어요. 로그인 상태와 코스의 최신 내용을 확인해 주세요.",
    };
  }
}

export async function savePersonalCourseAction(
  input: PersonalCourseInput,
): Promise<{ ok: true; course: PersonalCourse } | { ok: false; error: string }> {
  const parsed = personalCourseInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "코스 내용을 확인해 주세요." };
  try {
    const course = await getRepository().savePersonalCourse(parsed.data);
    revalidatePath("/saved");
    revalidatePath(`/my-courses/${course.id}`);
    return { ok: true, course };
  } catch {
    return {
      ok: false,
      error: "코스를 저장하지 못했어요. 로그인 상태와 다른 탭의 변경 내용을 확인해 주세요.",
    };
  }
}
export async function deletePersonalCourseAction(id: string): Promise<{ ok: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
  try {
    await getRepository().deletePersonalCourse(id);
    revalidatePath("/saved");
    revalidatePath(`/my-courses/${id}`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
export async function searchCoursePlacesAction(
  query: PlaceSearchQuery,
  kind: CourseSearchKind = "spot",
): Promise<CoursePlaceSearchResult> {
  const parsed = parseCoursePlaceSearch(query, kind);
  const repo = getRepository();
  if (!(await repo.getCurrentUser())) throw new Error("로그인이 필요해요.");
  if (parsed.kind === "spot") return courseSpotSearchResult(await repo.searchSpots(parsed.query));
  const catalog = await commerceSearchCache.cached<Array<Eat | Stay>>(
    `course-search:${parsed.kind}:${await requestLanguage()}`,
    5 * 60 * 1000,
    () => (parsed.kind === "eat" ? repo.listEats() : repo.listStays()),
  );
  return filterCourseCommerce(catalog, parsed.query, parsed.kind);
}
