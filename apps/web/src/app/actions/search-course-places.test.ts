import { beforeEach, describe, expect, it, vi } from "vitest";
import { L } from "@/lib/i18n";
import { searchCoursePlacesAction } from "./personal-course";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  searchSpots: vi.fn(),
  listEats: vi.fn(),
  listStays: vi.fn(),
}));
vi.mock("@/data", () => ({ getRepository: () => mocks }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const place = {
  id: "restaurant-1",
  name: L("강릉 커피"),
  type: L("카페"),
  region: L("강릉"),
  price: "",
  rating: 0,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "user" });
});

describe("코스 장소 검색 Server Action", () => {
  it("미로그인 사용자는 카탈로그를 읽지 않는다", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(searchCoursePlacesAction({}, "eat")).rejects.toThrow("로그인");
    expect(mocks.listEats).not.toHaveBeenCalled();
  });
  it("허용하지 않은 검색 인자를 DB에 보내지 않는다", async () => {
    await expect(searchCoursePlacesAction({ page: 501 }, "eat")).rejects.toThrow(
      "검색 종류와 조건",
    );
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.searchSpots).not.toHaveBeenCalled();
  });
  it("여행지는 기존 DB 검색 포트를 사용하고 종류를 붙인다", async () => {
    mocks.searchSpots.mockResolvedValue({
      items: [place],
      total: 1,
      page: 1,
      pageSize: 24,
      query: { q: "박물관", region: "", category: "", accessibility: "", page: 1 },
    });
    const result = await searchCoursePlacesAction({ q: "박물관" });
    expect(result.kind).toBe("spot");
    expect(result.items[0]?.kind).toBe("spot");
    expect(mocks.searchSpots).toHaveBeenCalledOnce();
    expect(mocks.listEats).not.toHaveBeenCalled();
  });
  it("음식점 목록은 동시 검색을 합쳐 조회하고 쿼리별 결과는 따로 계산한다", async () => {
    mocks.listEats.mockResolvedValue([place]);
    const [a, b] = await Promise.all([
      searchCoursePlacesAction({ q: "커피" }, "eat"),
      searchCoursePlacesAction({ q: "호텔" }, "eat"),
    ]);
    expect(a.items).toHaveLength(1);
    expect(a.items[0]?.kind).toBe("eat");
    expect(b.items).toEqual([]);
    expect(mocks.listEats).toHaveBeenCalledOnce();
    expect(mocks.searchSpots).not.toHaveBeenCalled();
  });
  it("숙소 목록은 음식점 캐시와 분리한다", async () => {
    mocks.listStays.mockResolvedValue([
      { ...place, id: "stay-1", name: L("강릉 호텔"), type: L("호텔"), price: L("") },
    ]);
    const result = await searchCoursePlacesAction({ q: "호텔" }, "stay");
    expect(result.items[0]).toMatchObject({ id: "stay-1", kind: "stay" });
    expect(mocks.listStays).toHaveBeenCalledOnce();
    expect(mocks.listEats).not.toHaveBeenCalled();
  });
});
