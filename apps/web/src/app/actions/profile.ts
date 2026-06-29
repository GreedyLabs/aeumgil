"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import { fetchOnboardingPreference, setOnboardingPreference, setUserProfile } from "@/server/db/user-data";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(20),
  bio: z.string().trim().max(80),
  interestThemeIds: z.array(z.string().min(1).max(80)).min(1).max(12),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateProfileAction(input: {
  displayName: string;
  bio: string;
  interestThemeIds: string[];
}): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "프로필 값이 올바르지 않아요." };

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const db = getDb();
  if (!db) return { ok: false, error: "DB 연결이 없어 저장할 수 없어요." };

  const existingPreference = await fetchOnboardingPreference(db, userId);
  await Promise.all([
    setUserProfile(db, userId, {
      displayName: parsed.data.displayName,
      bio: parsed.data.bio,
    }),
    setOnboardingPreference(db, userId, {
      interestThemeIds: parsed.data.interestThemeIds,
      paceId: existingPreference?.paceId ?? "calm",
      companionId: existingPreference?.companionId ?? "couple",
    }),
  ]);

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { ok: true };
}
