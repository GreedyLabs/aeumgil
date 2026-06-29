# 결정형 코드를 AI 에이전트로 전환하기: Tool-Calling ReAct 루프와 4겹 가드레일

서비스 추천 로직을 AI 에이전트로 바꾸고 싶을 때, 가장 먼저 부딪히는 질문은 "어디까지 에이전트에게 맡겨야 하는가"입니다. 에움길에서는 관광지 추천과 코스 정렬을 담당하던 결정형 파이프라인을 Multi-step Tool-Calling 에이전트로 전환하면서, 기존 화면과 Repository 인터페이스를 전혀 건드리지 않는 방식을 택했습니다. 이 글은 그 설계와 구현 과정을 정리한 기록입니다. 결정형 로직 위에 에이전트 레이어를 얹으려는 분들께 참고가 되었으면 합니다.

처음 코드는 모두 순서가 고정된 함수 호출이었습니다. 사용자의 자연어 입력이 들어오면 키워드 규칙으로 테마를 고르고(`matchThemes`), 날씨→대기질→혼잡→적합성 순서로 보강하고, 마지막에 혼잡 기준으로 코스를 재정렬했습니다. 이 순서는 코드에 박혀 있어서, "안 붐비는 곳을 원한다"는 사용자와 "유명한 곳이면 붐벼도 좋다"는 사용자에게 똑같은 경로를 밟았습니다. 의도에 따라 경로가 달라져야 하는데 그럴 수 없었습니다.

이 글은 그 고정 파이프라인을 LLM이 매 스텝 "다음에 뭘 할지"를 결정하는 에이전트로 바꾼 과정입니다.

## 에이전트가 아닌 것과 에이전트인 것

결정형 파이프라인과 에이전트의 차이를 한 줄로 표현하면 이렇습니다. **결정형은 "무엇을 어떤 순서로 호출할지"를 코드가 정한다. 에이전트는 LLM이 정한다.**

동일한 도구들을 가지고 있어도, 에이전트는 사용자 의도를 읽어서 필요한 도구만 필요한 순서로 호출합니다. "안 붐비는 곳" 요청에는 혼잡 추정 도구를 여러 번 쓰지만, "유명한 곳" 요청에는 건너뜁니다. 이 분기가 if문이 아니라 LLM의 판단에서 나온다는 것이 핵심 차이입니다.

## 레이어를 Repository 아래에 숨기기

에움길의 불변식은 "화면은 `getRepository()` 인터페이스만 본다"입니다. 에이전트를 추가하면서 이 불변식을 깨면, 화면 컴포넌트 17개를 모두 손봐야 합니다. 그 대신 에이전트를 Repository **내부**에 숨겼습니다.

```
화면(Server Component)
      │  getRepository() — 시그니처 불변
      ▼
LiveRepository
  matchThemes / getCourse ← 여기서 에이전트 호출 + 결정형 폴백
      │
      ▼
Agent Layer (server/agent/)
  Planner: LLM ReAct 루프
  Tools: 기존 함수 8종을 JSON Schema로 래핑
  LlmProvider: mock↔real 주입
```

`matchThemes`와 `getCourse`의 시그니처는 그대로입니다. 내부 구현만 에이전트를 먼저 시도하고, 실패하면 기존 결정형 로직으로 폴백하도록 바뀌었습니다.

## 도구 카탈로그: 재구현이 아닌 래핑

에이전트가 호출할 수 있는 도구 8종은 모두 **이미 존재하는 함수**를 LLM이 이해할 수 있는 JSON Schema로 감싼 것입니다. 새로운 비즈니스 로직을 만들지 않았습니다.

| 도구 | 래핑 대상 |
|---|---|
| `list_themes` | `Repository.listThemes` |
| `get_course` | `Repository.getCourse` |
| `search_pois` | TourAPI `listGangwonItems` |
| `get_weather` | 기상청 `getWeatherByCoords` |
| `get_air_quality` | 에어코리아 `getAirForStation` |
| `estimate_congestion` | `estimateCongestion` 순수함수 |
| `score_suitability` | `scoreSuitability` 순수함수 |
| `reorder_by_congestion` | `reorderSpotsByCongestion` 순수함수 |

순수 함수 도구들(혼잡·적합성·재정렬)은 외부 API 호출이 없어서 에이전트 루프를 네트워크 없이 테스트할 때 그대로 사용할 수 있습니다. API 도구는 샌드박스에서 mock으로 대체합니다.

## 핵심 루프: runAgentLoop

루프는 LLM에게 "다음에 뭘 할래?"를 묻고, 도구 호출이면 실행해서 결과를 컨텍스트에 추가하고, 최종 답이면 종료합니다.

```ts
async function runAgentLoop(request, llm, tools, maxSteps): Promise<LoopOutcome> {
  const trace: AgentStep[] = [];
  const seen = new Set<string>();

  while (trace.length < maxSteps) {
    const decision = await llm.decide({ request, tools, trace });

    if (decision.kind === "final") return { trace, final: decision.final };

    const { name, args } = decision.tool;

    // 가드레일 1: 화이트리스트
    const spec = byName.get(name);
    if (!spec) { trace.push({ ...error }); continue; }

    // 가드레일 2: 동일 호출 중복 차단
    const key = `${name}:${JSON.stringify(args)}`;
    if (seen.has(key)) { trace.push({ ...error }); continue; }
    seen.add(key);

    // 도구 실행 — 실패해도 루프는 계속
    try {
      const result = await spec.run(args);
      trace.push({ tool: name, args, ok: true, result, ms });
    } catch (e) {
      trace.push({ tool: name, args, ok: false, error, ms });
    }
  }

  return { trace, failure: "MAX_STEPS 초과" };  // 가드레일 3
}
```

## 비결정성을 길들이는 4겹 가드레일

LLM 기반 시스템의 가장 큰 위험은 예측 불가능한 동작입니다. 4겹 방어를 뒀습니다.

**1겹 — 화이트리스트**: 등록된 도구 이름 목록 밖의 호출은 즉시 거부합니다. LLM이 없는 도구를 지어내도 실행되지 않습니다.

**2겹 — 중복 차단**: 같은 도구·같은 인자 조합을 두 번 부르면 두 번째는 막습니다. 무한 루프와 비용 낭비를 막기 위해서입니다.

**3겹 — MAX_STEPS**: 스텝 수 상한(기본 8회). 초과하면 루프를 끝내고 폴백으로 넘어갑니다.

**4겹 — 결정형 폴백**: 루프가 어떤 이유로든 실패하면(LLM 오류, MAX_STEPS 초과, 도구 전부 실패) 기존 키워드 매칭과 결정형 재정렬이 반드시 결과를 돌려줍니다. 화면에서 오류 페이지가 뜨지 않습니다.

이 중 폴백이 가장 중요합니다. 에이전트는 개선을 위한 것이지, 서비스의 전제 조건이 되면 안 됩니다.

## 판단은 LLM, 수치는 코드

한 가지 원칙을 지켰습니다. **"어떤 스팟을 어떤 순서로 볼지"는 LLM이 결정하지만, "그 시각의 혼잡 지수가 얼마인지"는 순수 함수가 계산합니다.** LLM에게 숫자 계산을 맡기지 않았습니다.

코스 재정렬 루프(`planItinerary`)에서 LLM은 `reorder_by_congestion` 도구를 날짜별로 호출하는 오케스트레이션을 담당합니다. 도구 내부의 순열 탐색과 혼잡 지수 계산은 `reorderSpotsByCongestion` 순수 함수가 합니다. LLM이 반환한 trace에서 재정렬 결과를 추출해 원본 코스에 반영하는 것(`assemble`)도 코드입니다.

## 키 없이 시작하는 전략

LLM API 키 없이도 에이전트 루프를 테스트할 수 있도록 `LlmProvider`를 인터페이스로 뒀습니다.

```ts
interface LlmProvider {
  decide(ctx: DecideContext): Promise<Decision>;
}
```

`scriptedProvider`는 미리 짜둔 시나리오 스크립트대로 결정을 내놓는 mock입니다. `heuristicProvider`는 trace를 보고 규칙 기반으로 다음 도구를 선택합니다. 실제 LLM을 연결하는 `RealLlmProvider`는 C단계에서 교체합니다. Repository의 mock↔live 패턴을 그대로 재사용한 덕분에, 기존 테스트 전략과 일관됩니다.

## 마치며

결정형 로직 위에 에이전트를 얹으면서 가장 조심한 것은 "에이전트가 없어도 서비스가 돌아가야 한다"는 원칙이었습니다.

교훈을 정리하면 이렇습니다. 첫째, 에이전트를 기존 인터페이스 안에 숨기면 화면 변경 없이 점진적으로 전환할 수 있습니다. 기존 코드를 다 뜯어고치는 빅뱅 전환은 위험하고, Repository 내부에서 폴백을 두는 방식이 훨씬 안전합니다. 둘째, 가드레일 없는 에이전트는 프로덕션에 두기 어렵습니다. 화이트리스트·중복 차단·스텝 상한·결정형 폴백 네 겹을 함께 갖춰야 LLM의 비결정성을 안전하게 다룰 수 있습니다. 셋째, "판단은 LLM, 수치는 코드"라는 분업이 일관성을 지킵니다. 수치 계산을 LLM에 맡기면 동일한 입력에서도 결과가 달라질 수 있고, 디버깅도 어렵습니다.

같은 길을 가시는 분들이 비슷한 고민에서 시간을 덜 쓰셨으면 하는 마음으로 정리했습니다. 궁금한 점이나 더 나은 방법이 있으면 편하게 알려주세요.

---

## Excerpt

결정형 파이프라인을 Multi-step Tool-Calling 에이전트로 전환하면서 기존 인터페이스를 유지하고, 4겹 가드레일로 비결정성을 길들인 과정을 정리했습니다.
