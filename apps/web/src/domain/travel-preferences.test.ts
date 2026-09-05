import { describe, expect, it } from "vitest";
import {
  applyTravelPreference,
  normalizeTravelPreference,
  travelPreferenceSchema,
} from "./travel-preferences";
import { rankCatalogThemes, type MatchableTheme } from "./matching";

const preference = { interestThemeIds: ["topic:sea"], paceId: "calm", companionId: "family" };
const themes: MatchableTheme[] = [
  { id: "gangwon-gangneung-highlights", title: "강릉 대표 명소", region: "강릉" },
  { id: "gangwon-gangneung-forest", title: "강릉 숲길", region: "강릉" },
  { id: "gangwon-gangneung-sea", title: "강릉 바다", region: "강릉" },
  { id: "gangwon-sokcho-sea", title: "속초 바다", region: "속초" },
];

describe("여행 취향의 저장·호환 계약", () => {
  it("설정 전에는 임의의 관심사·페이스·동행을 만들지 않는다", () => {
    expect(normalizeTravelPreference(null)).toBeNull();
    expect(applyTravelPreference({}, null)).toEqual({ options: {}, labels: [] });
  });
  it("기존 테마 ID와 지역 코스 ID를 같은 관심 분야로 옮긴다", () => {
    expect(
      normalizeTravelPreference({
        interestThemeIds: [
          "east-sea-sunrise",
          "gangwon-yanggu-culture",
          "quiet-inland",
          "deleted-theme",
        ],
        paceId: "calm",
        companionId: "solo",
      }),
    ).toEqual({
      interestThemeIds: ["topic:sea", "topic:culture", "topic:forest", "topic:quiet"],
      paceId: "calm",
      companionId: "solo",
    });
  });
  it("지역 코스의 local 분류를 사용하고 종합 코스와 가상의 market ID는 추측하지 않는다", () => {
    expect(
      normalizeTravelPreference({
        interestThemeIds: [
          "gangwon-goseong-local",
          "gangwon-sokcho-highlights",
          "gangwon-gangneung-market",
        ],
        paceId: "",
        companionId: "",
      })?.interestThemeIds,
    ).toEqual(["topic:local"]);
  });
  it("알 수 없는 기존 여행 스타일을 표시·추천 값으로 사용하지 않는다", () => {
    expect(
      normalizeTravelPreference({ interestThemeIds: [], paceId: "fast", companionId: "anybody" }),
    ).toEqual({ interestThemeIds: [], paceId: "", companionId: "" });
  });
  it("선택을 모두 비워 저장할 수 있고 중복 코드는 한 번만 저장한다", () => {
    expect(
      travelPreferenceSchema.parse({ interestThemeIds: [], paceId: "", companionId: "" }),
    ).toEqual({ interestThemeIds: [], paceId: "", companionId: "" });
    expect(
      travelPreferenceSchema.parse({ ...preference, interestThemeIds: ["topic:sea", "topic:sea"] })
        .interestThemeIds,
    ).toEqual(["topic:sea"]);
  });
  it("임의 테마·스타일·사용자 ID를 쓰기 입력으로 허용하지 않는다", () => {
    for (const data of [
      { ...preference, interestThemeIds: ["fake-theme"] },
      { ...preference, paceId: "unknown" },
      { ...preference, userId: "someone-else" },
    ])
      expect(travelPreferenceSchema.safeParse(data).success).toBe(false);
  });
  it("검색·코스에서 직접 지정한 조건을 저장 취향보다 우선한다", () => {
    expect(
      applyTravelPreference(
        { pace: "active", companion: "solo", days: 2, transport: "transit" },
        preference,
      ),
    ).toEqual({
      options: { pace: "active", companion: "solo", days: 2, transport: "transit" },
      labels: [],
    });
  });
  it("비워 둔 페이스·동행만 보충하고 지역·날짜·교통을 추측하지 않는다", () => {
    expect(applyTravelPreference({ days: 1 }, preference)).toEqual({
      options: { days: 1, pace: "calm", companion: "family" },
      labels: ["여유 페이스", "가족 여행"],
    });
  });
});

describe("키워드 조건 우선의 취향 보조 정렬", () => {
  it("지역만 정한 경우 그 지역 안에서 관심 분야를 참고한다", () => {
    const result = rankCatalogThemes("강릉 여행", themes, 2, { preferredTopicIds: ["sea"] });
    expect(result.primaryId).toBe("gangwon-gangneung-sea");
    expect(result.explanation?.preference?.ko).toContain("저장한 관심 분야");
    expect(result.altIds).not.toContain("gangwon-sokcho-sea");
  });
  it("저장한 바다 취향이 명시한 숲 키워드를 덮어쓰지 않는다", () => {
    expect(rankCatalogThemes("강릉 숲", themes, 2, { preferredTopicIds: ["sea"] }).primaryId).toBe(
      "gangwon-gangneung-forest",
    );
  });
  it("제외한 관심 분야를 추천하거나 무관한 입력을 성공으로 바꾸지 않는다", () => {
    const result = rankCatalogThemes("강릉 바다 말고 숲", themes, 2, {
      preferredTopicIds: ["sea"],
    });
    expect(result.primaryId).toBe("gangwon-gangneung-forest");
    expect(result.altIds).not.toContain("gangwon-gangneung-sea");
    expect(
      rankCatalogThemes("컴퓨터 수리", themes, 2, { preferredTopicIds: ["sea"] }).primaryId,
    ).toBe("");
    expect(rankCatalogThemes("", themes, 2, { preferredTopicIds: ["sea"] }).primaryId).toBe("");
  });
  it("미설정 사용자의 기존 대표 추천 순서를 유지한다", () => {
    expect(rankCatalogThemes("강릉 여행", themes).primaryId).toBe("gangwon-gangneung-highlights");
  });
});
