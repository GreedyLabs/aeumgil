import { describe, it, expect } from "vitest";
import {
  normalizeTourismRow,
  buildRegionalCourses,
  distanceKm,
  type TourismRow,
} from "./catalog-import";
import { normalizePlaceQuery, escapeLike, placeSearchParams } from "./place-search";
import { regionalThemeMatch } from "./regional-matching";
const raw: TourismRow = {
  contentid: "123",
  contenttypeid: "12",
  lDongRegnCd: "51",
  lDongSignguCd: "150",
  title: "안목해변",
  mapx: "128.949",
  mapy: "37.772",
  lclsSystm3: "NA020900",
  firstimage: "http://tong.visitkorea.or.kr/photo.jpg",
};
describe("대량 관광 카탈로그", () => {
  it("공식 분류·시군·사진·좌표를 정규화한다", () => {
    expect(normalizeTourismRow(raw)).toMatchObject({
      category: "sea",
      region: { ko: "강릉" },
      kind: "spot",
      imageUrl: "https://tong.visitkorea.or.kr/photo.jpg",
    });
  });
  it("잘못된 좌표·타 시도·행사·여행코스는 장소로 적재하지 않는다", () => {
    for (const patch of [
      { mapx: "0" },
      { mapy: "NaN" },
      { lDongRegnCd: "11" },
      { contenttypeid: "15" },
      { contenttypeid: "25" },
    ] as TourismRow[])
      expect(normalizeTourismRow({ ...raw, ...patch })).toBeNull();
  });
  it("캠핑은 숙소로, 일반 소매점은 제외하고 시장은 유지한다", () => {
    expect(normalizeTourismRow({ ...raw, contenttypeid: "28", lclsSystm3: "AC050100" })?.kind).toBe(
      "stay",
    );
    expect(
      normalizeTourismRow({
        ...raw,
        title: "일반 옷가게",
        contenttypeid: "38",
        lclsSystm3: "SH020100",
      }),
    ).toBeNull();
    expect(
      normalizeTourismRow({
        ...raw,
        title: "중앙시장",
        contenttypeid: "38",
        lclsSystm3: "SH060100",
      })?.category,
    ).toBe("market");
  });
  it("중복 근접 장소·장거리 경유지·등산 정상은 당일 코스에서 제외한다", () => {
    const places = [0, 0.00001, 0.01, 0.02, 0.5].map((delta, i) => ({
      ...normalizeTourismRow({ ...raw, contentid: String(100 + i), mapy: String(37.772 + delta) })!,
      id: `p${i}`,
    }));
    for (const course of buildRegionalCourses(places)) {
      expect(course.stops).toHaveLength(3);
      for (const a of course.stops)
        for (const b of course.stops.filter((p) => p !== a)) {
          expect(distanceKm(a, b)).toBeGreaterThanOrEqual(0.4);
          expect(distanceKm(a, b)).toBeLessThanOrEqual(20);
        }
    }
    expect(normalizeTourismRow({ ...raw, lclsSystm3: "NA010100" })?.routeEligible).toBe(false);
  });
});
describe("검색과 지역 추천", () => {
  it("쿼리 범위·공백·알 수 없는 필터를 정리한다", () => {
    expect(
      normalizePlaceQuery({ q: "  속초   해변 ", page: -1, region: "서울", category: "invalid" }),
    ).toEqual({ q: "속초 해변", page: 1, region: "", category: "", accessibility: "" });
    expect(escapeLike("100%_\\")).toBe("100\\%\\_\\\\");
    expect(placeSearchParams({ region: "양구", page: 2 }).get("region")).toBe("양구");
  });
  it("지역 명시와 취향이 일반 테마보다 우선한다", () => {
    const themes = [
      { id: "quiet-inland", title: "조용한 숲" },
      { id: "gangwon-yanggu-culture", title: "양구 전시 예술" },
      { id: "gangwon-yanggu-highlights", title: "양구 대표 명소" },
    ];
    expect(regionalThemeMatch("양구 미술관에서 조용한 여행", themes)).toBe(
      "gangwon-yanggu-culture",
    );
    expect(regionalThemeMatch("양구 여행", themes)).toBe("gangwon-yanggu-highlights");
    expect(regionalThemeMatch("바다 여행", themes)).toBeUndefined();
  });
});
