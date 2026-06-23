// 자연어 → 테마 키워드 매칭 단위 테스트.

import { describe, expect, it } from "vitest";
import { matchThemes } from "./matching";
import type { KeywordRule } from "./types";

// design/data.ts 의 KEYWORD_MATCH 와 동일 구조의 대표 규칙(테스트 고정값).
const rules: KeywordRule[] = [
  { keywords: ["조용", "한적", "quiet", "calm"], themeId: "quiet-inland" },
  { keywords: ["바다", "해변", "일출", "sea", "beach"], themeId: "east-sea-sunrise" },
  { keywords: ["산", "트레킹", "mountain", "trek"], themeId: "mountain-trek" },
  { keywords: ["시장", "맛집", "market", "food"], themeId: "market-local" },
  { keywords: ["카페", "뷰", "cafe", "view"], themeId: "cafe-viewpoint" },
  { keywords: ["가족", "아이", "family"], themeId: "family-experience" },
];
const themeIds = [
  "quiet-inland",
  "east-sea-sunrise",
  "mountain-trek",
  "market-local",
  "cafe-viewpoint",
  "family-experience",
];

describe("matchThemes", () => {
  it("키워드로 대표 테마를 고른다", () => {
    expect(matchThemes("오늘 조용하게 여행하고 싶어", rules, themeIds).primaryId).toBe("quiet-inland");
    expect(matchThemes("바다 일출 보러 가자", rules, themeIds).primaryId).toBe("east-sea-sunrise");
  });

  it("영문 키워드도 대소문자 무관하게 매칭한다", () => {
    expect(matchThemes("I want a MOUNTAIN trek", rules, themeIds).primaryId).toBe("mountain-trek");
  });

  it("매칭이 없으면 첫 테마로 폴백한다", () => {
    expect(matchThemes("zzzz 의미없는 입력", rules, themeIds).primaryId).toBe(themeIds[0]);
  });

  it("보조 테마는 대표를 제외하고 최대 개수만큼 채운다", () => {
    const { primaryId, altIds } = matchThemes("조용한 여행", rules, themeIds);
    expect(altIds).not.toContain(primaryId);
    expect(altIds.length).toBeLessThanOrEqual(2);
    expect(new Set(altIds).size).toBe(altIds.length); // 중복 없음
  });

  it("maxAlts 로 보조 테마 개수를 제한한다", () => {
    expect(matchThemes("바다", rules, themeIds, 3).altIds.length).toBeLessThanOrEqual(3);
    expect(matchThemes("바다", rules, themeIds, 0).altIds).toHaveLength(0);
  });

  it("여러 규칙에 걸리면 먼저 걸린 규칙이 대표가 된다", () => {
    // '시장'(market-local)이 '카페'(cafe-viewpoint)보다 규칙 순서상 앞
    const { primaryId, altIds } = matchThemes("시장 구경하고 카페도 갈래", rules, themeIds);
    expect(primaryId).toBe("market-local");
    expect(altIds).toContain("cafe-viewpoint");
  });
});
