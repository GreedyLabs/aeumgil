// ─────────────────────────────────────────────
// Evaluation — 실모델 1회전 (플랜 §6.2).
//
// [학습 메모] mock(heuristic) 위에서 도는 eval.test.ts 가 "기준선(baseline)"이라면,
// 이 파일은 **같은 데이터셋·같은 채점기**를 실모델(OpenAI-compatible)에 돌려
// 변동·회귀를 숫자로 잡는다. 러너가 프로바이더 무관이라 llm 만 갈아끼우면 된다.
// 네트워크·비용(또는 로컬 GPU 시간)이 들므로 EUMGIL_EVAL_REAL=1 일 때만 돈다:
//   pnpm --filter @eumgil/web eval:real
// 하드 assert 는 구조(케이스 수)만 건다 — 통과율 자체는 "측정 결과"이지 회귀 게이트가
// 아니기 때문(모델·프롬프트 튜닝의 비교 지표로 리포트에 기록한다).
// ─────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import { heuristicProvider, openAiProviderFromEnv } from "../llm";
import { DATASET, sampleEvalContext } from "./dataset";
import { defaultScorers } from "./scorers";
import { formatReport, runEval } from "./runner";

const REAL = process.env.EUMGIL_EVAL_REAL === "1";

describe.skipIf(!REAL)("Evaluation — 실모델(OpenAI-compatible)", () => {
  it(
    "mock 기준선과 실모델 리포트를 나란히 낸다",
    async () => {
      const real = openAiProviderFromEnv();
      if (!real) {
        throw new Error(
          "실모델 설정이 없습니다 — .env 에 EUMGIL_AGENT_LLM=openai + OPENAI_BASE_URL(로컬 서버) 또는 OPENAI_API_KEY 를 설정하세요.",
        );
      }

      const ctx = sampleEvalContext();
      const ids = ctx.themes.map((t) => t.id);
      const scorers = defaultScorers(ids);

      const mockReport = await runEval({ llm: heuristicProvider(), context: ctx, dataset: DATASET, scorers });
      const realReport = await runEval({ llm: real, context: ctx, dataset: DATASET, scorers });

      console.log(`[mock] ${formatReport(mockReport)}`);
      console.log(`[real] ${formatReport(realReport)}`);
      for (const c of realReport.cases) {
        const scores = c.scores
          .map((s) => `${s.scorer}=${s.pass ? "✓" : `✗(${s.detail})`}`)
          .join(" ");
        console.log(
          `[real:${c.id}] source=${c.result.source} theme=${c.result.primaryThemeId} steps=${c.result.trace.length} ${scores}`,
        );
        console.log(`[real:${c.id}] rationale(ko): ${c.result.rationale.ko}`);
      }

      expect(realReport.total).toBe(DATASET.length);
    },
    600_000,
  );
});
