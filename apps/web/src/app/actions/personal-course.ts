"use server";
import { revalidatePath } from "next/cache";
import { getRepository } from "@/data";
import {
  personalCourseInput,
  type PersonalCourse,
  type PersonalCourseInput,
} from "@/domain/personal-course";
import type { PlaceSearchQuery } from "@/domain/place-search";

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
export async function searchCoursePlacesAction(query: PlaceSearchQuery) {
  const repo = getRepository();
  if (!(await repo.getCurrentUser())) throw new Error("로그인이 필요해요.");
  return repo.searchSpots(query);
}
