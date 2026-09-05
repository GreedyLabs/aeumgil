import { beforeEach, describe, expect, it, vi } from "vitest";

const searchSpots = vi.hoisted(() => vi.fn());
vi.mock("@/data", () => ({ getRepository: () => ({ searchSpots }) }));
import { searchPlacesAction } from "./search-places";

describe("공개 여행지 추가 조회", () => {
  beforeEach(() => {
    searchSpots.mockReset();
  });

  it("정규화한 검색 조건과 다음 페이지를 공개 Repository 검색에만 전달한다", async () => {
    const result = { items: [], total: 50, page: 2, pageSize: 24, query: {} };
    searchSpots.mockResolvedValue(result);
    await expect(
      searchPlacesAction({ q: " 속초   해변 ", region: "속초", category: "sea", page: 2 }),
    ).resolves.toEqual({ ok: true, result });
    expect(searchSpots).toHaveBeenCalledExactlyOnceWith({
      q: "속초 해변",
      region: "속초",
      category: "sea",
      accessibility: "",
      page: 2,
    });
  });

  it("잘못된 타입이나 페이지 요청으로 DB 검색을 실행하지 않는다", async () => {
    for (const input of [
      null,
      { page: 0 },
      { page: 1.5 },
      { page: 501 },
      { page: 2, q: [] },
      { page: 2, q: "가".repeat(101) },
    ]) {
      expect(await searchPlacesAction(input)).toMatchObject({ ok: false });
    }
    expect(searchSpots).not.toHaveBeenCalled();
  });

  it("조회 실패를 성공 목록으로 꾸미거나 내부 오류를 노출하지 않는다", async () => {
    searchSpots.mockRejectedValue(new Error("private database connection detail"));
    const response = await searchPlacesAction({ page: 2 });
    expect(response).toMatchObject({ ok: false, error: expect.stringContaining("다시 시도") });
    expect(JSON.stringify(response)).not.toContain("private");
  });
});
