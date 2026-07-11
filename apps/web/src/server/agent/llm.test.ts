import { describe, expect, it } from "vitest";
import { L } from "@/lib/i18n";
import { heuristicItineraryProvider, openAiChatProvider } from "./llm";
import type { AgentStep, LlmDecideInput, ToolSpec } from "./types";

const tools: ToolSpec[] = [
  {
    name: "list_themes",
    description: "테마 목록 조회",
    origin: "domain",
    parameters: {},
    async run() {
      return [];
    },
  },
  {
    name: "get_course",
    description: "코스 조회",
    origin: "domain",
    parameters: {
      themeId: { type: "string", required: true, description: "테마 id", enum: ["quiet-inland"] },
    },
    async run() {
      return null;
    },
  },
];

const input: LlmDecideInput = {
  request: { intent: "조용한 내륙 여행", lang: "ko" },
  tools,
  trace: [],
};

function response(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

describe("openAiChatProvider", () => {
  it("tool_calls 를 LlmDecision tool 로 변환한다", async () => {
    const provider = openAiChatProvider({
      apiKey: "test",
      fetcher: async () =>
        response({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "get_course",
                      arguments: JSON.stringify({ themeId: "quiet-inland" }),
                    },
                  },
                ],
              },
            },
          ],
        }),
    });

    await expect(provider.decide(input)).resolves.toEqual({
      kind: "tool",
      tool: { name: "get_course", args: { themeId: "quiet-inland" } },
    });
  });

  it("JSON final 응답을 LlmDecision final 로 변환한다", async () => {
    const final = {
      primaryThemeId: "quiet-inland",
      altThemeIds: ["east-sea-sunrise"],
      rationale: L("조용한 내륙 테마를 골랐어요.", "Selected a quiet inland theme."),
    };
    const provider = openAiChatProvider({
      apiKey: "test",
      fetcher: async () => response({ choices: [{ message: { content: JSON.stringify(final) } }] }),
    });

    await expect(provider.decide(input)).resolves.toEqual({ kind: "final", final });
  });

  it("LLM HTTP 실패는 에러로 올려 planner 폴백 대상이 되게 한다", async () => {
    const provider = openAiChatProvider({
      apiKey: "test",
      fetcher: async () => response({ error: "bad key" }, false, 401),
    });

    await expect(provider.decide(input)).rejects.toThrow("LLM 호출 실패(401)");
  });

  // 로컬 소형 모델(llama.cpp+Qwen)은 json_object 를 줘도 JSON 앞뒤에 산문을 섞는다.
  it("final JSON 앞에 산문이 섞여도 JSON 을 추출한다", async () => {
    const final = {
      primaryThemeId: "east-sea-sunrise",
      altThemeIds: [],
      rationale: L("바다 테마를 골랐어요.", "Selected the sea theme."),
    };
    const provider = openAiChatProvider({
      fetcher: async () =>
        response({
          choices: [
            { message: { content: `요청을 분석한 결과는 다음과 같습니다.\n\n${JSON.stringify(final)}` } },
          ],
        }),
    });

    await expect(provider.decide(input)).resolves.toEqual({ kind: "final", final });
  });

  it("<think> 블록이 섞인 final 응답도 파싱한다", async () => {
    const final = {
      primaryThemeId: "quiet-inland",
      altThemeIds: [],
      rationale: L("조용한 내륙.", "Quiet inland."),
    };
    const provider = openAiChatProvider({
      fetcher: async () =>
        response({
          choices: [
            { message: { content: `<think>{테마 후보를 비교}…</think>${JSON.stringify(final)}` } },
          ],
        }),
    });

    await expect(provider.decide(input)).resolves.toEqual({ kind: "final", final });
  });

  // rationale 은 course 화면 reorderNote 로 노출된다(§6.1) — 개행·제어문자·길이 방어.
  it("final rationale 의 개행·제어문자를 접고 길이를 300자로 제한한다", async () => {
    const provider = openAiChatProvider({
      fetcher: async () =>
        response({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  primaryThemeId: "quiet-inland",
                  altThemeIds: [],
                  rationale: {
                    ko: `첫 줄\n\n둘째 줄\t탭\u0000제어${"가".repeat(400)}`,
                    en: "ok",
                  },
                }),
              },
            },
          ],
        }),
    });

    const decision = await provider.decide(input);
    expect(decision.kind).toBe("final");
    if (decision.kind === "final") {
      const ko = decision.final.rationale.ko;
      expect(ko).not.toMatch(/[\n\t]/);
      expect(ko.startsWith("첫 줄 둘째 줄 탭 제어")).toBe(true);
      expect(ko.length).toBeLessThanOrEqual(300);
      expect(ko.endsWith("…")).toBe(true);
    }
  });

  it("apiKey 가 없으면 authorization 헤더를 보내지 않는다(로컬 서버)", async () => {
    let sentHeaders: Record<string, string> | undefined;
    const provider = openAiChatProvider({
      baseUrl: "http://127.0.0.1:8080/v1",
      fetcher: async (_url, init) => {
        sentHeaders = init.headers as Record<string, string>;
        return response({
          choices: [{ message: { tool_calls: [{ function: { name: "list_themes", arguments: "{}" } }] } }],
        });
      },
    });

    await provider.decide(input);
    expect(sentHeaders).toBeDefined();
    expect(sentHeaders).not.toHaveProperty("authorization");
  });
});

describe("heuristicItineraryProvider", () => {
  const itineraryInput = (trace: AgentStep[]): LlmDecideInput => ({
    request: {
      intent: "테마 east-sea-sunrise 코스를 현재 혼잡 기준으로 정리",
      lang: "ko",
      themeId: "east-sea-sunrise",
    },
    tools: [],
    trace,
  });

  it("재정렬 변경이 있으면 같은 테마 대체 POI 탐색을 요청한다", async () => {
    const provider = heuristicItineraryProvider();
    const trace: AgentStep[] = [
      {
        tool: "get_course",
        args: { themeId: "east-sea-sunrise" },
        ok: true,
        result: { items: [{ kind: "spot", day: 1, time: "10:00", refId: "anmok-beach" }] },
        ms: 1,
      },
      {
        tool: "reorder_by_congestion",
        args: { themeId: "east-sea-sunrise", day: 1 },
        ok: true,
        result: { day: 1, changed: true, order: [{ refId: "anmok-beach", time: "09:00" }] },
        ms: 1,
      },
    ];

    await expect(provider.decide(itineraryInput(trace))).resolves.toEqual({
      kind: "tool",
      tool: { name: "search_pois", args: { keyword: "해변" } },
    });
  });

  it("대체 POI 탐색 후 최종 근거에 후보명을 포함한다", async () => {
    const provider = heuristicItineraryProvider();
    const trace: AgentStep[] = [
      {
        tool: "get_course",
        args: { themeId: "east-sea-sunrise" },
        ok: true,
        result: { items: [{ kind: "spot", day: 1, time: "10:00", refId: "anmok-beach" }] },
        ms: 1,
      },
      {
        tool: "reorder_by_congestion",
        args: { themeId: "east-sea-sunrise", day: 1 },
        ok: true,
        result: { day: 1, changed: true, order: [{ refId: "anmok-beach", time: "09:00" }] },
        ms: 1,
      },
      {
        tool: "search_pois",
        args: { keyword: "해변" },
        ok: true,
        result: [
          { id: "1", name: "사천진해변" },
          { id: "2", name: "영진해변" },
        ],
        ms: 1,
      },
    ];

    const decision = await provider.decide(itineraryInput(trace));

    expect(decision.kind).toBe("final");
    if (decision.kind === "final") {
      expect(decision.final.rationale.ko).toContain("사천진해변");
      expect(decision.final.rationale.ko).toContain("영진해변");
    }
  });
});
