# 검증 가능한 AI 워크플로우 — 프로젝트 문제 후보 (에움길 기반)

7주(실제 6주 진행) "검증 가능한 AI 워크플로우 설계와 최적화" 과정의 **개인 프로젝트 문제 후보** 정리 문서.
Week 1에서 이 중 1개를 선정한다. 각 후보 문서는 그 자체로 Week 1 산출물(문제 정의서 초안)이 되도록 작성했다.

## 이 문서군의 출발점

에움길에는 이미 **Multi-step Tool-Calling 에이전트 + 프로바이더 무관 Evaluation 하네스**가 TypeScript로 구현돼 있다.

- 에이전트: [apps/web/src/server/agent/](../../apps/web/src/server/agent/) — 도구 8종([tools.ts](../../apps/web/src/server/agent/tools.ts)), ReAct 루프 + 4겹 가드레일([planner.ts](../../apps/web/src/server/agent/planner.ts))
- 평가: [apps/web/src/server/agent/eval/](../../apps/web/src/server/agent/eval/) — 룰브릭 채점기([scorers.ts](../../apps/web/src/server/agent/eval/scorers.ts)), 데이터셋([dataset.ts](../../apps/web/src/server/agent/eval/dataset.ts))
- 실 LLM: 로컬 llama.cpp Qwen(OpenAI-호환), `EUMGIL_AGENT_LLM` env로 heuristic↔real 전환

따라서 과제는 "0에서 시작"이 아니라 **기존 자산을 과정의 검증 프레임(schema·baseline·judge·trace·CI)에 맞춰 정식화**하는 작업이다.

## 커리큘럼과 언어 불일치 — 해소 전략

| 항목 | 커리큘럼 공통 도구 | 에움길 현황 | 다리 |
|---|---|---|---|
| 언어/런타임 | Python / uv | TypeScript / Node | eval 하네스만 Python으로 신규 작성 |
| LLM 호출 | LiteLLM | OpenAI-호환 로컬 Qwen | **LiteLLM이 OpenAI-호환** → 같은 엔드포인트 재사용 |
| 스키마 | Pydantic | TS 타입([types.ts](../../apps/web/src/server/agent/types.ts)) | TS 타입 → Pydantic 포팅(도구 스키마·결과) |
| 채점 | DeepEval | 자체 룰브릭([scorers.ts](../../apps/web/src/server/agent/eval/scorers.ts)) | 룰브릭 규칙을 DeepEval metric으로 이식 |
| CI | pytest / GitHub Actions | GitHub Actions 보유 | 워크플로우에 eval job 추가 |

핵심: **문제·프롬프트·도구 정의·데이터셋은 TS 자산에서 가져오고, 평가 파이프라인만 Python으로 새로 짠다.** 도구를 Pydantic으로 다시 정의하는 것 자체가 "행동 공간을 스키마로 좁힌다"는 학습 포인트가 된다.

## 후보 비교

| 후보 | 한 줄 정의 | Week5(도구) | Week3(Judge) | Week4(프롬프트) | 데이터셋 난이도 | 종합 |
|---|---|---|---|---|---|---|
| [후보 1](후보1-도구사용-코스플래닝.md) | 자연어 여행 의도 → 도구 호출 순서 판단으로 코스 계획 | ◎ 커리큘럼이 지목 | ○ rationale 채점 | ◎ ReAct 프롬프트 ablation | 중 | **메인 추천** |
| [후보 2](후보2-분류검토-테마매칭.md) | 자연어 의도 → 테마 분류(+ 저품질/위험 입력 검토) | △ 트레이스 빈약 | △ 정답라벨로 충분 | ○ | 하(가장 쉬움) | 백업 |
| [후보 3](후보3-답변보류-폴백.md) | 근거 부족·API 실패 시 결정형 폴백/사람에게 보류 | △ 단독은 얇음 | ○ | ○ | 중 | 후보1의 평가축으로 편입 권장 |

## 추천

**후보 1(도구 사용 · 코스 플래닝)을 메인으로 선정.** 근거:

1. **Week 5가 이 후보를 그대로 서술한다.** "Tool calling / trace / final state / tool trace 권한 / 중복 호출 평가"가 플래너의 trace·화이트리스트·중복차단과 1:1로 대응하며, 채점기 `traceHealth`·`constraintAdherence`가 이미 존재한다.
2. **6주 아크를 빠짐없이 채운다.** Week2(heuristic vs 실모델 2종 비교), Week3(rationale 설득력 judge), Week4(ReAct 프롬프트 ablation), Week5(도구 트레이스), Week6(CI eval) 모두 자연스럽다.
3. **검증 가능성이 이미 실증돼 있다.** 비결정적 에이전트를 고정 데이터셋 + 룰브릭으로 채점하는 구조가 돌아가고 있어, "verifiable"을 6주 안에 심화하기 가장 쉽다.

**후보 2**는 Week1~4는 가장 깔끔하지만 Week5(tool calling) 한 주를 못 살린다 → 난이도를 낮추고 싶을 때의 백업.
**후보 3**은 단독 워크플로우로는 얇다 → 후보 1의 "성공/실패 기준(폴백률·보류 정확도)"으로 흡수하는 것을 권장하되, 독립 제출용으로도 정리해 둔다.

## 공통 리스크 (전 후보 해당)

- **재현성**: 실시간 API(날씨/대기질/혼잡)는 값이 변한다 → eval에서는 응답을 **fixture로 고정**해 채점해야 한다. (에움길 mock ToolContext가 이미 이 역할을 한다.)
- **2+ 모델 비교(Week2)**: 로컬 4B 하나로는 부족 → 다른 로컬 모델 또는 클라우드 모델을 최소 1종 더 확보해야 한다.
- **egress 제약**: data.go.kr 실호출은 로컬에서만 가능 → CI/eval은 mock/fixture 경로로 돌린다.
