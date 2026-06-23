// 평가 하네스 테스트 — mock(heuristic) 에이전트를 룰브릭으로 채점.
//
// [학습 메모] 결정형 mock 위에선 통과율이 높게(보통 100%) 나오는 게 정상이다 —
// 이건 "기준선(baseline)"이다. 진짜 가치는 C단계에서 RealLlmProvider 를 끼웠을 때
// 같은 하네스가 변동·회귀를 숫자로 잡아주는 것. 여기선 하네스가 동작하고, 가드레일·
// 제약 준수 같은 핵심 기준이 mock 에서 깨지지 않음을 보장한다.

import { describe, expect, it } from "vitest";
import { heuristicProvider } from "../llm";
import { DATASET, sampleEvalContext } from "./dataset";
import { defaultScorers } from "./scorers";
import { formatReport, runEval } from "./runner";

describe("Evaluation 하네스", () => {
  it("mock 에이전트가 기준선 통과율(≥0.75) 이상", async () => {
    const ctx = sampleEvalContext();
    const ids = ctx.themes.map((t) => t.id);

    const report = await runEval({
      llm: heuristicProvider(),
      context: ctx,
      dataset: DATASET,
      scorers: defaultScorers(ids),
    });

    expect(report.total).toBe(DATASET.length);
    expect(report.passRate).toBeGreaterThanOrEqual(0.75);
  });

  it("가드레일·제약 준수 기준은 mock 에서 전부 통과한다", async () => {
    const ctx = sampleEvalContext();
    const ids = ctx.themes.map((t) => t.id);
    const report = await runEval({
      llm: heuristicProvider(),
      context: ctx,
      dataset: DATASET,
      scorers: defaultScorers(ids),
    });

    const health = report.byScorer["traceHealth"];
    const adherence = report.byScorer["constraintAdherence"];
    const validity = report.byScorer["themeValidity"];
    expect(health?.pass).toBe(health?.total); // 화이트리스트 위반 0
    expect(adherence?.pass).toBe(adherence?.total); // "한산" 케이스는 혼잡 확인함
    expect(validity?.pass).toBe(validity?.total); // 헛 테마 0
  });

  it("formatReport 는 요약 문자열을 만든다", async () => {
    const ctx = sampleEvalContext();
    const report = await runEval({
      llm: heuristicProvider(),
      context: ctx,
      dataset: DATASET,
      scorers: defaultScorers(ctx.themes.map((t) => t.id)),
    });
    expect(formatReport(report)).toContain("통과");
  });
});
