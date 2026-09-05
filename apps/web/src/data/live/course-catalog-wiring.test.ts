// LiveRepository 코스 카탈로그 통합 배선 테스트.
// 실제 DB/공공 API 없이 getDb + course-catalog 어댑터를 대역으로 주입해
// DB 템플릿/후보 기반 코스 생성 계약을 검증한다.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { L } from "@/lib/i18n";
import type { Course, Spot, Theme } from "@/domain/types";

const mocks = vi.hoisted(() => ({
  requireDb: vi.fn(),
  fetchTheme: vi.fn(),
  fetchThemes: vi.fn(),
  fetchDefaultCourseTemplate: vi.fn(),
  fetchSpotProfiles: vi.fn(),
  fetchSpotProfilesForTheme: vi.fn(),
  fetchSpotProfile: vi.fn(),
  planItinerary: vi.fn(),
  planCourse: vi.fn(),
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

vi.mock("@/server/agent/planner", () => ({
  planCourse: mocks.planCourse,
  planItinerary: mocks.planItinerary,
}));

import { LiveRepository } from "./repository";

function dbSpot(id: string, region: string, suitability = 80): Spot {
  return {
    id,
    name: L(id),
    type: L("해변"),
    region: L(region),
    congestion: "calm",
    suitability,
    weather: { tempC: 15, desc: L("맑음"), icon: "sun" },
    air: L("좋음"),
    rating: 4.5,
    reviewCount: 10,
    tags: [L("바다"), L("한적")],
    lat: region === "강릉" ? 37.77 : 38.2,
    lon: region === "강릉" ? 128.94 : 128.59,
  };
}

const dbTemplate: Course = {
  themeId: "east-sea-sunrise",
  title: L("DB 템플릿 코스", "DB template course"),
  dayCount: 1,
  items: [
    { kind: "spot", day: 1, time: "10:00", refId: "db-template-spot", durationMin: 60 },
    { kind: "eat", day: 1, time: "12:30", refId: "e3" },
  ],
};

const dbTheme: Theme = {
  id: "east-sea-sunrise",
  title: L("동해 일출", "East sea sunrise"),
  subtitle: L("1일 코스", "1 day course"),
  tag: L("해변", "Beach"),
  region: L("강릉", "Gangneung"),
  hue: 210,
  duration: L("1일", "1 day"),
  pace: L("균형", "Balanced"),
  spotCount: 2,
  mood: [L("바다")],
  blurb: L("DB 테마"),
};

describe("LiveRepository.getCourse — DB 코스 카탈로그 배선", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDb.mockReturnValue({ __db: true });
    mocks.fetchTheme.mockResolvedValue(dbTheme);
    mocks.fetchThemes.mockResolvedValue([dbTheme]);
    mocks.fetchDefaultCourseTemplate.mockResolvedValue(null);
    mocks.fetchSpotProfiles.mockResolvedValue([dbSpot("db-template-spot", "강릉", 90)]);
    mocks.fetchSpotProfilesForTheme.mockResolvedValue([]);
    mocks.fetchSpotProfile.mockResolvedValue(null);
    mocks.planItinerary.mockImplementation(async (_req, deps) => ({
      course: deps.baseCourse,
      rationale: L("테스트"),
      trace: [],
      source: "agent",
    }));
  });

  it("DB course_template 이 있으면 시드 템플릿보다 우선 사용한다", async () => {
    mocks.fetchDefaultCourseTemplate.mockResolvedValue(dbTemplate);
    mocks.fetchSpotProfilesForTheme.mockResolvedValue([dbSpot("db-template-spot", "강릉", 90)]);

    const course = await new LiveRepository().getCourse("east-sea-sunrise");

    expect(course).not.toBeNull();
    expect(course!.title.ko).toBe("DB 템플릿 코스");
    expect(course!.items[0]).toMatchObject({ kind: "spot", refId: "db-template-spot" });
    expect(mocks.fetchDefaultCourseTemplate).toHaveBeenCalledWith({ __db: true }, "east-sea-sunrise");
  });

  it("DB spot_profile 후보가 있으면 composer 후보 풀에서 시드 스팟보다 우선 사용한다", async () => {
    mocks.fetchSpotProfilesForTheme.mockResolvedValue([dbSpot("db-only-beach", "강릉", 95)]);

    const course = await new LiveRepository().getCourse("east-sea-sunrise");

    expect(course).not.toBeNull();
    expect(course!.items.some((item) => item.kind === "spot" && item.refId === "db-only-beach")).toBe(true);
  });

  it("DB 후보가 빈 배열이면 존재하지 않는 장소의 코스를 만들지 않는다", async () => {
    mocks.fetchDefaultCourseTemplate.mockResolvedValue(dbTemplate);
    mocks.fetchSpotProfilesForTheme.mockResolvedValue([]);

    const course = await new LiveRepository().getCourse("east-sea-sunrise");

    expect(course).toBeNull();
  });

  it("Repository options 를 composer 로 전달해 startRegion 조건을 반영한다", async () => {
    mocks.fetchDefaultCourseTemplate.mockResolvedValue({
      ...dbTemplate,
      items: [{ kind: "spot", day: 1, time: "10:00", refId: "unknown-seed-slot", durationMin: 60 }],
    } satisfies Course);
    mocks.fetchSpotProfilesForTheme.mockResolvedValue([
      dbSpot("db-sokcho-beach", "속초", 86),
      dbSpot("db-gangneung-beach", "강릉", 80),
    ]);

    const course = await new LiveRepository().getCourse("east-sea-sunrise", {
      days: 1,
      pace: "calm",
      startRegion: "강릉",
    });

    expect(course).not.toBeNull();
    expect(course!.items.find((item) => item.kind === "spot")?.refId).toBe("db-gangneung-beach");
  });
});
