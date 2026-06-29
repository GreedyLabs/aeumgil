// ─────────────────────────────────────────────
// 사용자 데이터 DB 접근 계층 (Phase 4) — 서버 전용.
//
// 설계 의도:
//   - 여기서는 auth() 세션을 모른다. `(db, userId)` 만 받아 순수하게 쿼리하고
//     도메인 타입으로 정규화해 돌려준다 → 가짜 db 를 주입하면 오프라인 단위 테스트 가능.
//   - 세션→userId 해석과 "DB 없으면 mock 폴백" 판단은 호출자(LiveRepository)가 한다.
//   - Keycloak 전환 후 신원(name/email/image)은 세션 토큰에서 온다. 여기서는
//     앱 DB 에 저장되는 서비스 데이터(저장/리뷰/방문)와 통계만 책임진다 → 관심사 분리.
// ─────────────────────────────────────────────

import { and, count, desc, eq, sql } from "drizzle-orm";
import type { Database } from "./index";
import { reviews, savedThemes, visits } from "./schema";
import { L } from "@/lib/i18n";
import type { Congestion, Review, UserStats, Visit } from "@/domain/types";

/** 저장/리뷰/방문 카운트 + 방문 권역 수(prefix 근사)로 UserStats 산출. */
export async function computeStats(db: Database, userId: string): Promise<UserStats> {
  const [[saved], [rev], [vis]] = await Promise.all([
    db.select({ n: count() }).from(savedThemes).where(eq(savedThemes.userId, userId)),
    db.select({ n: count() }).from(reviews).where(eq(reviews.userId, userId)),
    db.select({ n: count() }).from(visits).where(eq(visits.userId, userId)),
  ]);
  // 권역 수: spotId 앞 토큰(예: "sokcho-market"→"sokcho")의 distinct 근사.
  const regionRows = await db
    .select({ region: sql<string>`split_part(${visits.spotId}, '-', 1)` })
    .from(visits)
    .where(eq(visits.userId, userId))
    .groupBy(sql`split_part(${visits.spotId}, '-', 1)`);

  return {
    saved: saved?.n ?? 0,
    reviews: rev?.n ?? 0,
    visits: vis?.n ?? 0,
    regions: regionRows.length,
  };
}

/** userId 가 저장한 테마 id 목록(최근 저장 순). */
export async function fetchSavedThemeIds(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ themeId: savedThemes.themeId })
    .from(savedThemes)
    .where(eq(savedThemes.userId, userId))
    .orderBy(desc(savedThemes.savedAt));
  return rows.map((r) => r.themeId);
}

/** 테마 저장/해제 (멱등). */
export async function setSavedTheme(
  db: Database,
  userId: string,
  themeId: string,
  saved: boolean,
): Promise<void> {
  if (saved) {
    await db.insert(savedThemes).values({ userId, themeId }).onConflictDoNothing();
  } else {
    await db.delete(savedThemes).where(and(eq(savedThemes.userId, userId), eq(savedThemes.themeId, themeId)));
  }
}

/** 방문 기록 추가. 같은 장소를 여러 번 방문할 수 있으므로 append-only 로 둔다. */
export async function createVisit(
  db: Database,
  userId: string,
  input: { spotId: string; congestionThen: Congestion },
): Promise<void> {
  await db.insert(visits).values({
    userId,
    spotId: input.spotId,
    congestionThen: input.congestionThen,
  });
}

/** 리뷰 작성. 수정/삭제는 다음 단계에서 id 기준 액션으로 확장한다. */
export async function createReview(
  db: Database,
  userId: string,
  input: { spotId: string; rating: number; text: string },
): Promise<void> {
  await db.insert(reviews).values({
    userId,
    spotId: input.spotId,
    rating: input.rating,
    text: input.text,
  });
}

/** YYYY-MM-DD (도메인 Review/Visit.date 형식). */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** userId 의 리뷰(최근순) → 도메인 Review. text 는 단일 언어 입력이라 ko 로 보관. */
export async function fetchReviews(db: Database, userId: string): Promise<Review[]> {
  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt));
  return rows.map((r) => ({
    id: r.id,
    spotId: r.spotId,
    rating: r.rating,
    date: isoDate(r.createdAt),
    text: L(r.text),
    helpful: r.helpful,
  }));
}

/** userId 의 방문 기록(최근순) → 도메인 Visit. */
export async function fetchVisits(db: Database, userId: string): Promise<Visit[]> {
  const rows = await db
    .select()
    .from(visits)
    .where(eq(visits.userId, userId))
    .orderBy(desc(visits.visitedAt));
  return rows.map((r) => ({
    spotId: r.spotId,
    date: isoDate(r.visitedAt),
    congestionThen: (r.congestionThen as Congestion | null) ?? "moderate",
  }));
}
