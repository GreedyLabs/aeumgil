import { describe, expect, it } from "vitest";
import { internationalIntentQuery } from "./international-intent";
import { rankCatalogThemes } from "./matching";
import { inferCourseOptions } from "./course-options";

const themes = [
  { id: "gangwon-gangneung-sea", title: "강릉 바다와 항구", region: "강릉" },
  { id: "gangwon-gangneung-forest", title: "강릉 숲과 정원 산책", region: "강릉" },
  { id: "gangwon-sokcho-sea", title: "속초 바다와 항구", region: "속초" },
];
describe("외국어 여행 의도 사전", () => {
  it.each([
    "Gangneung beach",
    "江陵海边",
    "江陵海邊",
    "江陵の海辺",
    "Gangneung Strand",
    "Gangneung plage",
  ])("지역과 여행 목적을 정본 테마로 찾는다: %s", (query) => {
    expect(rankCatalogThemes(query, themes).primaryId).toBe("gangwon-gangneung-sea");
  });
  it.each([
    "Gangneung forest without beach",
    "江陵不要海滩森林",
    "江陵不要海灘森林",
    "江陵の海辺には行きたくない 森",
    "Gangneung Wald ohne Strand",
    "Gangneung forêt sans plage",
  ])("제외 조건을 추천과 대안 모두에 반영한다: %s", (query) => {
    const result = rankCatalogThemes(query, themes);
    expect(result.primaryId).toBe("gangwon-gangneung-forest");
    expect(result.altIds.every((id) => !id.endsWith("sea"))).toBe(true);
  });
  it.each([
    "3 days family public transport",
    "3天 家庭 公共交通",
    "3天 家庭 公共交通",
    "3日 家族 公共交通",
    "3 Tage Familie Bus",
    "3 jours famille transports en commun",
  ])("기간·동행·교통도 사전 표현만 읽는다: %s", (query) => {
    expect(inferCourseOptions(query)).toMatchObject({
      days: 3,
      companion: "family",
      transport: "transit",
    });
  });
  it("외국어 달력 날짜의 일을 여행 기간으로 오인하지 않는다", () => {
    expect(inferCourseOptions("2026年9月5日 江陵海岸").days).toBeUndefined();
  });
  it("라틴 단어 내부나 모르는 문장을 여행 키워드로 바꾸지 않는다", () => {
    for (const value of ["commerce", "research", "carpet", "alternative", "unbekannte Anforderung"])
      expect(rankCatalogThemes(value, themes).primaryId).toBe("");
    expect(internationalIntentQuery("부산 계산 산책")).toBe("부산 계산 산책");
  });
});
