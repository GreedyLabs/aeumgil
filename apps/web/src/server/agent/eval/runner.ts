// ─────────────────────────────────────────────
// 평가 러너 — 데이터셋을 에이전트로 돌리고 채점·집계한다.
//
// [학습 메모] 프로바이더 무관 설계가 핵심이다. llm 만 바꿔 끼우면(mock↔real) 같은
// 데이터셋·같은 채점기로 측정해 "프롬프트/모델을 바꿨더니 통과율이 얼마나 변했나"를
// 정량 비교할 수 있다. 이게 "평가 기반 지속 개선" 루프의 토대다.
// ─────────────────────────────────────────────

import { L } from "@/lib/i18n";
import { buildTools } from "../tools";
import { planCourse } from "../planner";
import type { LlmProvider, ToolContext } from "../types";
import type { CaseRun, EvalCase, EvalReport, Scorer } from "./types";

export interface EvalOptions {
  /** 평가 대상 LLM(지금은 mock heuristic, 나중엔 real) */
  llm: LlmProvider;
  /** 도구가 닿을 데이터·포트 */
  context: ToolContext;
  dataset: EvalCase[];
  scorers: Scorer[];
}

export async function runEval(opts: EvalOptions): Promise<EvalReport> {
  const tools = buildTools(opts.context);
  const validThemeIds = opts.context.themes.map((t) => t.id);
  const fallbackThemeId = validThemeIds[0] ?? "";

  const cases: CaseRun[] = [];
  const byScorer: Record<string, { pass: number; total: number }> = {};

  for (const c of opts.dataset) {
    const result = await planCourse(
      { intent: c.intent, lang: "ko", at: opts.context.now() },
      {
        llm: opts.llm,
        tools,
        // 평가에서도 폴백은 유효한 결과를 내야 한다(에이전트 실패가 곧 채점 불가는 아님).
        fallback: async () => ({ primaryThemeId: fallbackThemeId, altThemeIds: [], rationale: L("폴백") }),
      },
    );

    const scores = opts.scorers.map((s) => s(c, result));
    for (const s of scores) {
      const b = (byScorer[s.scorer] ??= { pass: 0, total: 0 });
      b.total += 1;
      if (s.pass) b.pass += 1;
    }
    cases.push({ id: c.id, intent: c.intent, result, scores, passed: scores.every((s) => s.pass) });
  }

  const passed = cases.filter((c) => c.passed).length;
  return {
    total: cases.length,
    passed,
    passRate: cases.length ? passed / cases.length : 0,
    byScorer,
    cases,
  };
}

/** 사람이 읽는 한 줄 요약(콘솔/로그용). */
export function formatReport(r: EvalReport): string {
  const head = `통과 ${r.passed}/${r.total} (${Math.round(r.passRate * 100)}%)`;
  const perScorer = Object.entries(r.byScorer)
    .map(([name, s]) => `${name} ${s.pass}/${s.total}`)
    .join(" · ");
  return `${head} — ${perScorer}`;
}
