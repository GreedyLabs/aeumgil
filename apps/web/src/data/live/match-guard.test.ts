import { beforeEach, describe, expect, it, vi } from "vitest";
import { L } from "@/lib/i18n";
import type { Theme } from "@/domain/types";
import { LiveRepository } from "./repository";

const mocks = vi.hoisted(() => ({
  requireDb: vi.fn(),
  fetchThemes: vi.fn(),
  fetchSpotProfiles: vi.fn(),
  planCourse: vi.fn(),
}));
vi.mock("@/server/db", () => ({ requireDb: mocks.requireDb }));
vi.mock("@/server/db/course-catalog", () => ({
  fetchThemes: mocks.fetchThemes,
  fetchSpotProfiles: mocks.fetchSpotProfiles,
}));
vi.mock("@/server/agent/planner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/agent/planner")>()),
  planCourse: mocks.planCourse,
}));
const themes: Theme[] = [
  {
    id: "gangwon-gangneung-sea",
    title: L("강릉 바다와 항구"),
    subtitle: L("1일 코스"),
    tag: L("바다"),
    region: L("강릉"),
    hue: 210,
    duration: L("1일"),
    pace: L("균형"),
    spotCount: 3,
    mood: [],
    blurb: L("강릉 바다"),
  },
  {
    id: "gangwon-gangneung-forest",
    title: L("강릉 숲과 정원"),
    subtitle: L("1일 코스"),
    tag: L("숲"),
    region: L("강릉"),
    hue: 150,
    duration: L("1일"),
    pace: L("균형"),
    spotCount: 3,
    mood: [],
    blurb: L("강릉 숲"),
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireDb.mockReturnValue({});
  mocks.fetchThemes.mockResolvedValue(themes);
});

describe("matchThemes — 결정형 검색 비용과 계약", () => {
  it("같은 입력의 결과가 같고 테마 목록 외에 API·코스·LLM을 호출하지 않는다", async () => {
    const live = new LiveRepository();
    const first = await live.matchThemes("강릉 바다");
    expect(await live.matchThemes("  강릉  바다  ")).toEqual(first);
    expect(first.primaryId).toBe("gangwon-gangneung-sea");
    expect(first.explanation?.keywords).toContain("바다");
    expect(mocks.fetchSpotProfiles).not.toHaveBeenCalled();
    expect(mocks.planCourse).not.toHaveBeenCalled();
  });
  it("연속 검색에도 제외한 조건을 어기는 테마로 폴백하지 않는다", async () => {
    const live = new LiveRepository();
    const matches = await Promise.all(
      Array.from({ length: 25 }, () => live.matchThemes("강릉 바다 말고 숲")),
    );
    expect(matches.every((m) => m.primaryId === "gangwon-gangneung-forest")).toBe(true);
    expect(mocks.planCourse).not.toHaveBeenCalled();
  });
  it("빈 입력은 DB도 조회하지 않고 미일치로 반환한다", async () => {
    const result = await new LiveRepository().matchThemes("  \n ");
    expect(result.primaryId).toBe("");
    expect(result.explanation?.status).toBe("unmatched");
    expect(mocks.fetchThemes).not.toHaveBeenCalled();
  });
  it("무관 문장은 첫 번째 테마를 추천하지 않는다", async () => {
    const result = await new LiveRepository().matchThemes("서버 계산 오류를 해결해 줘");
    expect(result.primaryId).toBe("");
    expect(result.altIds).toEqual([]);
    expect(result.explanation?.status).toBe("unmatched");
  });
});
