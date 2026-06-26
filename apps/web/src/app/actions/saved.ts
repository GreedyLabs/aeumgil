"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/data";

export async function setThemeSavedAction(themeId: string, saved: boolean): Promise<{ saved: boolean }> {
  await getRepository().setThemeSaved(themeId, saved);
  revalidatePath("/saved");
  revalidatePath("/profile");
  revalidatePath(`/course/${themeId}`);
  return { saved };
}
