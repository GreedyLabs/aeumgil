// ─────────────────────────────────────────────
// LLM Evaluation — 타입 (서버 전용).
//
// [학습 메모] 에이전트는 비결정적이라 "한 번 잘 됐다"가 품질을 보장하지 않는다. 그래서
// 고정된 케이스 묶음(dataset)에 대해 매 결과를 규칙(rubric)으로 채점하고, 통과율을
// 숫자로 본다. 프롬프트·모델을 바꿀 때마다 이 숫자로 회귀를 잡는 게 Evaluation 의 핵심.
//
// 이 하네스는 "프로바이더 무관"으로 설계한다: 지금은 mock(heuristic)을 채점하지만,
// C단계에서 RealLlmProvider 를 끼우면 같은 채점기로 실모델 품질을 측정·비교할 수 있다.
// ─────────────────────────────────────────────

import type { PlanResult } from "../types";

/** 평가 케이스 — 정답 라벨이 아니라 "기대 속성"을 담는다(룰브릭 채점). */
export interface EvalCase {
  /** 목적 단어가 없는 입력은 임의 추천 없이 빈 결과가 정답이다. */
  expectNoMatch?: boolean;
  id: string;
  intent: string;
  /** "한산/조용" 류 제약이 있어 혼잡 확인을 기대하는 케이스인지 */
  expectQuietHandling?: boolean;
}

/** 채점기 1개의 판정 결과. */
export interface ScoreLine {
  scorer: string;
  pass: boolean;
  detail: string;
}

/** 한 케이스의 실행 + 채점 결과. */
export interface CaseRun {
  id: string;
  intent: string;
  result: PlanResult;
  scores: ScoreLine[];
  /** 모든 채점기를 통과했는가 */
  passed: boolean;
}

/** 데이터셋 전체 집계. */
export interface EvalReport {
  total: number;
  passed: number;
  passRate: number;
  /** 채점기별 통과/전체 (어떤 기준이 약한지 진단) */
  byScorer: Record<string, { pass: number; total: number }>;
  cases: CaseRun[];
}

/**
 * 채점기: (케이스, 에이전트 결과) → 통과 여부.
 * 유효 테마 목록 같은 문맥은 클로저로 주입한다(아래 scorers.ts 참고).
 */
export type Scorer = (c: EvalCase, r: PlanResult) => ScoreLine;
