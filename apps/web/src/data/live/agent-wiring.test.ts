// B단계 배선 테스트 — LiveRepository.matchThemes 가 에이전트 경로로 동작하는지.
//
// heuristicProvider(키 없는 mock) + 도메인 도구만 타므로 네트워크가 필요 없다.
// (list_themes/get_course/estimate_congestion 은 메모리·순수함수)
// 검증 관점: Repository 인터페이스 계약(ThemeMatch)을 깨지 않고 유효한 결과를 내는가.

import { describe, expect, it } from "vitest";
import { MockRepository } from "../mock/repository";
import { LiveRepository } from "./repository";

describe("LiveRepository.matchThemes — 에이전트 배선", () => {
  it("자연어 입력에 대해 유효한 ThemeMatch 를 반환한다", async () => {
    const live = new LiveRepository();
    const mock = new MockRepository();
    const themeIds = (await mock.listThemes()).map((t) => t.id);

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
    const mock = new MockRepository();
    const themeIds = (await mock.listThemes()).map((t) => t.id);

    const match = await live.matchThemes("유명한 산 트레킹 코스");
    expect(themeIds).toContain(match.primaryId);
  });
});

describe("LiveRepository.getCourse — 코스 정리 에이전트(planItinerary)", () => {
  /** 코스가 있는 첫 테마 id 를 찾는다. */
  async function someThemeWithCourse(mock: MockRepository): Promise<string> {
    for (const t of await mock.listThemes()) {
      if (await mock.getCourse(t.id)) return t.id;
    }
    throw new Error("코스가 있는 테마가 없음(픽스처 문제)");
  }

  it("코스 항목을 보존하면서(추가/삭제 없이) 정리된 Course 를 반환한다", async () => {
    const live = new LiveRepository();
    const mock = new MockRepository();
    const themeId = await someThemeWithCourse(mock);

    const base = await mock.getCourse(themeId);
    const out = await live.getCourse(themeId);

    expect(out).not.toBeNull();
    // 에이전트는 시각만 재배치할 뿐, 항목 집합(refId)은 그대로여야 한다(헛것·누락 금지).
    expect(out!.items.length).toBe(base!.items.length);
    const sortIds = (c: { items: { refId: string }[] }) => c.items.map((i) => i.refId).sort();
    expect(sortIds(out!)).toEqual(sortIds(base!));
  });

  it("없는 테마는 null 을 반환한다", async () => {
    const live = new LiveRepository();
    expect(await live.getCourse("__nope__")).toBeNull();
  });
});
