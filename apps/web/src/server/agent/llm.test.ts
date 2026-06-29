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
