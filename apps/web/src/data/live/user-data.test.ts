// Phase 4 사용자 데이터 슬라이스 테스트 — 오프라인(네트워크·DB·키 불요).
//
// 두 관점:
//   1) user-data 매핑: 가짜 Database(체이너블 스텁)를 주입해 DB 행 → 도메인 타입
//      정규화(ISO 날짜·congestion 기본값·필드 통과)를 잠근다.
//   2) LiveRepository 폴백 계약(핵심 안전성): DATABASE_URL 이 없으면(테스트 env)
//      세션이 성립할 수 없으므로 모든 사용자 메서드가 mock 과 동일하게 동작해야 한다
//      → 데모/`pnpm dev`(mock)·DB 미배포 환경 무중단 보장.

import { describe, expect, it } from "vitest";
import { fetchOnboardingPreference, fetchReviews, fetchUserProfile, fetchVisits } from "@/server/db/user-data";
import type { Database } from "@/server/db";
import { MockRepository } from "../mock/repository";
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

describe("LiveRepository 사용자 데이터 폴백(무 DB/세션 → mock 동일)", () => {
  it("getCurrentUser/listReviews/listVisits 가 mock 과 동일하게 폴백한다", async () => {
    const live = new LiveRepository();
    const mock = new MockRepository();

    const [lu, mu] = [await live.getCurrentUser(), await mock.getCurrentUser()];
    expect(lu).toEqual(mu);
    expect(lu).not.toBeNull();

    expect(await live.listReviews()).toEqual(await mock.listReviews());
    expect(await live.listVisits()).toEqual(await mock.listVisits());
  });

  it("listSavedThemeIds 는 시드를 돌려주고, setThemeSaved 가 인메모리로 토글된다", async () => {
    const live = new LiveRepository();
    const before = await live.listSavedThemeIds();
    expect(before.length).toBeGreaterThan(0);

    await live.setThemeSaved("__new-theme__", true);
    expect(await live.listSavedThemeIds()).toContain("__new-theme__");

    const target = before[0]!;
    await live.setThemeSaved(target, false);
    expect(await live.listSavedThemeIds()).not.toContain(target);
  });
});
