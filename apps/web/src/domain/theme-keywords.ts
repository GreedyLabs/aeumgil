// ─────────────────────────────────────────────
// 자연어 → 테마 키워드 규칙 (정적 큐레이션 — 데이터 분류 ①)
//
// design/data.ts 의 프로토타입 KEYWORD_MATCH 를 도메인 정본으로 승격한 것.
// 규칙 배열 순서가 곧 우선순위다(여러 규칙에 걸리면 앞 규칙이 대표 테마).
// 순서 원칙: **구체 장소 명사(바다/산/시장/카페) > 동반자·활동(가족/체험) > 무드
// 형용사(조용/힐링)**. "바다 보고 힐링"처럼 섞이면 장소가 대표, 무드는 보조 테마가
// 되는 게 자연스럽기 때문.
//
// [학습 메모] 이 규칙은 heuristic 판단부(llm.ts)와 결정형 폴백(repository)이
// **공유하는 1차 신호**다. LLM 이 있든 없든 "바다 → 동해 테마" 같은 기준선이
// 같은 데서 나오게 해, 프로바이더 교체·폴백 전환 시 결과 일관성을 확보한다.
// 실 LLM 은 이 기준선을 넘어서는 뉘앙스(부정·비유·복합 의도)를 다듬는 역할.
// ─────────────────────────────────────────────

import type { KeywordRule } from "./types";

export const THEME_KEYWORD_RULES: KeywordRule[] = [
  { keywords: ["바다", "해변", "일출", "동해", "해안", "sea", "beach", "sunrise", "coast"], themeId: "east-sea-sunrise" },
  { keywords: ["드라이브", "drive"], themeId: "east-sea-sunrise" },
  { keywords: ["산", "트레킹", "등산", "설악", "오대", "mountain", "trek", "hike"], themeId: "mountain-trek" },
  { keywords: ["시장", "맛집", "먹", "미식", "로컬", "항구", "market", "food", "local"], themeId: "market-local" },
  { keywords: ["카페", "뷰", "사진", "감성", "커피", "cafe", "view", "photo", "coffee"], themeId: "cafe-viewpoint" },
  { keywords: ["가족", "아이", "체험", "양떼", "family", "kids", "child"], themeId: "family-experience" },
  { keywords: ["내륙", "숲", "계곡", "사찰", "inland", "forest", "temple"], themeId: "quiet-inland" },
  { keywords: ["조용", "한적", "고요", "혼자", "차분", "힐링", "휴식", "쉬고", "quiet", "calm", "alone", "rest"], themeId: "quiet-inland" },
];
