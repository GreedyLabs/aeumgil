// ─────────────────────────────────────────────
// 사용자 데이터 DB 접근 계층 (Phase 4) — 서버 전용.
//
// 설계 의도:
//   - 여기서는 auth() 세션을 모른다. `(db, userId)` 만 받아 순수하게 쿼리하고
//     도메인 타입으로 정규화해 돌려준다 → 가짜 db 를 주입하면 오프라인 단위 테스트 가능.
//   - 세션→userId 해석과 미로그인 처리 판단은 호출자(LiveRepository)가 한다.
//   - Keycloak 전환 후 신원(name/email/image)은 세션 토큰에서 온다. 여기서는
//     앱 DB 에 저장되는 서비스 데이터(저장/리뷰/방문)와 통계만 책임진다 → 관심사 분리.
// ─────────────────────────────────────────────

import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import type { Database } from "./index";
import {
  onboardingPreferences,
  personalCourses,
  reviews,
  savedThemes,
  spotProfiles,
  userProfiles,
  visits,
} from "./schema";
import { L } from "@/lib/i18n";
import type { Congestion, OnboardingPreference, Review, UserStats, Visit } from "@/domain/types";

export interface UserProfileData {
  displayName: string;
  bio: string;
  updatedAt?: string;
}

/** 저장한 추천·개인 코스와 방문한 실제 권역으로 통계를 산출한다. */
export async function computeStats(db: Database, userId: string): Promise<UserStats> {
  const [[saved], [personal], [rev], [vis]] = await Promise.all([
    db.select({ n: count() }).from(savedThemes).where(eq(savedThemes.userId, userId)),
    db.select({ n: count() }).from(personalCourses).where(eq(personalCourses.userId, userId)),
    db.select({ n: count() }).from(reviews).where(eq(reviews.userId, userId)),
    db.select({ n: count() }).from(visits).where(eq(visits.userId, userId)),
  ]);
  const regionRows = await db
    .select({ region: spotProfiles.regionKo })
    .from(visits)
    .innerJoin(spotProfiles, eq(visits.spotId, spotProfiles.spotId))
    .where(eq(visits.userId, userId))
    .groupBy(spotProfiles.regionKo);

  return {
    saved: (saved?.n ?? 0) + (personal?.n ?? 0),
    reviews: rev?.n ?? 0,
    visits: vis?.n ?? 0,
    regions: regionRows.length,
  };
}

export interface SavedThemeRow {
  themeId: string;
  /** 저장 일자 (ISO "YYYY-MM-DD") */
  savedAt: string;
}

/** userId 가 저장한 테마 목록(최근 저장 순) — 저장 일자 포함. */
export async function fetchSavedThemes(db: Database, userId: string): Promise<SavedThemeRow[]> {
  const rows = await db
    .select({ themeId: savedThemes.themeId, savedAt: savedThemes.savedAt })
    .from(savedThemes)
    .where(eq(savedThemes.userId, userId))
    .orderBy(desc(savedThemes.savedAt));
  return rows.map((r) => ({ themeId: r.themeId, savedAt: isoDate(r.savedAt) }));
}

/** userId 가 저장한 테마 id 목록(최근 저장 순). */
export async function fetchSavedThemeIds(db: Database, userId: string): Promise<string[]> {
  return (await fetchSavedThemes(db, userId)).map((r) => r.themeId);
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
    await db
      .delete(savedThemes)
      .where(and(eq(savedThemes.userId, userId), eq(savedThemes.themeId, themeId)));
  }
}

/**
 * 회원 탈퇴 시 앱 DB 의 사용자 데이터 전체 삭제 (§7.2).
 * 앱 DB 에 신원 정보는 없고 `sub` 에 연결된 서비스 데이터만 있으므로,
 * 5개 테이블에서 해당 userId 행을 지우면 파기가 완료된다. 인증 계정(Keycloak)
 * 삭제는 별도 경로(server/keycloak-admin.ts 또는 운영 수동 절차).
 */
export async function deleteUserData(db: Database, userId: string): Promise<void> {
  await Promise.all([
    db.delete(personalCourses).where(eq(personalCourses.userId, userId)),
    db.delete(savedThemes).where(eq(savedThemes.userId, userId)),
    db.delete(reviews).where(eq(reviews.userId, userId)),
    db.delete(visits).where(eq(visits.userId, userId)),
    db.delete(onboardingPreferences).where(eq(onboardingPreferences.userId, userId)),
    db.delete(userProfiles).where(eq(userProfiles.userId, userId)),
  ]);
}

/** 온보딩 선호 조회. 없으면 null 을 돌려 mock 기본값을 유지하게 한다. */
export async function fetchOnboardingPreference(
  db: Database,
  userId: string,
): Promise<OnboardingPreference | null> {
  const [row] = await db
    .select()
    .from(onboardingPreferences)
    .where(eq(onboardingPreferences.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    interestThemeIds: row.interestThemeIds,
    paceId: row.paceId,
    companionId: row.companionId,
    updatedAt: isoDate(row.updatedAt),
  };
}

/** 온보딩 선호 저장. 사용자별 최신값 1행을 upsert 한다. */
export async function setOnboardingPreference(
  db: Database,
  userId: string,
  input: { interestThemeIds: string[]; paceId: string; companionId: string },
): Promise<void> {
  await db
    .insert(onboardingPreferences)
    .values({
      userId,
      interestThemeIds: input.interestThemeIds,
      paceId: input.paceId,
      companionId: input.companionId,
    })
    .onConflictDoUpdate({
      target: onboardingPreferences.userId,
      set: {
        interestThemeIds: input.interestThemeIds,
        paceId: input.paceId,
        companionId: input.companionId,
        updatedAt: new Date(),
      },
    });
}

/** 앱 프로필 조회. Keycloak 신원 위에 표시명/소개만 덮어쓰는 용도. */
export async function fetchUserProfile(
  db: Database,
  userId: string,
): Promise<UserProfileData | null> {
  const [row] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    displayName: row.displayName,
    bio: row.bio,
    updatedAt: isoDate(row.updatedAt),
  };
}

/** 앱 프로필 저장. 사용자별 최신값 1행을 upsert 한다. */
export async function setUserProfile(
  db: Database,
  userId: string,
  input: { displayName: string; bio: string },
): Promise<void> {
  await db
    .insert(userProfiles)
    .values({
      userId,
      displayName: input.displayName,
      bio: input.bio,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        displayName: input.displayName,
        bio: input.bio,
        updatedAt: new Date(),
      },
    });
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

/** 방문 기록 수정. userId 조건을 같이 걸어 소유자 범위를 보장한다. */
export async function updateVisit(
  db: Database,
  userId: string,
  input: { id: string; congestionThen: Congestion },
): Promise<void> {
  await db
    .update(visits)
    .set({ congestionThen: input.congestionThen })
    .where(and(eq(visits.userId, userId), eq(visits.id, input.id)));
}

/** 방문 기록 삭제. userId 조건을 같이 걸어 소유자 범위를 보장한다. */
export async function deleteVisit(db: Database, userId: string, id: string): Promise<void> {
  await db.delete(visits).where(and(eq(visits.userId, userId), eq(visits.id, id)));
}

/**
 * 리뷰 작성.
 *
 * 정책: 사용자 1명은 스팟 1개에 리뷰 1개만 가진다.
 * 이미 작성한 리뷰가 있으면 새 행을 만들지 않고 최신 리뷰를 갱신한다.
 * 과거에 중복 행이 생긴 경우에는 최신 1개를 남기고 나머지를 정리한다.
 */
export async function createReview(
  db: Database,
  userId: string,
  input: { spotId: string; rating: number; text: string },
): Promise<void> {
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.spotId, input.spotId)))
    .orderBy(desc(reviews.createdAt))
    .limit(1);

  if (existing) {
    await db
      .update(reviews)
      .set({ rating: input.rating, text: input.text, createdAt: new Date() })
      .where(and(eq(reviews.userId, userId), eq(reviews.id, existing.id)));
    await db
      .delete(reviews)
      .where(
        and(
          eq(reviews.userId, userId),
          eq(reviews.spotId, input.spotId),
          ne(reviews.id, existing.id),
        ),
      );
    return;
  }

  await db.insert(reviews).values({
    userId,
    spotId: input.spotId,
    rating: input.rating,
    text: input.text,
  });
}

/** 리뷰 수정. userId 조건을 같이 걸어 소유자 범위를 보장한다. */
export async function updateReview(
  db: Database,
  userId: string,
  input: { id: string; rating: number; text: string },
): Promise<void> {
  await db
    .update(reviews)
    .set({ rating: input.rating, text: input.text })
    .where(and(eq(reviews.userId, userId), eq(reviews.id, input.id)));
}

/** 리뷰 삭제. userId 조건을 같이 걸어 소유자 범위를 보장한다. */
export async function deleteReview(db: Database, userId: string, id: string): Promise<void> {
  await db.delete(reviews).where(and(eq(reviews.userId, userId), eq(reviews.id, id)));
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
    id: r.id,
    spotId: r.spotId,
    date: isoDate(r.visitedAt),
    congestionThen: (r.congestionThen as Congestion | null) ?? "moderate",
  }));
}
