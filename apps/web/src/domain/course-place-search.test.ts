import { describe, expect, it } from "vitest";
import { L } from "@/lib/i18n";
import type { Eat, Stay } from "./types";
import { filterCourseCommerce, parseCoursePlaceSearch } from "./course-place-search";

const eat = (id: string, name: string, region = "강릉"): Eat => ({
  id,
  name: L(name),
  region: L(region),
  type: L("음식점"),
  price: "",
  rating: 0,
  address: `${region} 중앙로`,
  lat: 37.7,
  lon: 128.8,
});

describe("개인 코스의 여행지·음식점·숙소 검색", () => {
  it("기본 여행지와 허용된 종류·지역·쿼리를 정규화한다", () => {
    expect(parseCoursePlaceSearch({ q: "  강릉   커피 " })).toEqual({
      kind: "spot",
      query: { q: "강릉 커피", region: "", category: "", accessibility: "", page: 1 },
    });
    expect(parseCoursePlaceSearch({ region: "춘천", page: 2 }, "stay").kind).toBe("stay");
  });
  it("종류·지역·타입·페이지 상한과 허용되지 않은 인자를 서버에서 거른다", () => {
    for (const query of [
      null,
      [],
      { q: [] },
      { q: "가".repeat(101) },
      { region: "서울" },
      { page: 501 },
      { page: 0 },
      { page: 1.5 },
      { page: "1" },
      { page: NaN },
      { arbitrary: "value" },
    ])
      expect(() => parseCoursePlaceSearch(query)).toThrow("검색 종류와 조건");
    expect(() => parseCoursePlaceSearch({}, "festival")).toThrow();
    expect(() => parseCoursePlaceSearch({ accessibility: "info" }, "eat")).toThrow(
      "무장애 조건은 여행지",
    );
  });
  it("음식점의 여러 단어와 지역을 함께 적용하고 입력 목록은 변경하지 않는다", () => {
    const places = [eat("e1", "바다 커피"), eat("e2", "중앙 커피"), eat("e3", "바다 커피", "속초")];
    const original = [...places];
    const result = filterCourseCommerce(places, { q: "바다 커피", region: "강릉" }, "eat");
    expect(result.total).toBe(1);
    expect(result.items.map((item) => [item.id, item.kind])).toEqual([["e1", "eat"]]);
    expect(places).toEqual(original);
    expect(result.items[0]?.hasAccessibilityInfo).toBeUndefined();
  });
  it("24개 단위로 중복 없이 페이지를 나누고 빈 결과를 유지한다", () => {
    const places = Array.from({ length: 51 }, (_, i) =>
      eat(`e${i}`, `식당 ${String(i).padStart(2, "0")}`),
    );
    const a = filterCourseCommerce(places, {}, "eat");
    const b = filterCourseCommerce(places, { page: 2 }, "eat");
    const c = filterCourseCommerce(places, { page: 3 }, "eat");
    expect(a.items).toHaveLength(24);
    expect(b.items).toHaveLength(24);
    expect(c.items).toHaveLength(3);
    expect(new Set([...a.items, ...b.items, ...c.items].map((p) => p.id)).size).toBe(51);
    expect(filterCourseCommerce(places, { q: ".*%_" }, "eat").items).toEqual([]);
    expect(filterCourseCommerce(places, { page: 500 }, "eat").items).toEqual([]);
  });
  it("숙소도 동일 계약으로 반환하며 잘못된 좌표를 지도에 전달하지 않는다", () => {
    const stay: Stay = {
      ...eat("s1", "숲 호텔"),
      type: L("호텔"),
      price: L(""),
      lat: NaN,
      lon: Infinity,
    };
    const result = filterCourseCommerce([stay], { q: "호텔 강릉" }, "stay");
    expect(result.items[0]).toMatchObject({ id: "s1", kind: "stay", name: L("숲 호텔") });
    expect(result.items[0]?.lat).toBeUndefined();
    expect(result.items[0]?.lon).toBeUndefined();
  });
});
