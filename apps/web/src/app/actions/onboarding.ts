"use server";

import { revalidatePath } from "next/cache";
import { travelPreferenceSchema } from "@/domain/travel-preferences";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import { setOnboardingPreference } from "@/server/db/user-data";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setOnboardingPreferenceAction(input: {
  interestThemeIds: string[];
  paceId: string;
  companionId: string;
}): Promise<ActionResult> {
  const parsed = travelPreferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "여행 취향 선택값이 올바르지 않아요." };

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const db = getDb();
  if (!db) return { ok: false, error: "DB 연결이 없어 저장할 수 없어요." };

  try {
    await setOnboardingPreference(db, userId, parsed.data);
  } catch {
    return { ok: false, error: "여행 취향을 저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  for (const path of ["/profile", "/profile/edit", "/onboarding", "/result", "/course/[id]"]) {
    revalidatePath(path, "page");
  }
  return { ok: true };
}
