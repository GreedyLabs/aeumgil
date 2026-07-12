# CLAUDE.md

에움길(Eumgil) 작업 시 참고할 프로젝트 컨텍스트. 새 세션에서도 이 파일을 먼저 읽고 시작.

## 서비스 개요

- **에움길** — 강원도 특화 테마 관광 추천 서비스 (관광데이터 공모전 출품작).
- 여행 목적을 **자연어로 입력 → 강원도 특화 테마 매칭 → 혼잡도·방문 적합성 기반 코스/대체지 추천**.
- **제출 형태: 전체 실연동 · 실제 운영 서비스** (mock 시연 아님). 공공 API 실연동 + DB + 소셜 인증까지 목표.
- 기획 상세: [docs/제안서.md](docs/제안서.md)

## 진행 상태 / 남은 작업 (정본 위치)

이 문서에는 진행 히스토리를 기록하지 않는다. 항상 아래 두 문서를 본다:

- **[docs/운영-준비-플랜.md](docs/운영-준비-플랜.md)** — **현재 상태 스냅샷(§0) + 제출·운영까지 남은 작업의 정본.** P0/P1/P2 체크리스트, 항목별 근거(파일:라인)·DoD·검증 방법. 작업 완료 시 여기 체크박스를 채운다.
- [docs/구현-계획.md](docs/구현-계획.md) — 단계별(Phase 0~5) 설계 배경과 상세 체크리스트(히스토리 포함).
- 에이전트 레이어 설계 배경: [docs/에이전트-레이어-설계.md](docs/에이전트-레이어-설계.md) / 인증·DB 셋업 런북: [docs/Phase4-인증DB-셋업.md](docs/Phase4-인증DB-셋업.md)

한 줄 요약(2026-07-10 기준): Phase 0~3 완료, Phase 4(인증·DB·Server Actions) 코드 완료, 에이전트 A~D단계 구현 완료(실 LLM 검증·Evaluation 실행 남음). 남은 것은 운영 준비 플랜의 P0(보안 하드닝·에러 바운더리·어뷰즈 방어)부터.

## 기술 스택

- pnpm workspaces 모노레포 · Next.js 15 (App Router) · React 19 · TypeScript(strict, `noUncheckedIndexedAccess`) · Tailwind v4
- DB: PostgreSQL + Drizzle ORM(postgres-js) / 인증: Keycloak(OIDC) + Auth.js(NextAuth v5)
- 배포: Docker(standalone) + GitHub Actions → Dockhand webhook ([Dockerfile](Dockerfile), [.github/workflows/](.github/workflows/))
- 앱: `apps/web` (`@eumgil/web`) / 공용 UI: `packages/ui` (`@eumgil/ui`) / Keycloak 로컬: [docker-compose.keycloak.yml](docker-compose.keycloak.yml)·[infra/keycloak](infra/keycloak)

## 명령어

```bash
pnpm dev                                    # 개발 서버 (localhost:3000)
pnpm build                                  # 프로덕션 빌드
pnpm typecheck                              # 타입 검사 (pnpm -r)
pnpm --filter @eumgil/web test              # Vitest 유닛/정규화 테스트
pnpm --filter @eumgil/web verify:api        # 공공 API 키 연결 검증 (.env 필요)
pnpm --filter @eumgil/web verify:enrichment # TourAPI 상세 보강 실검증
pnpm --filter @eumgil/web verify:db         # DB 연결 점검
pnpm --filter @eumgil/web verify:keycloak   # Keycloak 연결 점검
pnpm --filter @eumgil/web db:apply          # 앱 스키마 적용 (그 외 db:* 스크립트는 package.json 참고)
```

## 핵심 아키텍처 (가장 중요)

전체 화면이 **데이터 출처를 모른 채 `getRepository()` 인터페이스만 호출**한다. 런타임 Repository는 항상 DB+실데이터 구현(`LiveRepository`)이다.

- **도메인 모델**: [apps/web/src/domain/types.ts](apps/web/src/domain/types.ts) — `Theme/Spot/Course/Eat/Stay/User/Review/Visit` 등. 모든 다국어 텍스트는 `LocalizedText {ko,en}`.
- **Repository 인터페이스**: [apps/web/src/domain/repository.ts](apps/web/src/domain/repository.ts) — 모든 메서드 `async`.
- **구현**: [apps/web/src/data/live/repository.ts](apps/web/src/data/live/repository.ts) — DB 카탈로그 위에 실시간 데이터(날씨/대기질/혼잡/적합성) 보강. **외부 API 실패 시 DB 기본값 유지**(mock 폴백 없음).
- **DB 카탈로그**: [apps/web/src/server/db/course-catalog.ts](apps/web/src/server/db/course-catalog.ts) — `course_template`/`course_template_item`/`spot_profile` → 도메인 타입 정규화. 스키마: [db/schema.ts](apps/web/src/server/db/schema.ts).
- **순수 함수 레이어**(도메인 로직, 네트워크 무관): [matching.ts](apps/web/src/domain/matching.ts)·[scoring.ts](apps/web/src/domain/scoring.ts)·[congestion.ts](apps/web/src/domain/congestion.ts)·[course-reorder.ts](apps/web/src/domain/course-reorder.ts)·[course-compose.ts](apps/web/src/domain/course-compose.ts)·[travel-time.ts](apps/web/src/domain/travel-time.ts). 외부 의존은 포트 주입으로만 받는다.

### 화면 / 라우팅

- App Router 17개 라우트. **서버 `page.tsx`가 `getRepository()`로 데이터 페치 → 도메인 타입 props → 클라이언트 뷰** 렌더.
- 화면 뷰: [apps/web/src/components/screens/](apps/web/src/components/screens/). 전역 크롬(Sidebar·TabBar·Toast)+세션 상태: [app-shell.tsx](apps/web/src/components/app-shell.tsx)(`useSession` 실배선). 네비게이션: [lib/nav.ts](apps/web/src/lib/nav.ts).
- 쓰기 경로는 **Server Actions**([app/actions/](apps/web/src/app/actions/) — saved/profile/onboarding/reviews): zod 검증 + 세션 가드 + `revalidatePath`. 개인화 화면 서버 가드는 [require-session.ts](apps/web/src/server/require-session.ts).
- `design/`에는 재사용 프리미티브만(`icons.tsx`/`ui.tsx`/`brand-logos.tsx`/`styles.css`/`data.ts`). `@ts-nocheck` 영역이므로 화면에서는 [screens/_ui.ts](apps/web/src/components/screens/_ui.ts) 캐스팅을 거쳐 사용.

### 인증 (Keycloak OIDC)

- Keycloak이 사용자 원장·소셜 브로커(카카오/네이버/구글)·세션을 책임진다. 앱은 **OIDC Client** — Auth.js([server/auth.ts](apps/web/src/server/auth.ts))는 Keycloak provider 하나만 두고, 토큰의 `sub`를 사용자 id로 신뢰한다.
- 앱 DB에는 Auth.js adapter 테이블이 **없다**. 서비스 데이터(saved/review/visit/user_profile)만 `sub`에 연결([db/user-data.ts](apps/web/src/server/db/user-data.ts)).
- 미로그인 = mock 사용자 대체가 아니라 `null`/빈 배열. 쓰기는 로그인 요구 에러.

### 공공 API 연동 계층 (서버 전용)

- 공통 fetch: [public-api/http.ts](apps/web/src/server/public-api/http.ts) — serviceKey 주입·타임아웃·XML 에러 감지.
- 클라이언트: [tourapi.ts](apps/web/src/server/public-api/tourapi.ts)(KorService2, 강원 areaCode=32)·[kma.ts](apps/web/src/server/public-api/kma.ts)(단기예보+격자변환 [grid.ts](apps/web/src/server/public-api/grid.ts))·[airkorea.ts](apps/web/src/server/public-api/airkorea.ts)(권역-측정소 매핑 [regions.ts](apps/web/src/server/public-api/regions.ts)).
- 스팟↔좌표/권역/contentId 매핑: [data/live/spot-mapping.ts](apps/web/src/data/live/spot-mapping.ts).
- 응답 캐시: [server/cache.ts](apps/web/src/server/cache.ts) — 메모리+파일 2층, TTL은 호출부(날씨/대기질 30분·관광상세 24h). 날씨 캐시 키는 스팟이 아니라 KMA 격자 단위(`wx:g{nx},{ny}`, kma.ts `weatherCacheKey` — 쿼터 절감, 플랜 §3.2). `CacheStore` 주입식이라 백엔드 교체 지점은 한 곳.
- 이동시간: [server/routing/travel-time.ts](apps/web/src/server/routing/travel-time.ts) — 근사(기본)/Kakao Mobility(`ROUTING_PROVIDER=kakao`+키) 포트.
- 환경변수: 루트 `.env`(next.config.mjs가 dotenv 로드) → [lib/env.ts](apps/web/src/lib/env.ts)(zod). 템플릿 [.env.example](.env.example). 키 발급 가이드: [docs/공공API-신청가이드.md](docs/공공API-신청가이드.md).

### 에이전트 레이어 (Repository 아래)

- Repository 인터페이스는 불변. `matchThemes`/`getCourse` **내부**만 에이전트(`planCourse`/`planItinerary`)에 위임하고, 실패 시 결정형 로직으로 폴백한다(`source:"agent"|"fallback"`).
- 구성: [server/agent/](apps/web/src/server/agent/) — types/tools(도구 8종, 기존 순수함수·포트 래핑)/llm(heuristic mock + OpenAI-compatible real, `EUMGIL_AGENT_LLM` env로 선택)/planner(ReAct 루프 + 화이트리스트·중복차단·MAX_STEPS·폴백 4겹 가드레일).
- 원칙: **판단=LLM, 수치=코드**(도구 순수함수가 계산). 키 없이도 heuristic provider로 전 경로 검증 가능.
- Evaluation: [server/agent/eval/](apps/web/src/server/agent/eval/) — 프로바이더 무관 러너(mock↔real 동일 데이터셋·채점기).

## 데이터 분류 (연동 전략의 기준)

1. **정적 큐레이션** (테마·코스·키워드 규칙·대체지 매핑) → 코드/시드 유지. API 불필요.
2. **반정적** (관광지·맛집·숙박 기본정보) → TourAPI 수집 → DB. 큐레이션 스팟에 이미지/주소/좌표 보강.
3. **실시간 동적** (혼잡도/날씨/대기질/교통) → 요청 시 호출 + 단기 캐시. 방문 적합성 점수의 입력.
4. **사용자** (회원/저장/리뷰/방문/온보딩) → DB. 신원(email/image)은 Keycloak 세션, 앱 표시명/bio는 `user_profile`.

## 컨벤션 / 주의사항

- **작업자 컨텍스트(메모)**: 이 프로젝트 담당자는 **AI Agent 설계를 학습 중인 개발자**다. 에이전트 관련 작업(Tool Calling·Multi-step·프롬프트·Evaluation·RAG·멀티모달, `server/agent/*`)을 할 때는 *왜 이렇게 설계했는지·결정형 대비 트레이드오프·일관성 확보 기법* 등을 코드와 함께 간단히 설명해 학습을 돕는다. (단순 사실 질의·잡담엔 불필요)
- **새 코드는 타입 안전**하게. `design/*.tsx`는 `@ts-nocheck` → 화면에서 쓸 땐 [screens/_ui.ts](apps/web/src/components/screens/_ui.ts)에서 `UI`/`Icon` 캐스팅 사용(도메인 데이터 흐름은 정상 타입검사 유지).
- 화면은 **flat `_ko/_en` 직접 접근 금지**. 도메인 타입 + `localized(text, lang)` 사용.
- **공공 API/서비스키는 서버에서만**. `server/public-api/*`, `lib/env.ts`를 클라이언트에서 import 금지.
- **data.go.kr 키는 Decoding(원본) 키**를 `.env`에 넣는다 — http.ts가 한 번만 인코딩(Encoding 키를 넣으면 이중 인코딩으로 실패).
- **데이터 출처 디버그**: `EUMGIL_DEBUG`(=`1` 또는 `http,cache,repo,routing`)로 서버 콘솔에 출처 로그(실호출✓/✗·캐시 HIT/MISS·폴백). 구현 [server/log.ts](apps/web/src/server/log.ts). 기본 침묵. "실연동인지 폴백인지" 확인은 항상 이걸로.
- env 키는 `lib/env.ts`에서 대부분 optional. 필수 기능 경로에선 `requireEnv("KEY")` 사용.
- UI 텍스트·코드 주석은 **한국어**. 강원특별자치도 = TourAPI `areaCode` **32**.
- **테스트 전략(단계적)**: ① 순수 함수 유닛 ② API 정규화·폴백(fetch 목) ③ 화면 RTL + E2E(Playwright, 미착수 — 플랜 §8). "구현 굳은 것부터" 원칙. 상세 [docs/구현-계획.md](docs/구현-계획.md) §5.
- **샌드박스 환경 제약**: data.go.kr egress 불가(실호출 검증은 로컬에서만), vitest rollup 바이너리 미설치 가능(`pnpm --filter @eumgil/web test`는 로컬 재확인). 실검증이 필요한 변경은 결과 보고에 이 한계를 명시할 것.
- **문서 유지 규칙**: 진행상태·블로커·남은 작업은 이 파일이 아니라 **[docs/운영-준비-플랜.md](docs/운영-준비-플랜.md)의 체크박스·스냅샷(§0)을 갱신**한다(완료 시 날짜 기입, 새 이슈는 같은 형식으로 추가). 이 파일은 **아키텍처·규칙이 실제로 바뀔 때만** 해당 섹션을 국소 수정한다. 히스토리를 이 파일에 다시 쌓지 말 것.
