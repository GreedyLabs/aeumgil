// ─────────────────────────────────────────────
// 룰브릭 채점기 — 결정형 규칙으로 에이전트 결과를 판정한다.
//
// [학습 메모] Evaluation 채점에는 크게 두 방식이 있다:
//   (1) 룰브릭(코드 규칙)   — 객관·재현 가능·무료. "테마가 실제로 존재하나?" 같은 것.
//   (2) LLM-as-judge(모델) — 주관 품질("추천 근거가 설득력 있나?")용. 비용·변동 있음.
// 여기선 키 없이 도는 (1)부터 깐다. (2)는 RealLlmProvider 합류 후 같은 하네스에 추가.
// 좋은 룰브릭은 "정답 한 개"가 아니라 "지켜야 할 속성"을 본다(아래 각 함수).
// ─────────────────────────────────────────────

import type { Scorer } from "./types";

/** 대표 테마가 실제 존재하는 테마인가 (헛것 생성 차단). */
export function themeValidity(validThemeIds: string[]): Scorer {
  return (c, r) => {
    const ok = c.expectNoMatch
      ? r.primaryThemeId === "" && r.altThemeIds.length === 0
      : r.primaryThemeId.length > 0 && validThemeIds.includes(r.primaryThemeId);
    return {
      scorer: "themeValidity",
      pass: ok,
      detail: ok ? r.primaryThemeId : `invalid: "${r.primaryThemeId}"`,
    };
  };
}

/** 보조 테마가 모두 유효하고 대표와 중복되지 않는가. */
export function altThemesClean(validThemeIds: string[]): Scorer {
  return (_c, r) => {
    const bad = r.altThemeIds.filter(
      (id) => !validThemeIds.includes(id) || id === r.primaryThemeId,
    );
    return {
      scorer: "altThemesClean",
      pass: bad.length === 0,
      detail: bad.length ? `bad: ${bad.join(",")}` : "ok",
    };
  };
}

/** 에이전트가 정상 종료했는가 (폴백이 아니라). 에이전트 신뢰도 지표. */
export const agentCompleted: Scorer = (_c, r) => ({
  scorer: "agentCompleted",
  pass: r.source === "agent",
  detail: r.source,
});

/** "한산" 제약이 있는 케이스면 혼잡도 도구를 실제로 거쳤는가 (제약 준수). */
export const constraintAdherence: Scorer = (c, r) => {
  if (!c.expectQuietHandling) return { scorer: "constraintAdherence", pass: true, detail: "n/a" };
  const consulted = r.trace.some((s) => s.tool === "estimate_congestion");
  return {
    scorer: "constraintAdherence",
    pass: consulted,
    detail: consulted ? "혼잡 확인함" : "혼잡 확인 누락",
  };
};

/** 가드레일 위반(화이트리스트 밖 도구 호출)이 결과에 섞이지 않았는가. */
export const traceHealth: Scorer = (_c, r) => {
  const breach = r.trace.some((s) => s.error === "등록되지 않은 도구");
  return { scorer: "traceHealth", pass: !breach, detail: breach ? "미등록 도구 호출됨" : "ok" };
};

/** 표준 채점기 묶음(유효 테마 목록 주입). */
export function defaultScorers(validThemeIds: string[]): Scorer[] {
  return [
    themeValidity(validThemeIds),
    altThemesClean(validThemeIds),
    agentCompleted,
    constraintAdherence,
    traceHealth,
  ];
}
