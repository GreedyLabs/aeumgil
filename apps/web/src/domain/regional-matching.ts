import { rankCatalogThemes, type MatchableTheme } from "./matching";

/** 에이전트 실험 경로와 서비스가 같은 지역·키워드 판정을 사용한다. */
export function regionalThemeMatch(query: string, themes: MatchableTheme[]): string | undefined {
  const match = rankCatalogThemes(query, themes);
  return match.explanation?.regions.length ? match.primaryId || undefined : undefined;
}
