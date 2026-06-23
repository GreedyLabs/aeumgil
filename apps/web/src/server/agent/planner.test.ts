// ─────────────────────────────────────────────
// 에이전트 골격 테스트 — 키·네트워크 불요(mock LLM + mock 포트).
//
// 검증 대상은 "추천 품질"이 아니라 루프 기계의 정확성:
//   · 의도에 따라 도구 호출 경로가 갈리는가 (에이전트의 본질)
//   · 화이트리스트/중복/폴백 가드레일이 동작하는가 (일관성·회복력)
// 추천 품질 평가는 D단계(LLM Evaluation)에서 별도로 다룬다.
// ─────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import { L } from "@/lib/i18n";
import type { Course, Theme } from "@/domain/types";
import { buildTools } from "./tools";
import { heuristicProvider, scriptedProvider } from "./llm";
import { planCourse, type FallbackResult } from "./planner";
import type { LlmDecision, SpotMeta, ToolContext } from "./types";

// ── 픽스처 ───────────────────────────────────

function theme(id: string, mood: string[]): Theme {
  return {
    id,
    title: L(id),
    subtitle: L(""),
    tag: L(id),
    region: L("강원"),
    hue: 200,
    duration: L("2박3일"),
    pace: L("느긋"),
    spotCount: 2,
    mood: mood.map((m) => L(m)),
    blurb: L(""),
  };
}

const SPOTS: SpotMeta[] = [
  { id: "s1", baseline: "busy", env: "beach", lat: 38, lon: 128.5, region: "sokcho" },
  { id: "s2", baseline: "moderate", env: "beach", lat: 37.8, lon: 128.9, region: "gangneung" },
];

const BEACH_COURSE: Course = {
  themeId: "beach",
  title: L("해변 코스"),
  dayCount: 1,
  items: [
    { kind: "spot", day: 1, time: "10:00", refId: "s1" },
    { kind: "spot", day: 1, time: "14:00", refId: "s2" },
  ],
};

function makeCtx(): ToolContext {
  return {
    themes: [theme("beach", ["바다", "힐링"]), theme("mountain", ["산", "숲"])],
    spots: SPOTS,
    async getCourse(id) {
      return id === "beach" ? BEACH_COURSE : null;
    },
    async weather() {
      return { tempC: 22, pop: 10, windMs: 3, pty: 0, desc: L("맑음") };
    },
    async air() {
      return { khaiGrade: 1, grade: L("좋음") };
    },
    async searchPois() {
      return [];
    },
    now() {
      return new Date(2026, 5, 23, 11, 0); // 고정 시각(혼잡 곡선 재현)
    },
  };
}

const FALLBACK: FallbackResult = {
  primaryThemeId: "FB",
  altThemeIds: [],
  rationale: L("키워드 폴백"),
};
const okFallback = async (): Promise<FallbackResult> => FALLBACK;

function toolsOf(trace: { tool: string }[]): string[] {
  return trace.map((s) => s.tool);
}

// ── 1. 의도에 따른 경로 분기 (에이전트의 본질) ──

describe("planCourse — 의도 분기", () => {
  it("'한산한' 의도면 혼잡도 확인 단계를 거친다", async () => {
    const ctx = makeCtx();
    const res = await planCourse(
      { intent: "부모님이랑 안 붐비는 바다", lang: "ko" },
      { llm: heuristicProvider(), tools: buildTools(ctx), fallback: okFallback },
    );

    expect(res.source).toBe("agent");
    expect(["beach", "mountain"]).toContain(res.primaryThemeId);
    expect(toolsOf(res.trace)).toEqual(
      expect.arrayContaining(["list_themes", "get_course", "estimate_congestion"]),
    );
  });

  it("'유명한' 의도면 혼잡도 단계를 건너뛴다 (같은 도구셋, 다른 경로)", async () => {
    const ctx = makeCtx();
    const res = await planCourse(
      { intent: "유명한 바다 명소 위주로", lang: "ko" },
      { llm: heuristicProvider(), tools: buildTools(ctx), fallback: okFallback },
    );

    expect(res.source).toBe("agent");
    expect(toolsOf(res.trace)).toContain("get_course");
    expect(toolsOf(res.trace)).not.toContain("estimate_congestion");
  });
});

// ── 2. 가드레일 ──────────────────────────────

describe("planCourse — 가드레일", () => {
  it("등록되지 않은 도구 호출은 차단하고 계속 진행한다", async () => {
    const ctx = makeCtx();
    const script: LlmDecision[] = [
      { kind: "tool", tool: { name: "frobnicate", args: {} } }, // 헛것
      { kind: "final", final: { primaryThemeId: "beach", altThemeIds: [], rationale: L("끝") } },
    ];
    const res = await planCourse(
      { intent: "x", lang: "ko" },
      { llm: scriptedProvider(script), tools: buildTools(ctx), fallback: okFallback },
    );

    expect(res.source).toBe("agent"); // 차단됐지만 무중단
    const blocked = res.trace.find((s) => s.tool === "frobnicate");
    expect(blocked?.ok).toBe(false);
    expect(blocked?.error).toContain("등록되지 않은");
  });

  it("동일 도구·인자 반복 호출을 차단한다", async () => {
    const ctx = makeCtx();
    const script: LlmDecision[] = [
      { kind: "tool", tool: { name: "list_themes", args: {} } },
      { kind: "tool", tool: { name: "list_themes", args: {} } }, // 중복
      { kind: "final", final: { primaryThemeId: "beach", altThemeIds: [], rationale: L("끝") } },
    ];
    const res = await planCourse(
      { intent: "x", lang: "ko" },
      { llm: scriptedProvider(script), tools: buildTools(ctx), fallback: okFallback },
    );

    const listCalls = res.trace.filter((s) => s.tool === "list_themes");
    expect(listCalls).toHaveLength(2);
    expect(listCalls[0]?.ok).toBe(true);
    expect(listCalls[1]?.ok).toBe(false);
    expect(listCalls[1]?.error).toContain("중복");
  });

  it("LLM 무응답 시 결정형 폴백으로 무중단 복귀한다", async () => {
    const ctx = makeCtx();
    const res = await planCourse(
      { intent: "x", lang: "ko" },
      { llm: scriptedProvider([]), tools: buildTools(ctx), fallback: okFallback }, // 빈 스크립트 → 즉시 throw
    );

    expect(res.source).toBe("fallback");
    expect(res.primaryThemeId).toBe("FB");
  });

  it("MAX_STEPS 를 넘기면 폴백한다", async () => {
    const ctx = makeCtx();
    // 매번 서로 다른(중복 아닌) 유효 도구를 부르지만 final 을 안 내는 LLM
    let n = 0;
    const looping = {
      async decide(): Promise<LlmDecision> {
        return { kind: "tool", tool: { name: "get_weather", args: { spotId: n++ % 2 === 0 ? "s1" : "s2" } } };
      },
    };
    const res = await planCourse(
      { intent: "x", lang: "ko" },
      { llm: looping, tools: buildTools(ctx), fallback: okFallback, maxSteps: 3 },
    );

    expect(res.source).toBe("fallback");
    expect(res.trace.length).toBe(3);
  });
});

// ── 3. 도구 래핑 정상 동작 ───────────────────

describe("buildTools — 래핑", () => {
  it("estimate_congestion 은 도메인 순수함수 결과를 반환한다", async () => {
    const ctx = makeCtx();
    const tool = buildTools(ctx).find((t) => t.name === "estimate_congestion");
    const out = (await tool?.run({ spotId: "s1" })) as { level: string; bestHours: number[] };
    expect(["calm", "moderate", "busy"]).toContain(out.level);
    expect(Array.isArray(out.bestHours)).toBe(true);
  });

  it("존재하지 않는 spotId 는 거부한다", async () => {
    const ctx = makeCtx();
    const tool = buildTools(ctx).find((t) => t.name === "get_weather");
    await expect(tool?.run({ spotId: "nope" })).rejects.toThrow();
  });
});
