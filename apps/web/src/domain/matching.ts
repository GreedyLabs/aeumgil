// ─────────────────────────────────────────────
// 자연어 → 테마 매칭 (Phase 0: 키워드 규칙 방식)
//
// 확정 방향: 키워드 규칙으로 먼저 구현하고, 개발 후반에 LLM 분류 도입을 검토.
// 순수 함수로 유지해 mock/실데이터 구현과 단위 테스트에서 공유한다.
// ─────────────────────────────────────────────

import type { KeywordRule, ThemeMatch } from "./types";

/**
 * 입력 문장을 키워드 규칙에 매칭해 대표 테마 1개 + 보조 테마를 고른다.
 *
 * @param query     사용자 자연어 입력
 * @param rules     키워드 → themeId 규칙
 * @param themeIds  전체 테마 id (보조 테마 채우기 / 폴백용, 우선순위 순)
 * @param maxAlts   보조 테마 최대 개수
 */
export function matchThemes(
  query: string,
  rules: KeywordRule[],
  themeIds: string[],
  maxAlts = 2,
): ThemeMatch {
  const q = query.toLowerCase();

  const matched: string[] = [];
  for (const rule of rules) {
    const hit = rule.keywords.some((k) => q.includes(k.toLowerCase()));
    if (hit && !matched.includes(rule.themeId)) {
      matched.push(rule.themeId);
    }
  }

  const primaryId = matched[0] ?? themeIds[0] ?? "";

  const altIds: string[] = [];
  for (const id of [...matched.slice(1), ...themeIds]) {
    if (altIds.length >= maxAlts) break;
    if (id && id !== primaryId && !altIds.includes(id)) {
      altIds.push(id);
    }
  }

  return { primaryId, altIds };
}
