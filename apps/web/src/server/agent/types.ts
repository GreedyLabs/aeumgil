// ─────────────────────────────────────────────
// 에이전트 레이어 — 공통 타입 (서버 전용)
//
// 설계: docs/에이전트-레이어-설계.md
// 이 파일은 "결정형 파이프라인 → Multi-step Tool-Calling 에이전트" 전환의
// 계약(인터페이스)만 정의한다. 실제 LLM·실제 API 없이도 mock 으로 전 구조가 돈다.
//
// [학습 메모] 에이전트가 결정형과 다른 핵심은 "도구를 언제·어떤 순서로 쓸지를
// 코드가 아니라 LLM 이 정한다"는 점. 그래서 여기서 정의하는 건 (1) LLM 이 고를 수
// 있는 도구의 목록·스키마(ToolSpec), (2) LLM 의 매 스텝 결정(LlmDecision),
// (3) 그 결정들이 쌓인 실행 기록(AgentStep) — 이 세 가지다.
// ─────────────────────────────────────────────

import type { Lang, LocalizedText } from "@/lib/i18n";
import type { Congestion, Course, Theme } from "@/domain/types";
import type { EnvKind } from "@/domain/scoring";

// ── 요청 / 결과 ──────────────────────────────

export interface PlanRequest {
  /** 사용자 자연어 입력 (예: "부모님이랑 안 붐비는 바다") */
  intent: string;
  lang: Lang;
  /** 방문 기준 시각 (없으면 ctx.now()) */
  at?: Date;
  /** 코스 정리(planItinerary) 모드에서 대상 테마 id */
  themeId?: string;
}

export interface PlanResult {
  primaryThemeId: string;
  altThemeIds: string[];
  /** 재정렬·대체가 반영된 코스 (에이전트가 get_course 까지 갔을 때) */
  course?: Course;
  /** 추천 근거 — LLM 이 생성하거나 폴백이 채운다 */
  rationale: LocalizedText;
  /** 단계별 도구 호출 기록 — LLM Evaluation·운영 디버깅의 입력 */
  trace: AgentStep[];
  /**
   * 이 결과를 누가 만들었나.
   *  - "agent"    : LLM 루프가 정상 종료
   *  - "fallback" : 에이전트 실패 → 결정형(키워드) 로직으로 무중단 폴백
   * 운영 가시성을 위해 항상 노출한다(에이전트 신뢰도 모니터링 지표).
   */
  source: "agent" | "fallback";
}

// ── 실행 기록 ────────────────────────────────

/** 도구 1회 호출의 결과 기록. trace 의 한 원소. */
export interface AgentStep {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  /** 성공 시 도구 반환값 */
  result?: unknown;
  /** 실패 시 사유 (가드레일 차단 포함) */
  error?: string;
  ms: number;
}

// ── 도구 정의 (Tool Catalog) ─────────────────

/**
 * 도구 파라미터 스키마(경량 JSON-Schema).
 * [학습 메모] `enum` 으로 선택지를 우리 데이터로 못 박는 게 "행동 공간을 좁혀
 * 일관성을 확보"하는 핵심 장치다. LLM 이 존재하지 않는 스팟 id 를 지어낼 수 없다.
 */
export interface ToolParam {
  type: "string" | "number" | "boolean" | "string[]";
  description: string;
  required?: boolean;
  /** 허용 값 화이트리스트 (헛것 방지) */
  enum?: string[];
}

/**
 * 도구 1종. 기존 순수 함수/공공 API 클라이언트를 LLM 이 부를 수 있게 감싼 것.
 * 새 비즈니스 로직을 만들지 않는다 — 노출 방식만 바꾼다.
 */
export interface ToolSpec {
  name: string;
  /** LLM 에게 전달되는 한 줄 설명(프롬프트 엔지니어링 영역) */
  description: string;
  parameters: Record<string, ToolParam>;
  /**
   * 출처. "server" 도구는 외부 egress(data.go.kr) 가 필요 → 샌드박스에서는
   * mock ToolContext 로 자동 대체된다.
   */
  origin: "domain" | "server";
  /** 실행기 — ctx 는 buildTools 가 클로저로 주입하므로 args 만 받는다. */
  run(args: Record<string, unknown>): Promise<unknown>;
}

// ── 도구 실행 컨텍스트(포트) ──────────────────
//
// 도구가 데이터·API 에 닿는 통로. A단계(골격)에서는 테스트가 mock 을 주입하고,
// B단계(배선)에서 Repository + server/public-api 실구현으로 갈아끼운다.
// 도구 코드는 이 포트만 보므로 배선 교체에 영향받지 않는다(Repository 패턴과 동형).

export interface SpotMeta {
  id: string;
  /** 큐레이션 인기 prior */
  baseline: Congestion;
  env: EnvKind;
  lat: number;
  lon: number;
  /** 에어코리아 권역 키 */
  region: string;
}

export interface WeatherSample {
  tempC: number;
  pop: number;
  windMs: number;
  pty: number;
  desc: LocalizedText;
}

export interface AirSample {
  khaiGrade: number;
  grade: LocalizedText;
}

export interface PoiSample {
  id: string;
  name: LocalizedText;
}

export interface ToolContext {
  themes: Theme[];
  spots: SpotMeta[];
  getCourse(themeId: string): Promise<Course | null>;
  /** server 도구 — 샌드박스에선 mock */
  weather(meta: SpotMeta): Promise<WeatherSample>;
  air(region: string): Promise<AirSample>;
  searchPois(keyword: string): Promise<PoiSample[]>;
  /** 평가 기준 시각 */
  now(): Date;
}

// ── LLM 추상화 ───────────────────────────────
//
// [학습 메모] LLM 을 인터페이스 뒤에 숨기면 키 없이도 전 구조를 테스트할 수 있다.
//  - MockLlmProvider : 키·네트워크 불요(결정적). 개발·CI 비용 0.
//  - RealLlmProvider : 키 있을 때만(로컬). C단계에서 추가.
// Repository 의 mock↔live 전환과 똑같은 발상.

/**
 * LLM 의 최종 답.
 * - 테마 선택(planCourse) 모드: primaryThemeId/altThemeIds 사용.
 * - 코스 정리(planItinerary) 모드: rationale 만 사용(코스는 trace 의 reorder 결과로 조립).
 */
export interface FinalAnswer {
  primaryThemeId?: string;
  altThemeIds?: string[];
  rationale: LocalizedText;
}

/** LLM 의 매 스텝 결정: 도구를 더 부르거나(tool), 끝내거나(final). */
export type LlmDecision =
  | { kind: "tool"; tool: { name: string; args: Record<string, unknown> } }
  | { kind: "final"; final: FinalAnswer };

export interface LlmDecideInput {
  request: PlanRequest;
  /** 부를 수 있는 도구(이름·스키마) — LLM 의 행동 공간 */
  tools: ToolSpec[];
  /** 지금까지의 실행 기록 — 다음 결정의 근거 */
  trace: AgentStep[];
}

export interface LlmProvider {
  decide(input: LlmDecideInput): Promise<LlmDecision>;
}
