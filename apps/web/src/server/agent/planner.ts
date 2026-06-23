// ─────────────────────────────────────────────
// Planner — Multi-step Tool-Calling 루프 (서버 전용).
//
// [학습 메모] 이 파일이 "에이전트"의 심장이다. 결정형 파이프라인은 호출 순서가
// 코드에 박혀 있지만, 여기서는 매 스텝 LLM(llm.decide)에게 "다음에 뭘 할래?"를 묻고
// 그 답(도구 호출 or 종료)에 따라 움직인다. 순서를 코드가 아니라 LLM 이 정한다.
//
// 비결정성을 길들이는 4겹 안전장치:
//   1) 화이트리스트 — 등록된 도구 외 호출은 거부(헛것 차단).
//   2) 중복 차단   — 같은 도구·인자 반복 호출을 막아 무한 루프·낭비 방지.
//   3) MAX_STEPS  — 스텝 상한. 초과 시 결정형 폴백.
//   4) 폴백        — 루프가 실패/이상 종료하면 결정형 로직으로 무중단 복귀.
//
// 진입점 2개가 공용 루프(runAgentLoop)를 공유한다:
//   - planCourse    : 자연어 의도 → 대표/보조 테마 선택 (matchThemes 위임)
//   - planItinerary : 테마 코스를 혼잡 기준으로 정리/재배치 (getCourse 위임)
// 둘은 "최종 결과를 어떻게 조립하느냐"만 다르고 루프 기계는 동일하다.
// ─────────────────────────────────────────────

import type { LocalizedText } from "@/lib/i18n";
import type { Course } from "@/domain/types";
import { createLogger } from "@/server/log";
import type {
  AgentStep,
  FinalAnswer,
  LlmProvider,
  PlanRequest,
  PlanResult,
  ToolSpec,
} from "./types";

const log = createLogger("agent");

const DEFAULT_MAX_STEPS = 8;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ── 공용 루프 ────────────────────────────────

/** 루프 결과: 정상 종료(final) 또는 폴백 필요(failure). 어느 쪽이든 trace 는 반환. */
interface LoopOutcome {
  trace: AgentStep[];
  final?: FinalAnswer;
  failure?: string;
}

/**
 * LLM 이 final 을 낼 때까지 도구를 호출하는 핵심 루프 + 4겹 가드레일.
 * 도메인 의미(테마/코스)를 모른다 — 결과 조립은 호출자(planCourse/planItinerary)가 한다.
 */
async function runAgentLoop(
  request: PlanRequest,
  llm: LlmProvider,
  tools: ToolSpec[],
  maxSteps: number,
): Promise<LoopOutcome> {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const trace: AgentStep[] = [];
  const seen = new Set<string>();

  try {
    while (trace.length < maxSteps) {
      const decision = await llm.decide({ request, tools, trace });

      if (decision.kind === "final") {
        return { trace, final: decision.final };
      }

      const { name, args } = decision.tool;
      const t0 = Date.now();

      // 가드레일 1: 화이트리스트
      const spec = byName.get(name);
      if (!spec) {
        trace.push({ tool: name, args, ok: false, error: "등록되지 않은 도구", ms: 0 });
        log.warn(`blocked unknown tool: ${name}`);
        continue;
      }

      // 가드레일 2: 동일 호출 중복 차단
      const key = `${name}:${JSON.stringify(args)}`;
      if (seen.has(key)) {
        trace.push({ tool: name, args, ok: false, error: "중복 호출 차단", ms: 0 });
        continue;
      }
      seen.add(key);

      // 도구 실행 (개별 실패는 trace 기록 후 계속 — LLM 이 대안을 찾도록)
      try {
        const result = await spec.run(args);
        trace.push({ tool: name, args, ok: true, result, ms: Date.now() - t0 });
        log.log(`tool ${name} ✓ ${Date.now() - t0}ms`);
      } catch (e) {
        trace.push({ tool: name, args, ok: false, error: errMsg(e), ms: Date.now() - t0 });
        log.warn(`tool ${name} ✗ ${errMsg(e)}`);
      }
    }

    // 가드레일 3: 스텝 초과
    return { trace, failure: "MAX_STEPS 초과" };
  } catch (e) {
    // 가드레일 4: LLM 무응답·예외
    return { trace, failure: errMsg(e) };
  }
}

// ── 진입점 1: 테마 선택 (matchThemes 위임) ────

export interface FallbackResult {
  primaryThemeId: string;
  altThemeIds: string[];
  rationale: LocalizedText;
  course?: Course;
}

export interface PlannerDeps {
  llm: LlmProvider;
  tools: ToolSpec[];
  /** 에이전트 실패 시 결정형 폴백(키워드 매칭 등). 항상 성공해야 한다. */
  fallback(): Promise<FallbackResult>;
  maxSteps?: number;
}

/** 자연어 의도 → (LLM 이 고른 도구들로) 대표/보조 테마 선택. 실패 시 결정형 폴백. */
export async function planCourse(req: PlanRequest, deps: PlannerDeps): Promise<PlanResult> {
  const out = await runAgentLoop(req, deps.llm, deps.tools, deps.maxSteps ?? DEFAULT_MAX_STEPS);

  if (out.final) {
    log.log(`done (agent) — steps=${out.trace.length} theme=${out.final.primaryThemeId ?? ""}`);
    return {
      primaryThemeId: out.final.primaryThemeId ?? "",
      altThemeIds: out.final.altThemeIds ?? [],
      rationale: out.final.rationale,
      trace: out.trace,
      source: "agent",
    };
  }

  log.warn(`fallback (${out.failure}) — steps=${out.trace.length}`);
  const fb = await deps.fallback();
  return { ...fb, trace: out.trace, source: "fallback" };
}

// ── 진입점 2: 코스 정리 (getCourse 위임) ──────

export interface ItineraryResult {
  /** 재정렬·주석이 반영된 코스 */
  course: Course;
  rationale: LocalizedText;
  trace: AgentStep[];
  source: "agent" | "fallback";
}

export interface ItineraryDeps {
  llm: LlmProvider;
  tools: ToolSpec[];
  /** 결정형으로 미리 로드한 큐레이션 코스(재정렬의 바탕) */
  baseCourse: Course;
  /** trace 의 reorder_by_congestion 결과들을 baseCourse 에 반영해 최종 코스를 만든다(순수). */
  assemble(base: Course, trace: AgentStep[], rationale: LocalizedText): Course;
  /** 에이전트 실패 시 결정형 재정렬. 항상 성공해야 한다. */
  fallback(): Promise<{ course: Course; rationale: LocalizedText }>;
  maxSteps?: number;
}

/**
 * 테마 코스를 현재 혼잡 기준으로 정리한다.
 * [학습 메모] LLM 은 "어느 날을 재정렬할지"를 오케스트레이션하고(루프), 실제 재배치 수치는
 * reorder_by_congestion 도구(순수함수)가 계산한다. 플래너는 그 도구 결과(trace)를 baseCourse 에
 * 반영(assemble)할 뿐 — 숫자를 LLM 에게 맡기지 않아 일관성/정확성을 지킨다.
 */
export async function planItinerary(req: PlanRequest, deps: ItineraryDeps): Promise<ItineraryResult> {
  const out = await runAgentLoop(req, deps.llm, deps.tools, deps.maxSteps ?? DEFAULT_MAX_STEPS);

  if (out.final) {
    log.log(`done (agent itinerary) — steps=${out.trace.length}`);
    const course = deps.assemble(deps.baseCourse, out.trace, out.final.rationale);
    return { course, rationale: out.final.rationale, trace: out.trace, source: "agent" };
  }

  log.warn(`fallback itinerary (${out.failure}) — steps=${out.trace.length}`);
  const fb = await deps.fallback();
  return { course: fb.course, rationale: fb.rationale, trace: out.trace, source: "fallback" };
}
