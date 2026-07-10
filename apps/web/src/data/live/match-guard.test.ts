// §3.1 어뷰즈 방어 배선 테스트 — matchThemes 의 캐시·레이트리밋이
// 에이전트(LLM) 호출 횟수를 상한 이내로 묶고, 초과분도 유효한 결과를 내는지.
//
// planCourse 를 목으로 바꿔 "LLM 경로 진입 횟수"를 직접 센다.
// (vitest 는 테스트 파일별로 모듈 그래프가 격리되므로 모듈 싱글턴인
//  agentMatchLimiter/apiCache 는 이 파일 안에서 초기 상태로 시작한다.)

import { beforeEach, describe, expect, it, vi } from "vitest";
import { L } from "@/lib/i18n";
import type { Spot, Theme } from "@/domain/types";
import { LiveRepository } from "./repository";

const mocks = vi.hoisted(() => ({
  requireDb: vi.fn(),
  fetchTheme: vi.fn(),
  fetchThemes: vi.fn(),
  fetchDefaultCourseTemplate: vi.fn(),
  fetchSpotProfiles: vi.fn(),
  fetchSpotProfilesForTheme: vi.fn(),
  fetchSpotProfile: vi.fn(),
  planCourse: vi.fn(),
}));

vi.mock("@/server/db", () => ({ requireDb: mocks.requireDb }));
vi.mock("@/server/db/course-catalog", () => ({
  fetchTheme: mocks.fetchTheme,
  fetchThemes: mocks.fetchThemes,
  fetchDefaultCourseTemplate: mocks.fetchDefaultCourseTemplate,
  fetchSpotProfiles: mocks.fetchSpotProfiles,
  fetchSpotProfilesForTheme: mocks.fetchSpotProfilesForTheme,
  fetchSpotProfile: mocks.fetchSpotProfile,
}));
vi.mock("@/server/agent/planner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/agent/planner")>();
  return { ...actual, planCourse: mocks.planCourse };
});

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

function spot(id: string): Spot {
  return {
    id,
    name: L(id),
    type: L("해변"),
    region: L("강릉"),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireDb.mockReturnValue({ __db: true });
  mocks.fetchThemes.mockResolvedValue(themes);
  mocks.fetchTheme.mockImplementation(async (_db, id: string) => themes.find((t) => t.id === id) ?? null);
  mocks.fetchSpotProfiles.mockResolvedValue([spot("dongmyeong-port")]);
  mocks.fetchSpotProfilesForTheme.mockResolvedValue([]);
  mocks.fetchSpotProfile.mockResolvedValue(null);
  mocks.planCourse.mockResolvedValue({
    primaryThemeId: "east-sea-sunrise",
    altThemeIds: ["quiet-inland"],
    rationale: L("테스트"),
    source: "agent",
    trace: [],
  });
});

describe("matchThemes — §3.1 비용 가드", () => {
  it("동일 쿼리는 캐시되어 에이전트를 한 번만 태운다", async () => {
    const live = new LiveRepository();
    const q = "guard-test 동일 쿼리 캐시 확인";

    const first = await live.matchThemes(q);
    const second = await live.matchThemes(`  ${q}  `); // 정규화 후 동일 키

    expect(mocks.planCourse).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("연속 요청이 몰려도 에이전트 호출은 버킷 용량 이내, 응답은 전부 유효하다", async () => {
    const live = new LiveRepository();
    const themeIds = themes.map((t) => t.id);
    const total = 25;

    const results = await Promise.all(
      Array.from({ length: total }, (_, i) => live.matchThemes(`guard-test 부하 쿼리 ${i}`)),
    );

    // 버킷 용량(10) 이내 — 초과분은 LLM 미진입(결정형 폴백).
    expect(mocks.planCourse.mock.calls.length).toBeLessThanOrEqual(10);
    // 폴백 포함 전 응답이 계약(유효 테마)을 지킨다.
    for (const match of results) {
      expect(themeIds).toContain(match.primaryId);
      expect(match.altIds).not.toContain(match.primaryId);
    }
  });

  it("빈 입력은 에이전트에 진입하지 않는다", async () => {
    const live = new LiveRepository();
    const match = await live.matchThemes("   \n  ");

    expect(mocks.planCourse).not.toHaveBeenCalled();
    expect(typeof match.primaryId).toBe("string");
  });
});
