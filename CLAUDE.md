# CLAUDE.md

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
- 🔄 **Phase 2** 공공 API 연동 — 신청 가이드·http 헬퍼·TourAPI 클라이언트·검증 스크립트 완료. **나머지 클라이언트 + LiveRepository 남음.**
- ⬜ **Phase 3** 방문 적합성 스코어·혼잡 분산 로직 / **Phase 4** 실 인증(Auth.js)·DB

### 현재 블로커 / 다음 작업

- **공공 API 키 상태**: TourAPI(1번) ✅ 정상(강원 totalCount 확인). **기상청 단기예보(4)·에어코리아(6)는 HTTP 403 Forbidden.**
  - 진단 완료: **인코딩 문제 아님**(키 64자, 특수문자 없음 → Encoding=Decoding 동일, 6가지 변형 전부 403). 더미키=401 vs 실키=403 → **키는 유효하나 해당 서비스 권한 없음**.
  - 추정 원인: 승인 게이트웨이 반영 지연 **또는** TourAPI와 **다른 계정**으로 신청. → data.go.kr 해당 서비스 "미리보기"로 확인 필요.
- **다음 코딩 작업(키 무관)**: 기상청 격자 좌표 변환 유틸(위경도→nx/ny) + 강원 권역 좌표/측정소 테이블. 그 후 키 풀리면 날씨/대기질 클라이언트 → `LiveRepository`(TourAPI contentId 매핑으로 스팟 보강) → `DATA_SOURCE=live`.

## 컨벤션 / 주의사항

- **새 코드는 타입 안전**하게. `design/*.tsx`(icons/ui/brand-logos/data)는 `@ts-nocheck`라 타입 없음 → 화면에서 쓸 땐 [components/screens/_ui.ts](apps/web/src/components/screens/_ui.ts)에서 `UI`/`Icon`을 `any`로 캐스팅해 사용(도메인 데이터 흐름은 정상 타입검사 유지).
- 화면은 **flat `_ko/_en` 직접 접근 금지**. 도메인 타입 + `localized(text, lang)` 사용.
- **공공 API/서비스키는 서버에서만**. `server/public-api/*`, `lib/env.ts`를 클라이언트에서 import 금지.
- env 키는 `lib/env.ts`에서 대부분 optional. 실제 필요한 기능 경로에선 `requireEnv("KEY")` 사용.
- UI 텍스트·코드 주석은 **한국어**. 강원특별자치도 = TourAPI `areaCode` **32**.
- 확정된 방향: 전체 실연동 제출 / 자연어 매칭은 키워드 우선(후반 LLM 검토). 상세 [docs/구현-계획.md](docs/구현-계획.md).
- **이 문서를 최신으로 유지할 것**: 의미 있는 마일스톤(Phase 완료, 주요 모듈 완성, 블로커 발생·해소) 시 위의 **"진행 상태 / 현재 블로커"** 섹션을 별도 요청 없이 갱신한다. 문서 전체를 다시 쓰지 말고 해당 섹션만 국소 수정(상세 체크리스트는 [docs/구현-계획.md](docs/구현-계획.md)가 정본).
