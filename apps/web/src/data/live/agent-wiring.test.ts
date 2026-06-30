// B단계 배선 테스트 — LiveRepository.matchThemes 가 에이전트 경로로 동작하는지.
//
// heuristicProvider(키 없는 LLM 대역) + DB 카탈로그 대역 + 도메인 도구만 타므로 네트워크가 필요 없다.
// 검증 관점: Repository 인터페이스 계약(ThemeMatch)을 깨지 않고 유효한 결과를 내는가.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { L } from "@/lib/i18n";
import type { Course, Spot, Theme } from "@/domain/types";
import { LiveRepository } from "./repository";

const mocks = vi.hoisted(() => ({
  requireDb: vi.fn(),
  fetchTheme: vi.fn(),
  fetchThemes: vi.fn(),
  fetchDefaultCourseTemplate: vi.fn(),
  fetchSpotProfiles: vi.fn(),
  fetchSpotProfilesForTheme: vi.fn(),
  fetchSpotProfile: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  requireDb: mocks.requireDb,
}));

vi.mock("@/server/db/course-catalog", () => ({
  fetchTheme: mocks.fetchTheme,
  fetchThemes: mocks.fetchThemes,
  fetchDefaultCourseTemplate: mocks.fetchDefaultCourseTemplate,
  fetchSpotProfiles: mocks.fetchSpotProfiles,
  fetchSpotProfilesForTheme: mocks.fetchSpotProfilesForTheme,
  fetchSpotProfile: mocks.fetchSpotProfile,
}));

function theme(id: string, title: string): Theme {
  return {
    id,
    title: L(title),
    subtitle: L("1일 코스"),
    tag: L(title),
    region: L("강원"),
    hue: 210,
    duration: L("1일"),
    pace: L("균형"),
    spotCount: 2,
    mood: [L(title)],
    blurb: L(`${title} DB 테마`),
  };
}

function spot(id: string, region = "강릉"): Spot {
  return {
    id,
    name: L(id),
    type: L("해변"),
    region: L(region),
    congestion: "moderate",
    suitability: 80,
    weather: { tempC: 0, desc: L("실시간 확인 전"), icon: "sun" },
    air: L("실시간 확인 전"),
    rating: 4.2,
    reviewCount: 3,
    tags: [L("바다")],
    lat: 37.77,
    lon: 128.94,
  };
}

const themes = [theme("east-sea-sunrise", "바다"), theme("quiet-inland", "숲길")];
const spots = [spot("dongmyeong-port"), spot("sacheon-beach")];
const course: Course = {
  themeId: "east-sea-sunrise",
  title: L("DB 코스"),
  dayCount: 1,
  items: [
    { kind: "spot", day: 1, time: "10:00", refId: "dongmyeong-port", durationMin: 60 },
    { kind: "spot", day: 1, time: "14:00", refId: "sacheon-beach", durationMin: 60 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireDb.mockReturnValue({ __db: true });
  mocks.fetchThemes.mockResolvedValue(themes);
  mocks.fetchTheme.mockImplementation(async (_db, id: string) => themes.find((t) => t.id === id) ?? null);
  mocks.fetchDefaultCourseTemplate.mockImplementation(async (_db, id: string) =>
    id === "east-sea-sunrise" ? course : null,
  );
  mocks.fetchSpotProfiles.mockResolvedValue(spots);
  mocks.fetchSpotProfilesForTheme.mockImplementation(async (_db, id: string) =>
    id === "east-sea-sunrise" ? spots : [],
  );
  mocks.fetchSpotProfile.mockImplementation(async (_db, id: string) => spots.find((s) => s.id === id) ?? null);
});

describe("LiveRepository.matchThemes — 에이전트 배선", () => {
  it("자연어 입력에 대해 유효한 ThemeMatch 를 반환한다", async () => {
    const live = new LiveRepository();
    const themeIds = themes.map((t) => t.id);

    const match = await live.matchThemes("부모님이랑 안 붐비는 바다 보고 싶어");

    // 대표 테마는 실제 존재하는 테마여야 한다(에이전트가 헛것을 만들지 않음).
    expect(themeIds).toContain(match.primaryId);
    // 보조 테마는 최대 2개, 대표와 중복되지 않음.
    expect(match.altIds.length).toBeLessThanOrEqual(2);
    expect(match.altIds).not.toContain(match.primaryId);
    for (const id of match.altIds) expect(themeIds).toContain(id);
  });

  it("다른 의도에도 깨지지 않고 유효한 테마를 고른다", async () => {
    const live = new LiveRepository();
    const themeIds = themes.map((t) => t.id);

    const match = await live.matchThemes("유명한 산 트레킹 코스");
    expect(themeIds).toContain(match.primaryId);
  });
});

describe("LiveRepository.getCourse — 코스 정리 에이전트(planItinerary)", () => {
  it("코스 항목 수를 유지하고 실제 후보 안의 refId 로 조합된 Course 를 반환한다", async () => {
    const live = new LiveRepository();
    const themeId = "east-sea-sunrise";

    const validRefs = new Set(spots.map((s) => s.id));
    const out = await live.getCourse(themeId);

    expect(out).not.toBeNull();
    // 코스 생성 엔진은 대체지/권역 기준으로 refId 를 바꿀 수 있지만, 헛것을 만들면 안 된다.
    expect(out!.items.length).toBe(course.items.length);
    for (const item of out!.items) expect(validRefs.has(item.refId)).toBe(true);
  });

  it("코스 조건 옵션을 에이전트 도구 경로까지 유지한다", async () => {
    const live = new LiveRepository();
    const themeId = "east-sea-sunrise";

    const out = await live.getCourse(themeId, { days: 1, pace: "calm", transport: "walk" });

    expect(out).not.toBeNull();
    expect(out!.dayCount).toBe(1);
    expect(out!.items.every((item) => item.day === 1)).toBe(true);
  });

  it("없는 테마는 null 을 반환한다", async () => {
    const live = new LiveRepository();
    expect(await live.getCourse("__nope__")).toBeNull();
  });
});
