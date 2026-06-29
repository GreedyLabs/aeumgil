"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import { setOnboardingPreference } from "@/server/db/user-data";

const preferenceSchema = z.object({
  interestThemeIds: z.array(z.string().min(1).max(80)).min(1).max(12),
  paceId: z.string().min(1).max(80),
  companionId: z.string().min(1).max(80),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setOnboardingPreferenceAction(input: {
  interestThemeIds: string[];
  paceId: string;
  companionId: string;
}): Promise<ActionResult> {
  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "온보딩 선택값이 올바르지 않아요." };

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const db = getDb();
  if (!db) return { ok: false, error: "DB 연결이 없어 저장할 수 없어요." };

  await setOnboardingPreference(db, userId, parsed.data);
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true };
}
