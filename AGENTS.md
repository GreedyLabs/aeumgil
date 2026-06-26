# AGENTS.md

에움길(Eumgil) 작업 시 참고할 프로젝트 컨텍스트. 새 세션에서도 이 파일을 먼저 읽고 시작.

## 서비스 개요

- **에움길** — 강원도 특화 테마 관광 추천 서비스 (관광데이터 공모전 출품작).
- 여행 목적을 **자연어로 입력 → 강원도 특화 테마 매칭 → 혼잡도·방문 적합성 기반 코스/대체지 추천**.
- **제출 형태: 전체 실연동 · 실제 운영 서비스** (mock 시연 아님). 7종 공공 API 모두 실제 연동 + DB + 소셜 인증까지 목표.
- 기획 상세: [docs/제안서.md](docs/제안서.md)

## 기술 스택

- pnpm workspaces 모노레포 · Next.js 15 (App Router) · React 19 · TypeScript(strict, `noUncheckedIndexedAccess`) · Tailwind v4
- 앱: `apps/web` (`@eumgil/web`) / 공용 UI: `packages/ui` (`@eumgil/ui`)

## 명령어

```bash
pnpm dev                              # 개발 서버 (localhost:3000)
pnpm build                            # 프로덕션 빌드
pnpm typecheck                        # 타입 검사 (pnpm -r)
pnpm --filter @eumgil/web verify:api  # 공공 API 키 연결 검증 (.env 필요)
```

## 핵심 아키텍처 (가장 중요)

전체 화면이 **데이터 출처를 모른 채 `getRepository()` 인터페이스만 호출**한다. mock↔실데이터를
화면 수정 없이 갈아끼우는 것이 이 설계의 목표.

- **도메인 모델**: [apps/web/src/domain/types.ts](apps/web/src/domain/types.ts) — `Theme/Spot/Course/Eat/Stay/User/Review/Visit` 등. 모든 다국어 텍스트는 `LocalizedText {ko,en}`.
- **Repository 인터페이스**: [apps/web/src/domain/repository.ts](apps/web/src/domain/repository.ts) — 모든 메서드 `async`.
- **팩토리**: [apps/web/src/data/index.ts](apps/web/src/data/index.ts) — `getRepository()`. `DATA_SOURCE` 환경변수로 `mock`(기본)↔`live` 전환. **live 는 아직 미구현(mock 폴백)**.
- **mock 구현**: [apps/web/src/data/mock/repository.ts](apps/web/src/data/mock/repository.ts) — `design/data.ts`(@ts-nocheck)를 도메인 타입으로 정규화. **`DATA` 직접 읽기는 여기서만 존재.**
- **자연어 매칭**: [apps/web/src/domain/matching.ts](apps/web/src/domain/matching.ts) — 키워드 규칙 순수 함수. (확정: 키워드 우선, 후반에 LLM 검토)

### 화면 / 라우팅

- App Router 17개 라우트. **서버 `page.tsx` 가 `getRepository()`로 데이터 페치 → 도메인 타입 props → 클라이언트 뷰** 렌더.
- 화면 뷰: [apps/web/src/components/screens/](apps/web/src/components/screens/) — `home/matching/theme-result/course/spot/alternatives/discover/map/saved/profile/profile-edit/reviews/settings/doc/login/onboarding`.
- 전역 상태/크롬(Sidebar·TabBar·Toast): [apps/web/src/components/app-shell.tsx](apps/web/src/components/app-shell.tsx) — `useAppState()`로 auth/saved/toast/lang 제공. **auth·user 는 현재 mock**(클라이언트 상태).
- 네비게이션 어댑터: [apps/web/src/lib/nav.ts](apps/web/src/lib/nav.ts) — `urlFor(name, params)` + `useAppNav()`.
- `design/` 에는 이제 **재사용 프리미티브만**: `icons.tsx`, `ui.tsx`(Sidebar/TabBar/ThemeHueBg/Signal/Placeholder 등), `brand-logos.tsx`, `styles.css`, `data.ts`(mock). 화면 컴포넌트(screens-*)는 전부 삭제됨.

### 공공 API 연동 계층 (서버 전용)

- [apps/web/src/server/public-api/http.ts](apps/web/src/server/public-api/http.ts) — data.go.kr 공통 fetch(serviceKey 주입·타임아웃·XML 에러 감지).
- [apps/web/src/server/public-api/tourapi.ts](apps/web/src/server/public-api/tourapi.ts) — 국문관광정보(KorService2, 강원 areaCode=32). **유일하게 구현된 클라이언트.**
- [apps/web/scripts/verify-public-api.mjs](apps/web/scripts/verify-public-api.mjs) — 키 연결 검증.
- 환경변수: 루트 `.env` (next.config.mjs 가 dotenv 로 로드) → [apps/web/src/lib/env.ts](apps/web/src/lib/env.ts)(zod 검증). 템플릿 [.env.example](.env.example).
- **API 신청 가이드(키 발급용)**: [docs/공공API-신청가이드.md](docs/공공API-신청가이드.md)

## 데이터 분류 (연동 전략의 기준)

1. **정적 큐레이션** (테마·코스·키워드 규칙·대체지 매핑) → 코드/시드 유지. API 불필요.
2. **반정적** (관광지·맛집·숙박 기본정보) → TourAPI 수집 → DB. 큐레이션 스팟에 이미지/주소/좌표 보강.
3. **실시간 동적** (혼잡도/날씨/대기질/교통) → 요청 시 호출 + 단기 캐시. **방문 적합성 점수(Phase 3)의 입력.**
4. **사용자** (회원/저장/리뷰/방문/온보딩) → DB (Phase 4).

## 진행 상태

전체 단계·체크리스트는 [docs/구현-계획.md](docs/구현-계획.md) 참고. 요약:

- ✅ **Phase 0** 기반 정비 (도메인 타입·Repository·env·i18n)
- ✅ **Phase 1a** 실제 App Router 라우팅 전환 (단일 상태머신 → 17 라우트)
- ✅ **Phase 1b** 전 화면을 `getRepository()` 도메인 데이터 + Server Component 로 전환 (콘텐츠 + 인증/마이페이지, 모두 mock 데이터)
- 🔄 **Phase 2** 공공 API 연동 — 신청 가이드·http 헬퍼·TourAPI·검증 스크립트 + **기상청 격자변환(`grid.ts`)·강원 권역 테이블(`regions.ts`)·기상청 단기예보(`kma.ts`)·에어코리아(`airkorea.ts`) 클라이언트 + `LiveRepository` 완료**. `DATA_SOURCE=live` 배선됨(스팟 단위 mock 폴백). **키 실검증·contentId 시드 확정·측정소 매핑·응답 캐시 영속화([server/cache.ts](apps/web/src/server/cache.ts) 메모리+파일 2층) 완료.**
- ✅ **Phase 3** 방문 적합성 스코어 — `scoreSuitability`(혼잡+날씨+대기질, 장소별 가중치) + `estimateCongestion`(동적 혼잡: 인기prior×시간대×요일×계절×날씨 + 하루 분산곡선·추천 방문시간대) + **`reorderSpotsByCongestion`(하루 스팟을 혼잡 최소가 되도록 시간 슬롯 재배정) 완료.** LiveRepository 가 `getSpot`/`getCourse` 에서 동적 혼잡 산출→`congestion`/`suitability`/`crowdTip`·코스 `reorderNote` 보강, spot·course 화면 노출. / 🔄 **Phase 4** 인증·DB — **Keycloak SSO 전환 준비 완료: Auth.js=Keycloak OIDC client, 앱 DB=저장/리뷰/방문 도메인 테이블만 보유(`user_id=Keycloak sub`), `SessionProvider`·`useSession`/`signIn`/`signOut` app-shell 전환 + 코스 저장 `setThemeSaved` Server Action 연결.** 남음: 로컬 Keycloak 서버/realm import, IdP 브로커링 검증, 보호 라우트 세션 가드, 리뷰/방문 쓰기 폼.

### 현재 블로커 / 다음 작업

- **공공 API 키 상태 ✅ 해소(2026-06-23 로컬 검증)**: TOUR/KMA/AIRKOREA 모두 ✓ (TourAPI 강원 totalCount=3355, KMA resultCode=00, 에어코리아 강원 40곳). 이전 403 블로커 종료. 샌드박스는 여전히 data.go.kr egress 불가 → 실호출 검증·실응답 수집은 로컬에서만.
- **테스트 ①②완료**: 순수 함수(matching/scoring/grid/congestion/course-reorder) + API 정규화(kma/airkorea/tourapi)·LiveRepository 폴백·캐시·에이전트·user-data = **68개 통과**(2026-06-26 `pnpm --filter @eumgil/web test` green). `pnpm --filter @eumgil/web typecheck`·`pnpm --filter @eumgil/web build` 통과(빌드 중 일부 공공 API는 네트워크 fallback 로그 발생, 빌드 성공).
- **contentId 시드 현황 ✅(2026-06-23 find:content 재조회로 확정)**: 확정 5건 — seorak-gwongeum(125798)/dongmyeong-port(129454)/sokcho-market(3354272) + **sacheon-beach(2773046 사천진항 type12 근접 POI)·woljeongsa-trail(2022311 오대산 선재길 type28)** + 실측 좌표 갱신. 미확정 4건은 적합 POI 부재로 contentId=null 확정: anmok-beach(후보 전부 숙박/음식점)·ojukheon(여행코스만)·daegwallyeong-sheep(후보는 평창 아닌 정선 양떼목장)·jumunjin-cafe(카페 POI 없음)([spot-mapping.ts](apps/web/src/data/live/spot-mapping.ts)).
- **detailCommon2 보강 버그 ✅ 수정(2026-06-23 verify:enrichment)**: KorService2 `detailCommon2`는 구버전 YN 플래그(defaultYN/firstImageYN/…)를 받지 않아 빈 응답 → 보강이 조용히 폴백되던 버그. `getItemDetail` 을 `contentId`+numOfRows/pageNo 만 넘기도록 수정. 확정 5개 contentId 모두 실호출로 title/개요/이미지/좌표 정상 확인(dongmyeong-port만 대표이미지 없음=데이터 특성). 검증: `pnpm --filter @eumgil/web verify:enrichment`([verify-enrichment.mjs](apps/web/scripts/verify-enrichment.mjs)).
- **측정소 매핑 ✅(2026-06-23 보정·실검증)**: 에어코리아 강원 40개 측정소 실목록 기준 — 빈 권역 yangyang/jeongseon/inje 를 양양읍/정선읍/인제읍으로 채우고, 목록에 없던 chuncheon(석사동)·wonju(명륜동)를 온의동·반곡동으로 보정([regions.ts](apps/web/src/server/public-api/regions.ts)). 사용 권역(gangneung 옥천동/sokcho 중앙동/pyeongchang 평창읍)은 실목록과 일치 확인.
- **혼잡 분산 동적 산출 ✅(2026-06-23)**: [congestion.ts](apps/web/src/domain/congestion.ts) 순수함수 — `demand = prior × f시간대 × f요일 × f계절 × f날씨`, `index = demand/RAW_MAX×100` (0~100), 등급 thresh 34/67. 하루 곡선(8~20시)으로 가장 한산한 `bestHours`·분산 tip 산출. LiveRepository 배선 + `Spot.crowdTip?` 추가 + spot 화면 노출. 테스트 `congestion.test.ts`(8개) 추가·repository.test.ts 동적 혼잡 대응(시각 고정) — **로컬 `pnpm --filter @eumgil/web test`로 재확인 필요**(샌드박스 rollup 바이너리 미설치).
- **코스 재정렬 ✅(2026-06-23)**: [course-reorder.ts](apps/web/src/domain/course-reorder.ts) 순수함수 — 하루 스팟들을 각자 혼잡 곡선 기준으로 방문 시각 슬롯에 재배정(총 혼잡 최소화, n≤7 완전탐색·이상 그리디, 식사/숙박 고정). LiveRepository `getCourse` 오버라이드 배선(네트워크 불필요) + `Course.reorderNote?` + course 화면 노출. 테스트 `course-reorder.test.ts`(5개)·`congestion.test.ts`(8개) 추가 — **로컬 `pnpm --filter @eumgil/web test`로 재확인 필요**.
- **응답 캐시 영속화 ✅(2026-06-23)**: [server/cache.ts](apps/web/src/server/cache.ts) — 메모리(핫)+파일(영속) 2층, TTL 신선도·디바운스 flush·maxAge prune, 주입식 `CacheStore`(파일/메모리/추후 DB). LiveRepository 모듈 Map 을 `apiCache` 로 교체(날씨/대기질 10분·관광상세 24h). 테스트 `cache.test.ts`(5개, 메모리 store) 추가. 콜드스타트/재시작 후에도 캐시 생존.
- **Phase 4 골격 ✅(2026-06-23 → 2026-06-26 갱신)**: Drizzle+PostgreSQL 앱 DB 채택. Keycloak 전환 전에는 Auth.js DrizzleAdapter 표준 테이블까지 포함했으나, 2026-06-26 기준 **Keycloak SSO 구조로 전환 준비 완료** — 앱 DB 는 [db/schema.ts](apps/web/src/server/db/schema.ts)의 `saved_theme/review/visit` 3개 도메인 테이블만 보유하고 `user_id = Keycloak sub` 를 저장. [server/auth.ts](apps/web/src/server/auth.ts)는 Auth.js 를 Keycloak OIDC client 로 사용(`next-auth/providers/keycloak`, JWT session), Keycloak 이 사용자 원장/세션/소셜 브로커링을 담당. JWT/session callback 보강 완료: Keycloak token/profile → Auth.js 내부 JWT 에 `sub`/provider token/roles 저장, client session 에는 `id`/`roles` 만 노출([types/next-auth.d.ts](apps/web/src/types/next-auth.d.ts)). 셋업 문서 [docs/Phase4-인증DB-셋업.md](docs/Phase4-인증DB-셋업.md)도 Keycloak SSO 기준으로 갱신.
- **Phase 4 데이터 슬라이스(서버) ✅(2026-06-24 → 2026-06-26 갱신)**: 사용자 데이터를 세션→앱 DB 로 영속(미로그인/DB부재 시 mock 무중단 폴백). [db/user-data.ts](apps/web/src/server/db/user-data.ts)는 neutral `(db,keycloakSub)` 쿼리 계층(fetchSavedThemeIds/setSavedTheme/fetchReviews/fetchVisits/computeStats)으로 유지하고, 신원(name/email/image)은 DB user 테이블이 아니라 Keycloak 세션에서 받도록 [live/repository.ts](apps/web/src/data/live/repository.ts) 갱신. `@auth/drizzle-adapter` 제거, `verify:db`는 3개 앱 테이블만 확인. 검증: `pnpm --filter @eumgil/web typecheck`·`pnpm --filter @eumgil/web test` 68 green(2026-06-26).
- **Phase 4 데이터 슬라이스(클라이언트) ✅(2026-06-25 → 2026-06-26 갱신)**: [app/providers.tsx](apps/web/src/app/providers.tsx) `SessionProvider` 배선, [app-shell.tsx](apps/web/src/components/app-shell.tsx) `useSession`/`signIn`/`signOut` 유지. 로그인 버튼은 Keycloak 통합 로그인 1개(`providerId=keycloak`)로 정리([design/data.ts](apps/web/src/design/data.ts), [brand-logos.tsx](apps/web/src/design/brand-logos.tsx)). [actions/saved.ts](apps/web/src/app/actions/saved.ts) `setThemeSavedAction` + 코스 저장/해제 optimistic UI 유지.
- **다음 코딩 작업**: 로컬 Keycloak Docker Compose + realm/client import JSON 추가, Google→Kakao→Naver 순으로 Keycloak Identity Provider 브로커링 검증, Keycloak end-session endpoint 로 SSO 로그아웃 연결, 보호 라우트 세션 가드(저장/리뷰/설정 등 접근 정책 확정), 리뷰/방문 쓰기 Server Action/Form, 스팟 북마크 UX를 테마 저장 모델과 맞추기(현재 스팟 상세 북마크는 클라이언트 로컬 표시).
- **Agent Layer 방향 확정 ✅(2026-06-23, 설계 문서)**: 자연어 매칭/오케스트레이션을 결정형 파이프라인 → **Multi-step Tool-Calling 에이전트**로 전환하는 설계 확정([docs/에이전트-레이어-설계.md](docs/에이전트-레이어-설계.md)). 핵심: Repository 인터페이스 불변, 에이전트는 그 **아래**에 위치(`matchThemes`/`getCourse` 내부만 Planner 위임 + 결정형 폴백). 기존 순수함수·API 클라이언트 8종을 도구로 래핑(재구현 아님). 키 없이 검증되도록 `LlmProvider` mock/real 주입 + `server` 도구 샌드박스 mock 대체. 1차 타깃=**코스 플래닝 에이전트**. 자격요건 매핑: Tool Calling·프롬프트·Multi-step(1차) → LLM Evaluation(2차) → RAG(3차) → 멀티모달/VLM(4차). 열린 결정: LLM 프로바이더 선정·Evaluation 기준 등(문서 §7). Phase 4(인증/DB)와 **병렬 트랙**.
- **Agent A단계 골격 ✅(2026-06-23, 코드)**: `apps/web/src/server/agent/` 4파일 — [types.ts](apps/web/src/server/agent/types.ts)(PlanRequest/PlanResult/AgentStep/ToolSpec/ToolContext/LlmProvider)·[tools.ts](apps/web/src/server/agent/tools.ts)(도구 8종 `buildTools(ctx)` 래핑: list_themes/get_course/search_pois/get_weather/get_air_quality/estimate_congestion/score_suitability/reorder_by_congestion — 기존 순수함수·포트 재사용, enum 으로 행동공간 제한)·[llm.ts](apps/web/src/server/agent/llm.ts)(`LlmProvider` + `scriptedProvider`/`heuristicProvider` 키 없는 mock)·[planner.ts](apps/web/src/server/agent/planner.ts)(`planCourse` ReAct 루프 + 4겹 가드레일: 화이트리스트·중복차단·MAX_STEPS·결정형 폴백, `source:"agent"|"fallback"` 노출). 테스트 [planner.test.ts](apps/web/src/server/agent/planner.test.ts)(의도분기·가드레일·래핑, 키·네트워크 불요). **tsc 클린(agent 파일 무에러). vitest 는 샌드박스 rollup 미설치로 로컬 `pnpm --filter @eumgil/web test` 재확인 필요.** 남음: C단계(RealLlmProvider+키) · D단계(LLM Evaluation).
- **Agent B단계 배선 ✅(2026-06-23, 코드)**: `LiveRepository.matchThemes` 를 `planCourse`(에이전트)에 위임 + 결정형 폴백(`super.matchThemes` 키워드 규칙) — Repository 인터페이스(ThemeMatch) 불변, 화면 무수정. `buildAgentContext()` 가 ToolContext 실구현(테마/코스/스팟메타=mock 메모리, 날씨=kma·대기질=airkorea·POI=tourapi+apiCache). 현재 LLM 자리는 키 없는 `heuristicProvider`(C단계에서 RealLlmProvider 로 교체). 보조 테마는 결정형 매칭으로 보강. 테스트 [agent-wiring.test.ts](apps/web/src/data/live/repository.ts)(오프라인, 유효 ThemeMatch). 캐시 테스트 격리 픽스: [vitest.config.ts](apps/web/vitest.config.ts) 가 `EUMGIL_CACHE_DIR` 를 테스트 전용 디렉터리로 격리·초기화(실 캐시 누수로 setSystemTime 시 음수 age→오HIT 버그 해소). **tsc 클린(agent/live 무에러). vitest 로컬 재확인 필요.**
- **Agent getCourse 에이전트화 ✅(2026-06-23, 코드)**: `LiveRepository.getCourse` 를 `planItinerary`(에이전트)에 위임. 공통 루프 `runAgentLoop` 추출 후 진입점 2개(planCourse=테마선택 / planItinerary=코스정리)가 공유. heuristicItineraryProvider 가 get_course→날짜별 reorder_by_congestion→final 오케스트레이션, 실제 재배치 수치는 도구(순수함수)가 계산(**판단=LLM, 수치=코드** 분담). `applyReorderTrace`(순수)가 trace 의 reorder 결과를 base 코스에 반영(refId·체류시간 유지, 시각 슬롯만 이동). 폴백=기존 결정형 재정렬을 `reorderCourseDeterministic` 로 추출. `FinalAnswer`(테마/코스 공용, theme 필드 optional)·`PlanRequest.themeId` 추가. 테스트 [agent-wiring.test.ts](apps/web/src/data/live/agent-wiring.test.ts)에 getCourse 항목보존 케이스 추가. **tsc 클린. vitest 로컬 재확인 필요.** 남음: C단계(RealLlmProvider+키) · 코스 대체지(search_pois) 활용.
- **Agent D단계 Evaluation 골격 ✅(2026-06-23, 코드, mock 위)**: `apps/web/src/server/agent/eval/` 4파일 — [types.ts](apps/web/src/server/agent/eval/types.ts)(EvalCase/ScoreLine/CaseRun/EvalReport/Scorer)·[scorers.ts](apps/web/src/server/agent/eval/scorers.ts)(룰브릭 채점기: themeValidity/altThemesClean/agentCompleted/constraintAdherence/traceHealth + defaultScorers)·[dataset.ts](apps/web/src/server/agent/eval/dataset.ts)(의도 4케이스 + 오프라인 sampleEvalContext)·[runner.ts](apps/web/src/server/agent/eval/runner.ts)(`runEval` 프로바이더 무관 — llm 만 교체하면 mock↔real 동일 채점, `formatReport`). 테스트 [eval.test.ts](apps/web/src/server/agent/eval/eval.test.ts)(기준선 통과율·가드레일/제약 준수). **핵심 설계: 프로바이더 무관 → C단계 RealLlmProvider 합류 시 같은 데이터셋·채점기로 실모델 품질 정량 비교.** 현재는 룰브릭(코드 규칙)만; LLM-as-judge(주관 품질)는 실 LLM 후 추가. **tsc 클린. vitest 로컬 재확인 필요.**

## 컨벤션 / 주의사항

- **작업자 컨텍스트(메모)**: 이 프로젝트 담당자는 **AI Agent 설계를 학습 중인 개발자**다. 에이전트 관련 작업(Tool Calling·Multi-step·프롬프트·Evaluation·RAG·멀티모달, `server/agent/*`)을 할 때는 *왜 이렇게 설계했는지·결정형 대비 트레이드오프·일관성 확보 기법* 등을 코드와 함께 간단히 설명해 학습을 돕는다. 또한 인증/인가 작업(Auth.js·Keycloak·OAuth2/OIDC·JWT·세션·SSO·Identity Provider/Client·토큰 클레임·RBAC 등)을 할 때도 학습용 앱이라는 전제를 반영해, 면접에서 설명 가능한 수준으로 핵심 개념·운영 트레이드오프·현재 코드가 그 개념을 어떻게 구현하는지 간단히 설명한다. (단순 사실 질의·잡담엔 불필요)
- **새 코드는 타입 안전**하게. `design/*.tsx`(icons/ui/brand-logos/data)는 `@ts-nocheck`라 타입 없음 → 화면에서 쓸 땐 [components/screens/_ui.ts](apps/web/src/components/screens/_ui.ts)에서 `UI`/`Icon`을 `any`로 캐스팅해 사용(도메인 데이터 흐름은 정상 타입검사 유지).
- 화면은 **flat `_ko/_en` 직접 접근 금지**. 도메인 타입 + `localized(text, lang)` 사용.
- **공공 API/서비스키는 서버에서만**. `server/public-api/*`, `lib/env.ts`를 클라이언트에서 import 금지.
- **데이터 출처 디버그**: `EUMGIL_DEBUG`(=`1` 또는 `http,cache,repo`)로 서버 콘솔에 출처 로그. http=공공API 실호출(✓/✗·ms), cache=HIT/MISS/SET/FLUSH, repo=스팟 보강 live/mock폴백·코스 재정렬. 구현 [server/log.ts](apps/web/src/server/log.ts). 기본 침묵.
- env 키는 `lib/env.ts`에서 대부분 optional. 실제 필요한 기능 경로에선 `requireEnv("KEY")` 사용.
- UI 텍스트·코드 주석은 **한국어**. 강원특별자치도 = TourAPI `areaCode` **32**.
- 확정된 방향: 전체 실연동 제출 / 자연어 매칭은 키워드 우선(후반 LLM 검토). 상세 [docs/구현-계획.md](docs/구현-계획.md).
- **테스트 전략(단계적, 확정 2026-06-23)**: ① 지금 = 순수 함수 단위 테스트(matching/scoring/grid, Vitest) ② 키 실검증 직후 = API 정규화·LiveRepository 폴백(fetch 목) ③ Phase 4~5 = 화면 RTL + 핵심 플로우 E2E(Playwright). "구현 굳은 것부터" 원칙. 상세 [docs/구현-계획.md](docs/구현-계획.md) "5. 테스트 전략".
- **이 문서를 최신으로 유지할 것**: 의미 있는 마일스톤(Phase 완료, 주요 모듈 완성, 블로커 발생·해소) 시 위의 **"진행 상태 / 현재 블로커"** 섹션을 별도 요청 없이 갱신한다. 문서 전체를 다시 쓰지 말고 해당 섹션만 국소 수정(상세 체크리스트는 [docs/구현-계획.md](docs/구현-계획.md)가 정본).
