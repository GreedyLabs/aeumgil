// Phase 4 사용자 데이터 슬라이스 테스트 — 오프라인(네트워크·DB·키 불요).
//
// 두 관점:
//   1) user-data 매핑: 가짜 Database(체이너블 스텁)를 주입해 DB 행 → 도메인 타입
//      정규화(ISO 날짜·congestion 기본값·필드 통과)를 잠근다.
//   2) LiveRepository 사용자 계약: 미로그인 상태는 mock 사용자로 대체하지 않고 빈 상태를 반환한다.

import { describe, expect, it } from "vitest";
import { fetchOnboardingPreference, fetchReviews, fetchUserProfile, fetchVisits } from "@/server/db/user-data";
import type { Database } from "@/server/db";
import { LiveRepository } from "./repository";

/** await 시 미리 정한 rows 로 resolve 되는 체이너블 가짜 db(인자 무시). */
function fakeDb(rows: unknown[]): Database {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "orderBy", "limit", "groupBy"]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain as unknown as Database;
}

describe("user-data 매핑", () => {
  it("앱 프로필 행을 표시 프로필로 정규화한다", async () => {
    const db = fakeDb([
      { displayName: "에움길러", bio: "조용한 강원 여행", updatedAt: new Date("2026-06-29T03:00:00Z") },
    ]);
    const out = await fetchUserProfile(db, "u1");
    expect(out).toEqual({ displayName: "에움길러", bio: "조용한 강원 여행", updatedAt: "2026-06-29" });
  });

  it("온보딩 선호 행을 도메인 OnboardingPreference 로 정규화한다", async () => {
    const db = fakeDb([
      {
        interestThemeIds: ["quiet-inland", "food-market"],
        paceId: "calm",
        companionId: "couple",
        updatedAt: new Date("2026-06-29T00:30:00Z"),
      },
    ]);
    const out = await fetchOnboardingPreference(db, "u1");
    expect(out).toEqual({
      interestThemeIds: ["quiet-inland", "food-market"],
      paceId: "calm",
      companionId: "couple",
      updatedAt: "2026-06-29",
    });
  });

  it("리뷰 행을 도메인 Review 로 정규화한다(ISO 날짜·필드 통과)", async () => {
    const db = fakeDb([
      { id: "r1", spotId: "sokcho-market", rating: 5, text: "좋아요", helpful: 3, createdAt: new Date("2026-06-01T09:30:00Z") },
    ]);
    const out = await fetchReviews(db, "u1");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "r1", spotId: "sokcho-market", rating: 5, helpful: 3, date: "2026-06-01" });
    expect(out[0]!.text.ko).toBe("좋아요");
  });

  it("방문 행을 정규화하고 congestionThen null 은 moderate 로 기본값 처리한다", async () => {
    const db = fakeDb([
      { id: "v1", spotId: "dongmyeong-port", visitedAt: new Date("2026-05-20T01:00:00Z"), congestionThen: "busy" },
      { id: "v2", spotId: "anmok-beach", visitedAt: new Date("2026-05-21T01:00:00Z"), congestionThen: null },
    ]);
    const out = await fetchVisits(db, "u1");
    expect(out[0]).toMatchObject({ id: "v1", spotId: "dongmyeong-port", date: "2026-05-20", congestionThen: "busy" });
    expect(out[1]!.congestionThen).toBe("moderate");
  });
});

describe("LiveRepository 사용자 데이터", () => {
  it("미로그인 상태는 mock 사용자로 대체하지 않고 빈 상태를 반환한다", async () => {
    const live = new LiveRepository();

    expect(await live.getCurrentUser()).toBeNull();
    expect(await live.listReviews()).toEqual([]);
    expect(await live.listVisits()).toEqual([]);
    expect(await live.listSavedThemeIds()).toEqual([]);
  });

  it("미로그인 저장 변경은 DB 쓰기를 하지 않고 로그인 요구 에러를 낸다", async () => {
    const live = new LiveRepository();
    await expect(live.setThemeSaved("__new-theme__", true)).rejects.toThrow("로그인이 필요합니다.");
  });
});
