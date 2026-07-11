// 자연어 → 테마 키워드 매칭 단위 테스트.

import { describe, expect, it } from "vitest";
import { matchThemeIdsByKeyword, matchThemes, normalizeIntentQuery } from "./matching";
import { THEME_KEYWORD_RULES } from "./theme-keywords";
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

describe("matchThemeIdsByKeyword", () => {
  it("걸린 규칙만 순서대로 돌려주고, 미스면 빈 배열이다(폴백 없음)", () => {
    expect(matchThemeIdsByKeyword("시장 구경하고 카페도", rules)).toEqual(["market-local", "cafe-viewpoint"]);
    expect(matchThemeIdsByKeyword("zzzz 의미없는 입력", rules)).toEqual([]);
  });
});

describe("THEME_KEYWORD_RULES (도메인 정본 규칙)", () => {
  it("규칙의 themeId 는 전부 시드 카탈로그의 테마 id 다", () => {
    for (const rule of THEME_KEYWORD_RULES) {
      expect(themeIds).toContain(rule.themeId);
    }
  });

  it("서로 다른 의도의 쿼리가 같은 테마로 수렴하지 않는다 (2026-07-11 회귀)", () => {
    // 전부 family-experience 로 수렴하던 실사용 쿼리들.
    const cases: Array<[string, string]> = [
      ["부모님이랑 조용한 곳", "quiet-inland"],
      ["아이들과 신나는 체험 여행", "family-experience"],
      ["맛있는거 먹으러 가고 싶어", "market-local"],
      ["바다 보고 힐링", "east-sea-sunrise"], // 구체 장소(바다)가 무드(힐링)보다 우선
    ];
    for (const [query, expected] of cases) {
      expect(matchThemeIdsByKeyword(query, THEME_KEYWORD_RULES)[0]).toBe(expected);
    }
    // 무드는 보조 테마로 살아남는다.
    expect(matchThemeIdsByKeyword("바다 보고 힐링", THEME_KEYWORD_RULES)).toContain("quiet-inland");
  });
});

describe("normalizeIntentQuery", () => {
  it("연속 공백·개행을 한 칸으로 붙이고 양끝을 자른다", () => {
    expect(normalizeIntentQuery("  부모님이랑 \n\n 바다  보고 싶어  ")).toBe("부모님이랑 바다 보고 싶어");
  });

  it("공백뿐인 입력은 빈 문자열이 된다", () => {
    expect(normalizeIntentQuery("   \n\t ")).toBe("");
  });
});
