"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import { createReview, createVisit } from "@/server/db/user-data";

const spotIdSchema = z.string().min(1).max(80);
const congestionSchema = z.enum(["calm", "moderate", "busy"]);
const reviewSchema = z.object({
  spotId: spotIdSchema,
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(5).max(600),
});

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireActionContext(): Promise<{ userId: string; db: NonNullable<ReturnType<typeof getDb>> } | ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const db = getDb();
  if (!db) return { ok: false, error: "DB 연결이 없어 저장할 수 없어요." };
  return { userId, db };
}

function revalidateUserData(spotId: string): void {
  revalidatePath("/profile");
  revalidatePath("/reviews");
  revalidatePath(`/spot/${spotId}`);
}

export async function createVisitAction(input: { spotId: string; congestionThen: "calm" | "moderate" | "busy" }): Promise<ActionResult> {
  const parsed = z.object({ spotId: spotIdSchema, congestionThen: congestionSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "방문 기록 값이 올바르지 않아요." };

  const ctx = await requireActionContext();
  if ("ok" in ctx) return ctx;

  await createVisit(ctx.db, ctx.userId, parsed.data);
  revalidateUserData(parsed.data.spotId);
  return { ok: true };
}

export async function createReviewAction(input: { spotId: string; rating: number; text: string }): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "리뷰는 별점과 5자 이상 내용이 필요해요." };

  const ctx = await requireActionContext();
  if ("ok" in ctx) return ctx;

  await createReview(ctx.db, ctx.userId, parsed.data);
  revalidateUserData(parsed.data.spotId);
  return { ok: true };
}
