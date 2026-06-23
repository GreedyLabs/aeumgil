// ─────────────────────────────────────────────
// LlmProvider 구현 — 키 없이 도는 mock.
//
// [학습 메모] 실 LLM 의 비결정성을 그대로 두면 테스트가 불가능하다. 그래서 골격
// 단계에서는 LLM 자리에 "결정적 대역(test double)"을 끼운다. 두 종류를 제공:
//   1) scriptedProvider : 미리 정한 결정 배열을 그대로 재생 (로직 없음 = 순수 대역).
//                         루프 기계(가드레일·trace·폴백)를 검증하는 데 쓴다.
//   2) heuristicProvider: 의도(intent)에 따라 경로가 갈리는 모습을 보여주는 데모 대역.
//                         "입력이 바뀌면 도구 호출 순서가 바뀐다"는 에이전트의 본질을
//                         키 없이 시연한다. (실 LLM 으로 교체될 임시물)
//
// C단계에서 RealLlmProvider(키 필요)를 추가하면 이 파일의 인터페이스만 구현하면 된다.
// ─────────────────────────────────────────────

import { L } from "@/lib/i18n";
import type { AgentStep, LlmDecideInput, LlmDecision, LlmProvider } from "./types";

// ── 1) 스크립트 재생 대역 ─────────────────────

/**
 * 정해진 결정들을 순서대로 재생한다. 스크립트가 소진되면 throw → 플래너 폴백 경로를
 * 테스트할 수 있다. (정상 시나리오 테스트는 final 로 끝나는 완전한 스크립트를 준다.)
 */
export function scriptedProvider(decisions: LlmDecision[]): LlmProvider {
  let i = 0;
  return {
    async decide(): Promise<LlmDecision> {
      const d = decisions[i++];
      if (!d) throw new Error("스크립트 소진(LLM 무응답 시뮬레이션)");
      return d;
    },
  };
}

// ── 2) 의도 기반 휴리스틱 데모 대역 ───────────

const QUIET_HINTS = ["한산", "안 붐", "안붐", "조용", "여유", "느긋", "한적"];

function wantsQuiet(intent: string): boolean {
  return QUIET_HINTS.some((h) => intent.includes(h));
}

/** trace 에서 특정 도구가 호출됐는지 */
function called(trace: AgentStep[], tool: string): boolean {
  return trace.some((s) => s.tool === tool);
}

/** 가장 최근 성공한 해당 도구 결과를 꺼낸다 */
function lastResult(trace: AgentStep[], tool: string): unknown {
  for (let i = trace.length - 1; i >= 0; i--) {
    const s = trace[i];
    if (s && s.tool === tool && s.ok) return s.result;
  }
  return undefined;
}

/** list_themes 결과(배열)에서 의도와 가장 겹치는 테마 id 를 고른다(없으면 첫 번째). */
function chooseTheme(intent: string, themesResult: unknown): string | undefined {
  if (!Array.isArray(themesResult) || themesResult.length === 0) return undefined;
  const q = intent.toLowerCase();
  for (const t of themesResult) {
    const tags: string[] = [
      ...(typeof (t as { title?: unknown }).title === "string" ? [(t as { title: string }).title] : []),
      ...(typeof (t as { tag?: unknown }).tag === "string" ? [(t as { tag: string }).tag] : []),
      ...(Array.isArray((t as { mood?: unknown }).mood) ? ((t as { mood: string[] }).mood) : []),
    ];
    if (tags.some((tag) => q.includes(String(tag).toLowerCase()) || String(tag).toLowerCase().includes(q.slice(0, 2)))) {
      return String((t as { id: unknown }).id);
    }
  }
  return String((themesResult[0] as { id: unknown }).id);
}

/** get_course 결과에서 첫 스팟 refId 를 꺼낸다 */
function firstSpotId(courseResult: unknown): string | undefined {
  const items = (courseResult as { items?: unknown }).items;
  if (!Array.isArray(items)) return undefined;
  const spot = items.find((it) => (it as { kind?: unknown }).kind === "spot");
  return spot ? String((spot as { refId: unknown }).refId) : undefined;
}

/**
 * [학습 메모] 아래 if 사슬은 "실 LLM 이 내릴 법한 판단"을 흉내 낸 것일 뿐,
 * 진짜 추론이 아니다. 핵심은 wantsQuiet 분기 — 같은 도구 집합이라도 사용자가
 * "한산한"을 원하면 estimate_congestion 을 거치고, 아니면 건너뛴다. 이게 결정형
 * 파이프라인(항상 같은 순서)과 다른 지점이다.
 */
export function heuristicProvider(): LlmProvider {
  return {
    async decide({ request, trace }: LlmDecideInput): Promise<LlmDecision> {
      const { intent } = request;

      // 1) 아직 테마 목록을 안 봤으면 먼저 조회
      if (!called(trace, "list_themes")) {
        return { kind: "tool", tool: { name: "list_themes", args: {} } };
      }

      const themeId = chooseTheme(intent, lastResult(trace, "list_themes"));

      // 2) 코스를 아직 안 받았으면 받는다
      if (themeId && !called(trace, "get_course")) {
        return { kind: "tool", tool: { name: "get_course", args: { themeId } } };
      }

      // 3) "한산함"을 원하면 혼잡도 확인 단계를 추가 (의도에 따른 분기)
      if (wantsQuiet(intent) && !called(trace, "estimate_congestion")) {
        const spotId = firstSpotId(lastResult(trace, "get_course"));
        if (spotId) {
          return { kind: "tool", tool: { name: "estimate_congestion", args: { spotId } } };
        }
      }

      // 4) 종료 — 근거 생성
      const congestion = lastResult(trace, "estimate_congestion") as
        | { level?: string; bestHours?: number[] }
        | undefined;
      const quietNote =
        congestion && Array.isArray(congestion.bestHours) && congestion.bestHours.length > 0
          ? ` 가장 한산한 ${congestion.bestHours[0]}시 전후를 앞에 배치했어요.`
          : "";
      return {
        kind: "final",
        final: {
          primaryThemeId: themeId ?? "",
          altThemeIds: [],
          rationale: L(
            `요청을 "${intent}"로 이해해 ${themeId ?? "기본"} 테마를 골랐어요.${quietNote}`,
            `Interpreted "${intent}" and selected the ${themeId ?? "default"} theme.`,
          ),
        },
      };
    },
  };
}

// ── 3) 코스 정리(itinerary) 데모 대역 ─────────

/** get_course 결과에서 스팟이 있는 날(day) 목록을 오름차순으로 뽑는다. */
function spotDays(courseResult: unknown): number[] {
  const items = (courseResult as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const set = new Set<number>();
  for (const it of items) {
    if ((it as { kind?: unknown }).kind === "spot") set.add(Number((it as { day: unknown }).day));
  }
  return [...set].filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
}

/** trace 에 특정 day 에 대한 reorder 호출이 이미 있었나(중복 방지). */
function reorderedDay(trace: AgentStep[], day: number): boolean {
  return trace.some((s) => s.tool === "reorder_by_congestion" && Number(s.args["day"]) === day);
}

/**
 * 코스 정리 에이전트 대역.
 * [학습 메모] 흐름: get_course 로 코스를 받고 → 스팟이 있는 날마다 reorder_by_congestion 을
 * 호출해(혼잡 최소 재배치) → 끝낸다. "어느 날을 정리할지"는 이 루프(=LLM 자리)가 정하고,
 * 실제 재배치 계산은 reorder_by_congestion 도구(순수함수)가 한다 → 판단은 LLM, 수치는 코드.
 */
export function heuristicItineraryProvider(): LlmProvider {
  return {
    async decide({ request, trace }: LlmDecideInput): Promise<LlmDecision> {
      const themeId = request.themeId ?? "";

      // 1) 코스를 아직 안 받았으면 받는다
      if (!called(trace, "get_course")) {
        return { kind: "tool", tool: { name: "get_course", args: { themeId } } };
      }

      // 2) 스팟이 있는 날마다 한 번씩 재정렬
      const days = spotDays(lastResult(trace, "get_course"));
      for (const day of days) {
        if (!reorderedDay(trace, day)) {
          return { kind: "tool", tool: { name: "reorder_by_congestion", args: { themeId, day } } };
        }
      }

      // 3) 종료 — 재정렬 결과를 요약해 근거 생성
      const changed = trace.filter(
        (s) => s.tool === "reorder_by_congestion" && s.ok && (s.result as { changed?: boolean }).changed,
      ).length;
      const rationale =
        changed > 0
          ? L(
              `현재 혼잡 기준으로 ${changed}개 날의 동선을 더 한산한 시간대로 재배치했어요.`,
              `Reordered ${changed} day(s) to quieter time slots based on current crowding.`,
            )
          : L(
              "현재 혼잡 기준으로 이미 잘 분산돼 있어 기존 순서를 유지했어요.",
              "Already well distributed for current conditions; kept the original order.",
            );
      return { kind: "final", final: { rationale } };
    },
  };
}
