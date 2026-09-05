import { describe, expect, it } from "vitest";
import { rankCatalogThemes, type MatchableTheme } from "./matching";
import { GANGWON_REGIONS } from "./place-search";

const themes: MatchableTheme[] = [
  { id: "quiet-inland", title: "조용한 내륙 힐링", tag: "힐링" },
  { id: "east-sea-sunrise", title: "동해 일출과 바다", tag: "해변" },
  ...["gangneung", "yanggu", "sokcho"].flatMap((region) => {
    const name = GANGWON_REGIONS.find((r) => r.key === region)!.ko;
    return [
      { id: `gangwon-${region}-sea`, title: `${name} 바다와 항구`, region: name },
      { id: `gangwon-${region}-forest`, title: `${name} 숲과 정원 산책`, region: name },
      { id: `gangwon-${region}-culture`, title: `${name} 전시와 예술`, region: name },
      { id: `gangwon-${region}-local`, title: `${name} 시장과 골목 나들이`, region: name },
      { id: `gangwon-${region}-family`, title: `${name} 함께 즐기는 체험`, region: name },
      { id: `gangwon-${region}-highlights`, title: `${name} 대표 명소 하루 여행`, region: name },
    ];
  }),
];
const match = (q: string) => rankCatalogThemes(q, themes);

describe("카탈로그 전체 키워드 매칭", () => {
  it("같은 지역·목적이면 명시한 기간과 맞는 코스를 우선한다", () => {
    const candidates = [
      { id: "day-sea", title: "강릉 바다 여행", region: "강릉", days: 1 },
      { id: "long-sea", title: "강릉 바다 여행", region: "강릉", days: 5 },
      { id: "long-other", title: "양구 바다 여행", region: "양구", days: 5 },
    ];
    expect(rankCatalogThemes("강릉 바다 4박5일", candidates).primaryId).toBe("long-sea");
    expect(rankCatalogThemes("강릉 바다 당일", candidates).primaryId).toBe("day-sea");
    expect(rankCatalogThemes("5일", candidates).primaryId).toBe("");
  });
  it.each([
    ["강릉에서 바다를 보고 싶어요", "gangwon-gangneung-sea"],
    ["양구의 미술관에서 전시 구경", "gangwon-yanggu-culture"],
    ["속초 수산시장 먹거리", "gangwon-sokcho-local"],
    ["강릉바다여행", "gangwon-gangneung-sea"],
    ["양구에서 자작나무숲을 걷기", "gangwon-yanggu-forest"],
    ["GANGNEUNG BEACH", "gangwon-gangneung-sea"],
  ])("조사·복합어·동의어와 지역을 반영한다: %s", (query, id) => {
    expect(match(query).primaryId).toBe(id);
  });
  it("18개 지역 모두 같은 분류 사전을 공유한다", () => {
    for (const region of GANGWON_REGIONS) {
      const id = `gangwon-${region.key}-culture`;
      const result = rankCatalogThemes(`${region.ko}에서 미술관`, [
        ...themes,
        { id, title: `${region.ko} 전시와 예술`, region: region.ko },
      ]);
      expect(result.primaryId).toBe(id);
    }
  });
  it("단일 단어 일부 때문에 다른 의도로 오인하지 않는다", () => {
    for (const q of [
      "계산이 틀렸어",
      "부산행 기차표",
      "뒷광고 리뷰 작성",
      "this research result",
    ]) {
      expect(match(q).primaryId).toBe("");
    }
    expect(match("강릉 산책로").primaryId).toBe("gangwon-gangneung-forest");
  });
  it.each([
    "강릉 바다 말고 숲",
    "강릉 바다는 싫어 숲길",
    "강릉 바다빼고 숲",
    "Gangneung forest without beach",
  ])("제외한 성격은 대안에서도 제거한다: %s", (q) => {
    const result = match(q);
    expect(result.primaryId).toBe("gangwon-gangneung-forest");
    expect(result.altIds.some((id) => id.endsWith("-sea"))).toBe(false);
    expect(result.explanation?.excludedKeywords.length).toBeGreaterThan(0);
  });
  it("제외한 지역을 후보에 넣지 않는다", () => {
    const result = match("강릉 말고 속초 바다");
    expect(result.primaryId).toBe("gangwon-sokcho-sea");
    expect(result.explanation?.regions).toEqual(["속초"]);
  });
  it("빈 입력·무관 문장·부정 조건만 있으면 성공으로 꾸미지 않는다", () => {
    for (const q of ["", "   ", "서버 문제를 해결해줘", "바다 말고", "여행 추천해줘"]) {
      const result = match(q);
      expect(result.primaryId).toBe("");
      expect(result.altIds).toEqual([]);
      expect(result.explanation?.status).toBe("unmatched");
    }
  });
  it("지역만 있으면 그 지역 대표 명소를 안내하고 취향을 알아냈다고 말하지 않는다", () => {
    const result = match("양구 여행");
    expect(result.primaryId).toBe("gangwon-yanggu-highlights");
    expect(result.explanation?.keywords).toEqual([]);
    expect(result.explanation?.regions).toEqual(["양구"]);
  });
  it("여러 활동을 다른 지역보다 먼저 같은 지역의 대안으로 제시한다", () => {
    const result = match("강릉 바다와 미술관");
    expect(result.primaryId).toMatch(/^gangwon-gangneung-/);
    expect(result.altIds).toContain(
      result.primaryId.endsWith("-sea") ? "gangwon-gangneung-culture" : "gangwon-gangneung-sea",
    );
    expect(result.explanation?.status).toBe("partial");
    expect(result.explanation?.notice?.ko).toContain("모두 포함되지");
  });
  it("한 지역에 요청 성격이 없으면 지역을 몰래 바꾸지 않는다", () => {
    const result = rankCatalogThemes(
      "양구 바다",
      themes.filter((t) => t.id !== "gangwon-yanggu-sea"),
    );
    expect(result.primaryId).toMatch(/^gangwon-yanggu-/);
    expect(result.explanation?.status).toBe("partial");
    expect(result.explanation?.notice?.ko).toContain("바다·해변");
  });
  it("명시적 실내 요구가 가족 선호보다 우선하고 실제 운영을 보장하지 않는다", () => {
    const result = match("강릉에서 아이와 비 안 맞고 하루 실내 여행");
    expect(result.primaryId).toBe("gangwon-gangneung-culture");
    expect(result.explanation?.notice?.ko).toContain("실내 운영 여부");
  });
  it("한산함·무장애 요구를 검증한 사실처럼 표시하지 않는다", () => {
    const result = match("양구에서 조용한 숲 휠체어 여행");
    expect(result.primaryId).toBe("gangwon-yanggu-forest");
    expect(result.explanation?.status).toBe("partial");
    expect(result.explanation?.notice?.ko).toContain("실제 혼잡도");
    expect(result.explanation?.notice?.ko).toContain("무장애 안내");
  });
  it("신규 테마 제목·태그·개별 추가어도 기존 6개 ID 없이 매칭한다", () => {
    const candidates = [
      {
        id: "custom-cycle",
        title: "춘천 자전거",
        region: "춘천",
        keywords: ["라이딩", "자전거길"],
      },
      { id: "custom-planet", title: "영월 별자리 관측", tag: "천문대", keywords: ["별구경"] },
    ];
    expect(rankCatalogThemes("춘천에서 라이딩", candidates).primaryId).toBe("custom-cycle");
    expect(rankCatalogThemes("천문대에서 별구경", candidates).primaryId).toBe("custom-planet");
  });
  it("실내를 제외한 문장에서 비 언급만으로 실내를 선호한다고 바꾸지 않는다", () => {
    const result = match("비가 와도 괜찮아 실내 말고 숲길 산책");
    expect(result.primaryId).toMatch(/forest|quiet-inland/);
    expect(result.explanation?.excludedKeywords).toContain("실내");
    expect(result.explanation?.notice?.ko ?? "").not.toContain("실내 운영 여부");
  });
  it("반려동물 동반을 확인 없이 보장하지 않고 제외한 지역도 유지한다", () => {
    const result = match("속초 말고 강릉에서 아이랑 바다 반려견 동반 가능해야 해");
    expect(result.primaryId).toBe("gangwon-gangneung-sea");
    expect(result.explanation?.regions).toEqual(["강릉"]);
    expect(result.explanation?.status).toBe("partial");
    expect(result.explanation?.notice?.ko).toContain(
      "반려동물 동반 가능 여부는 이 추천에서 확인하지 않았어요",
    );
  });
  it("오래 걷는 건 싫다는 조건을 걷기 선호로 바꾸지 않는다", () => {
    const result = rankCatalogThemes("부모님과 강릉 오래 걷는 건 싫고 바다가 보이는 카페", [
      ...themes,
      { id: "gangneung-cafe", title: "강릉 카페와 바다", region: "강릉", tag: "카페" },
    ]);
    expect(result.primaryId).toBe("gangneung-cafe");
    expect(result.explanation?.excludedKeywords).toContain("걷");
    expect(result.altIds.some((id) => id.endsWith("-forest"))).toBe(false);
  });
  it("같은 단어 반복으로 다른 요청 조건을 덮어쓰지 않는다", () => {
    expect(match("양구 미술관 조용 조용 조용 조용").primaryId).toBe("gangwon-yanggu-culture");
  });
});
