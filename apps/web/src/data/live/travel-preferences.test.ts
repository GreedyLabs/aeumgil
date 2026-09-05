import { beforeEach, describe, expect, it, vi } from "vitest";
import { L } from "@/lib/i18n";
import type { ComposeCourseOptions } from "@/domain/course-compose";
import type { Course, Theme } from "@/domain/types";
import { LiveRepository } from "./repository";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  preference: vi.fn(),
  stats: vi.fn(),
  profile: vi.fn(),
  themes: vi.fn(),
  spots: vi.fn(),
  plan: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/db", () => ({ requireDb: () => ({ db: true }) }));
vi.mock("@/server/db/user-data", () => ({
  fetchOnboardingPreference: mocks.preference,
  computeStats: mocks.stats,
  fetchUserProfile: mocks.profile,
}));
vi.mock("@/server/db/course-catalog", () => ({
  fetchThemes: mocks.themes,
  fetchSpotProfiles: mocks.spots,
  fetchSpotProfilesForTheme: mocks.spots,
}));
vi.mock("@/server/agent/planner", () => ({ planItinerary: mocks.plan }));
const theme = (id: string, title: string): Theme => ({
  id,
  title: L(title),
  subtitle: L(""),
  tag: L(""),
  region: L("강릉"),
  hue: 0,
  duration: L("1일"),
  pace: L(""),
  spotCount: 1,
  mood: [],
  blurb: L(""),
});
const themes = [
  theme("gangwon-gangneung-sea", "강릉 바다"),
  theme("gangwon-gangneung-forest", "강릉 숲길"),
];
const base: Course = { themeId: themes[0]!.id, title: L("코스"), dayCount: 1, items: [] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "member-a", name: "여행자" } });
  mocks.preference.mockResolvedValue({
    interestThemeIds: ["topic:sea"],
    paceId: "calm",
    companionId: "family",
  });
  mocks.themes.mockResolvedValue(themes);
  mocks.spots.mockResolvedValue([]);
  mocks.stats.mockResolvedValue({ visits: 0, saved: 0, regions: 0, reviews: 0 });
  mocks.profile.mockResolvedValue(null);
  mocks.plan.mockResolvedValue({ course: base });
});

describe("LiveRepository의 세션별 여행 취향", () => {
  it("미로그인 검색은 공개 카탈로그를 사용하고 사용자 취향을 조회하지 않는다", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await new LiveRepository().matchThemes("강릉 바다")).primaryId).toBe(themes[0]!.id);
    expect(mocks.preference).not.toHaveBeenCalled();
  });
  it("공유 Repository 인스턴스에서도 요청마다 세션 소유자의 취향을 읽는다", async () => {
    const live = new LiveRepository();
    mocks.preference.mockImplementation(async (_db, uid: string) => ({
      interestThemeIds: [uid === "member-a" ? "topic:sea" : "topic:forest"],
      paceId: "",
      companionId: "",
    }));
    expect((await live.matchThemes("강릉 여행")).primaryId).toBe(themes[0]!.id);
    mocks.auth.mockResolvedValue({ user: { id: "member-b" } });
    expect((await live.matchThemes("강릉 여행")).primaryId).toBe(themes[1]!.id);
    expect(mocks.preference.mock.calls.map((call) => call[1])).toEqual(["member-a", "member-b"]);
    expect(mocks.themes).toHaveBeenCalledTimes(2);
  });
  it("프로필과 설정 화면에 기존 DB 취향의 변환값을 제공한다", async () => {
    mocks.preference.mockResolvedValue({
      interestThemeIds: ["east-sea-sunrise"],
      paceId: "active",
      companionId: "solo",
    });
    expect(await new LiveRepository().getCurrentUser()).toMatchObject({
      interests: ["topic:sea"],
      preference: { interestThemeIds: ["topic:sea"], paceId: "active", companionId: "solo" },
    });
  });
  it("직접 연 코스에도 기본 취향을 전달하고 화면에 실제 적용 조건을 돌려준다", async () => {
    const live = new LiveRepository();
    const composer = vi
      .spyOn(
        live as unknown as {
          composeSeedCourse: (id: string, options?: ComposeCourseOptions) => Promise<Course | null>;
        },
        "composeSeedCourse",
      )
      .mockResolvedValue(base);
    const result = await live.getCourse(base.themeId, { days: 2, transport: "walk" });
    expect(composer).toHaveBeenCalledWith(base.themeId, {
      days: 2,
      transport: "walk",
      pace: "calm",
      companion: "family",
    });
    expect(result?.appliedOptions).toEqual({
      days: 2,
      transport: "walk",
      pace: "calm",
      companion: "family",
    });
    expect(result?.preferenceNote?.ko).toContain("저장한 여행 취향");
  });
  it("명시한 페이스·동행이 있으면 취향을 적용했다고 표시하지 않는다", async () => {
    const live = new LiveRepository();
    vi.spyOn(
      live as unknown as {
        composeSeedCourse: (id: string, options?: ComposeCourseOptions) => Promise<Course | null>;
      },
      "composeSeedCourse",
    ).mockResolvedValue(base);
    const result = await live.getCourse(base.themeId, { pace: "active", companion: "solo" });
    expect(result?.appliedOptions).toEqual({ pace: "active", companion: "solo" });
    expect(result?.preferenceNote).toBeUndefined();
  });
});
