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

import { rankCatalogThemes, type MatchableTheme } from "@/domain/matching";
import { env } from "@/lib/env";
import { L } from "@/lib/i18n";
import type { AgentStep, FinalAnswer, LlmDecideInput, LlmDecision, LlmProvider } from "./types";

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

/** 서비스와 실험용 에이전트가 같은 단어·제외 조건을 사용한다. */
function chooseTheme(intent: string, themesResult: unknown): string | undefined {
  if (!Array.isArray(themesResult)) return undefined;
  const themes = themesResult.filter(
    (theme): theme is MatchableTheme =>
      typeof theme?.id === "string" && typeof theme?.title === "string",
  );
  return rankCatalogThemes(intent, themes).primaryId || undefined;
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
      if (themeId && wantsQuiet(intent) && !called(trace, "estimate_congestion")) {
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
          rationale: themeId
            ? L(
                `입력 단어와 연결되는 ${themeId} 테마를 골랐어요.${quietNote}`,
                `Selected ${themeId} using matching words.`,
              )
            : L(
                "일치하는 목적 단어를 찾지 못했어요. 지역이나 활동을 함께 적어 주세요.",
                "Add a town or an activity to find a theme.",
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

function changedReorderCount(trace: AgentStep[]): number {
  return trace.filter(
    (s) =>
      s.tool === "reorder_by_congestion" && s.ok && (s.result as { changed?: boolean }).changed,
  ).length;
}

function alternativeKeyword(themeId: string, intent: string): string {
  const text = `${themeId} ${intent}`;
  if (/sea|beach|sunrise|바다|해변|일출/.test(text)) return "해변";
  if (/market|local|시장|상권|항구/.test(text)) return "시장";
  if (/mountain|trek|산|트레킹|숲/.test(text)) return "산";
  if (/cafe|view|카페|전망/.test(text)) return "카페";
  if (/family|experience|가족|체험/.test(text)) return "체험";
  return "관광";
}

function poiNames(result: unknown): string[] {
  if (!Array.isArray(result)) return [];
  return result
    .map((p) =>
      typeof (p as { name?: unknown }).name === "string" ? (p as { name: string }).name : undefined,
    )
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
}

/**
 * 코스 정리 에이전트 대역.
 * [학습 메모] 흐름: get_course 로 코스를 받고 → 스팟이 있는 날마다 reorder_by_congestion 을
 * 호출해(혼잡 최소 재배치) → 변경이 있으면 search_pois 로 같은 테마 대체 후보를 한 번 찾고
 * 끝낸다. "어느 날을 정리할지/대체 후보가 필요한지"는 이 루프(=LLM 자리)가 정하고,
 * 실제 재배치 계산·POI 조회는 도구가 한다 → 판단은 LLM, 데이터와 수치는 코드.
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

      // 3) 실제 재배치가 발생했다면 대체 후보도 한 번 탐색한다.
      // 혼잡을 시간대로만 풀기 어려운 경우 사용자가 대체지 화면으로 넘어갈 근거가 된다.
      const changed = changedReorderCount(trace);
      if (changed > 0 && !called(trace, "search_pois")) {
        return {
          kind: "tool",
          tool: {
            name: "search_pois",
            args: { keyword: alternativeKeyword(themeId, request.intent) },
          },
        };
      }

      // 4) 종료 — 재정렬/대체 후보 결과를 요약해 근거 생성
      const alternatives = poiNames(lastResult(trace, "search_pois"));
      const altKo =
        alternatives.length > 0 ? ` 대체 후보로 ${alternatives.join(", ")}도 함께 확인했어요.` : "";
      const altEn =
        alternatives.length > 0
          ? ` Also checked alternatives such as ${alternatives.join(", ")}.`
          : "";
      const rationale =
        changed > 0
          ? L(
              `현재 혼잡 기준으로 ${changed}개 날의 동선을 더 한산한 시간대로 재배치했어요.${altKo}`,
              `Reordered ${changed} day(s) to quieter time slots based on current crowding.${altEn}`,
            )
          : L(
              "현재 혼잡 기준으로 이미 잘 분산돼 있어 기존 순서를 유지했어요.",
              "Already well distributed for current conditions; kept the original order.",
            );
      return { kind: "final", final: { rationale } };
    },
  };
}

// ── 4) 실 LLM Provider (OpenAI-compatible Chat Completions) ──

type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "text">>;

interface OpenAiChatProviderOptions {
  /** api.openai.com 은 필수. 로컬 OpenAI-호환 서버(llama.cpp 등)는 키 없이 동작하므로 생략 가능. */
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  /** 호출 1회 상한(ms). 초과 시 throw → planner 폴백. 기본 30초(로컬 소형 모델의 생성 속도 고려). */
  timeoutMs?: number;
  fetcher?: FetchLike;
}

interface ChatToolCall {
  function?: { name?: string; arguments?: string };
}

interface ChatChoice {
  message?: {
    content?: string | null;
    tool_calls?: ChatToolCall[];
  };
}

interface ChatResponse {
  choices?: ChatChoice[];
}

function toolSchema({ name, description, parameters }: LlmDecideInput["tools"][number]) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, p] of Object.entries(parameters)) {
    const schema: Record<string, unknown> =
      p.type === "string[]" ? { type: "array", items: { type: "string" } } : { type: p.type };
    schema.description = p.description;
    if (p.enum) schema.enum = p.enum;
    properties[key] = schema;
    if (p.required) required.push(key);
  }

  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

/**
 * final 텍스트에서 JSON object 를 뽑아낸다.
 *
 * [학습 메모] `response_format: json_object` 를 줘도 순수 JSON 이 보장되지 않는다 —
 * 특히 llama.cpp + 소형 모델(Qwen 계열)은 tools 가 함께 있으면 JSON grammar 를
 * 적용하지 않아, 최종 답 앞에 추론 산문이나 `<think>` 블록을 섞어 낸다(실측: Qwen3.5-4B).
 * 전체 파싱이 실패하면 첫 `{` ~ 마지막 `}` 구간을 한 번 더 시도해, 형식 흔들림이
 * 곧바로 폴백(=에이전트 판단 폐기)으로 이어지는 낭비를 줄인다. 그래도 실패하면
 * throw → planner 가드레일 4(결정형 폴백)가 받는다.
 */
function extractJsonObject(content: string): unknown {
  const stripped = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start < 0 || end <= start)
      throw new Error("LLM final 응답에서 JSON object 를 찾지 못했습니다.");
    return JSON.parse(stripped.slice(start, end + 1));
  }
}

const RATIONALE_MAX_LENGTH = 300;

/**
 * LLM 산출 텍스트 새니타이즈 — 화면 노출 전 정리 (운영-준비-플랜 §6.1).
 * rationale 은 course 화면의 reorderNote 로 그대로 렌더되므로(React 가 HTML 은
 * 이스케이프하지만 레이아웃·문구는 못 지킨다), 제어문자·양방향 제어·개행을 공백으로
 * 접고 길이 상한을 둔다. 사용자 입력이 intent 로 흘러들어 rationale 에 반사될 수
 * 있다는 점(프롬프트 인젝션 반사)도 상한의 근거다.
 */
function sanitizeLlmText(text: string): string {
  const collapsed = text
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return collapsed.length > RATIONALE_MAX_LENGTH
    ? `${collapsed.slice(0, RATIONALE_MAX_LENGTH - 1)}…`
    : collapsed;
}

function parseFinal(content: string | null | undefined): LlmDecision {
  if (!content) throw new Error("LLM final 응답이 비어 있습니다.");
  const parsed = extractJsonObject(content) as Partial<FinalAnswer>;
  if (!parsed.rationale?.ko || !parsed.rationale?.en) {
    throw new Error("LLM final 응답에 rationale.ko/en 이 없습니다.");
  }
  const altThemeIds = Array.isArray(parsed.altThemeIds)
    ? parsed.altThemeIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  return {
    kind: "final",
    final: {
      primaryThemeId: typeof parsed.primaryThemeId === "string" ? parsed.primaryThemeId : undefined,
      altThemeIds,
      rationale: {
        ko: sanitizeLlmText(parsed.rationale.ko),
        en: sanitizeLlmText(parsed.rationale.en),
      },
    },
  };
}

function compactTrace(trace: AgentStep[]) {
  return trace.map((s) => ({
    tool: s.tool,
    args: s.args,
    ok: s.ok,
    error: s.error,
    result: s.ok ? s.result : undefined,
  }));
}

/**
 * 실 LLM Provider.
 *
 * [학습 메모] 여기서도 LLM 에게 전체 권한을 주지 않는다. 모델은 Chat Completions 의
 * tool_calls 로 "다음 도구 이름+인자"만 선택하고, 실제 실행/검증/중복 차단은 planner.ts 가 한다.
 * 즉 실 LLM 은 heuristicProvider 를 대체하는 "판단 엔진"일 뿐, 시스템 경계는 그대로다.
 */
export function openAiChatProvider(options: OpenAiChatProviderOptions): LlmProvider {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = options.model ?? "gpt-4o-mini";
  const timeoutMs = options.timeoutMs ?? 30_000;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;

  return {
    async decide(input: LlmDecideInput): Promise<LlmDecision> {
      const res = await fetcher(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        // 타임아웃 초과 시 여기서 throw → planner 가 결정형 폴백으로 복귀(무한 대기 차단).
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          tools: input.tools.map(toolSchema),
          tool_choice: "auto",
          messages: [
            {
              role: "system",
              content: [
                "너는 에움길 강원 관광 추천 에이전트의 planner다.",
                "반드시 제공된 도구만 호출한다.",
                "도구가 더 필요하면 tool_calls 를 사용한다.",
                "충분하면 JSON object 로만 최종 답을 낸다.",
                '최종 JSON 형식: {"primaryThemeId":"optional","altThemeIds":[],"rationale":{"ko":"...","en":"..."}}',
                "테마/스팟/코스 id 는 도구 결과에 있는 값만 사용한다.",
              ].join("\n"),
            },
            {
              role: "user",
              content: JSON.stringify({
                request: input.request,
                trace: compactTrace(input.trace),
                availableTools: input.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                })),
              }),
            },
          ],
        }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`LLM 호출 실패(${res.status}): ${text.slice(0, 240)}`);

      const data = JSON.parse(text) as ChatResponse;
      const msg = data.choices?.[0]?.message;
      const call = msg?.tool_calls?.[0];
      const name = call?.function?.name;
      if (name) {
        return { kind: "tool", tool: { name, args: parseArgs(call.function?.arguments) } };
      }
      return parseFinal(msg?.content);
    },
  };
}

/**
 * env 로 실 LLM provider 를 만든다. 조건 미충족이면 null(→ 호출부가 heuristic 유지).
 *
 * 키 규칙: `OPENAI_BASE_URL` 이 지정된 로컬/사설 OpenAI-호환 서버(llama.cpp·vLLM 등)는
 * 키 없이 허용하고, 기본 endpoint(api.openai.com)는 키를 요구한다.
 */
export function openAiProviderFromEnv(): LlmProvider | null {
  if (env.EUMGIL_AGENT_LLM !== "openai") return null;
  if (!env.OPENAI_API_KEY && !env.OPENAI_BASE_URL) return null;
  return openAiChatProvider({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    baseUrl: env.OPENAI_BASE_URL,
    timeoutMs: env.OPENAI_TIMEOUT_MS,
  });
}

/** env 로 실 LLM 을 선택한다. 미설정이면 기존 heuristic 을 유지한다. */
export function courseProviderFromEnv(): LlmProvider {
  return openAiProviderFromEnv() ?? heuristicProvider();
}

/** 코스 정리용 provider 선택. 현재는 같은 OpenAI provider 를 쓰고, 미설정이면 heuristic. */
export function itineraryProviderFromEnv(): LlmProvider {
  return openAiProviderFromEnv() ?? heuristicItineraryProvider();
}
