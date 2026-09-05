# AGENTS.md

에움길(Eumgil) 작업 시 참고할 프로젝트 컨텍스트. 새 세션에서도 이 파일을 먼저 읽고 시작.

## 개발 재개 현황 (2026-09-05)

- **운영 배포**: `https://에움길.한국` (`https://xn--wk0bk16buua.xn--3e0b707e`). GitHub dev → Actions 검증·GHCR latest → Dockhand 스택 7. 1차 이미지 `464c3f3` 배포·deep health 정상 확인. 이번 카탈로그·개인 코스·UI 후속 변경은 최종 검증 후 같은 경로로 배포한다.
- **실데이터 카탈로그**: TourAPI 강원 원본 4,761건에서 현재 관광지 1,975곳(사진 1,744), 음식점 1,551곳·숙소 954곳, 18개 시군, 테마 119개(지역 추천 113+기존 큐레이션 6). 신규 코스는 공식 관광정보와 지역 명소를 바탕으로 가까운 3곳을 연결한 에움길 추천이며 공식 기관의 승인 코스가 아니다. 출처·선정 기준은 [카탈로그·UI 고도화](docs/관광카탈로그-탐색-고도화-2026-09-05.md).
- **목 데이터 정리**: `design/data.ts` 삭제, 과거 prototype seeder 중단. JSON 문자열로 중복 저장됐던 theme_ids/tags 배열 복구, 가상 주문진 카페 및 존재하지 않는 템플릿 참조·샘플 평점 제거. 사용자 기록 유지. 빈 코스·끊어진 템플릿 참조 각각 0건 확인. LLM은 사용자 요청에 따라 heuristic 유지.
- **8종 공공 API**: 관광정보·지역 방문자수·일별 집중률 예측·무장애 정보·단기예보·생활기상 자외선·에어코리아·도로공사. data.go.kr 7종은 `DATA_GO_KR_SERVICE_KEY` 하나, 도로공사는 `EX_ROAD_SERVICE_KEY`. 최신 관광 지역 코드 `lDongRegnCd=51` 및 3자리 시군구 사용. [신청 가이드](docs/공공API-신청가이드.md).
- **무장애**: `KorWithService2` 강원 1,517건 실제 수집, 관광지 661곳과 contentId 연결. 검색에서 안내 보유 여부 필터, 상세에서 출입구·계단·휠체어·화장실 등 조건 원문 노출. 안내 보유를 휠체어 이용 가능 판정으로 바꾸지 않는다. `db:sync:accessibility --apply`로 목록 갱신, 상세는 24시간 캐시.
- **탐색·홈**: 홈은 목적 입력·대표 추천 3개·지역 탐색에 집중. 탐색에 여행지 검색과 위치 지도 통합. `/map`은 검색 조건을 보존해 탐색으로 이동. 카드 선택은 지도 갱신, 상세 링크만 상세 진입. DB 검색 24개 페이지·다중 키워드·18개 지역·종류·무장애 필터. 카드마다 외부 API를 호출하지 않는다.
- **행사 상세**: `/festival/[id]`에서 기간·시간·요금·주최·사진·지도와 10km 내 여행지/음식점을 제공. 행사+주변 장소로 개인 코스를 시작할 수 있고 긴 소개는 펼쳐 읽는다.
- **개인 코스**: `/my-courses/new`, `/my-courses/[id]`에서 추천 복사 또는 빈 일정 시작 → 장소 추가/제거/방문 순서/날짜/체류 시간/이름/메모 편집·DB 저장/삭제. `personal_course`는 Keycloak sub로 소유자 분리, 버전 조건으로 다른 탭 변경 덮어쓰기 방지. 계정 탈퇴 시 함께 삭제. `/saved`는 직접 만든 코스와 저장 추천 테마를 분리한다.
- **지도·교통**: 코스별 날짜 선택·번호 마커·식당/숙소를 포함한 동선·이동 추정. 현재 점선은 방문 순서이며 도로 경로가 아니다. 사용자 결정에 따라 Kakao Mobility 연동은 진행하지 않고 OSM/OSRM은 검토만. 고속도로는 관광지마다 반복하지 않고 탐색 지역 통계에서 출발 전 참고 정보로 제공한다.
- **공통 UI**: 문서 스크롤, PC 사이드바 256px(중간 폭 224px)/접힘 76px. 같은 위치의 패널 토글·공통 Avatar·네이티브 Select 외형 통일. 로그인도 공통 메뉴 유지. 새 개인 코스가 내 여행 메뉴에 연결된다.
- **인증**: Keycloak 26.6.3 커스텀 테마·Google IdP·한국어/영어. 앱 로그아웃은 서버에서 ID 토큰 확보 → Auth.js 쿠키 제거 → Keycloak end-session으로 한 번에 이동. HTTPS `__Secure-` 쿠키와 청크를 올바르게 읽는다. 실제 Google 전체 왕복·SMTP는 별도 확인 사항.
- **배포·캐시**: 필수 env 8개, GHCR 이미지 pull, shared-db, UID1001 `/app/cache` named volume. 호출 합치기·정상 빈 결과·오류 재호출 제한·영속 캐시. 날씨/대기질 10분, 교통 5분, 자외선/행사 1시간, 집중률 6시간, 관광/무장애 상세/방문통계 24시간. 사용자 데이터는 API 캐시에 저장하지 않는다.
- **후속 검증**: TypeScript·단위 197개·Chrome 29개 시나리오 확인. 320~1920px 반응형, 개인 코스 CRUD/소유자/버전 충돌/추천 복사/행사 포함, 실제 무장애 원문·회원/리뷰 흐름. 상세 검증 기록은 고도화 문서 참조.
- 아래 과거 단계 기록과 다르면 이 현황이 우선한다.

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

전체 화면이 **데이터 출처를 모른 채 `getRepository()` 인터페이스만 호출**한다. 현재 런타임
Repository 는 항상 DB+실데이터 구현을 사용한다.

- **도메인 모델**: [apps/web/src/domain/types.ts](apps/web/src/domain/types.ts) — `Theme/Spot/Course/Eat/Stay/User/Review/Visit` 등. 모든 다국어 텍스트는 `LocalizedText {ko,en}`.
- **Repository 인터페이스**: [apps/web/src/domain/repository.ts](apps/web/src/domain/repository.ts) — 모든 메서드 `async`.
- **팩토리**: [apps/web/src/data/index.ts](apps/web/src/data/index.ts) — `getRepository()`는 항상 `LiveRepository`를 반환한다. 환경변수 기반 데이터소스 전환은 제거됨.
- **DB 카탈로그**: [apps/web/src/server/db/course-catalog.ts](apps/web/src/server/db/course-catalog.ts) — `course_template`/`course_template_item`/`spot_profile`을 도메인 `Theme`/`Course`/`Spot`으로 정규화한다.
- **자연어 매칭**: [apps/web/src/domain/matching.ts](apps/web/src/domain/matching.ts) — 키워드 규칙 순수 함수. (확정: 키워드 우선, 후반에 LLM 검토)

### 화면 / 라우팅

- App Router 17개 라우트. **서버 `page.tsx` 가 `getRepository()`로 데이터 페치 → 도메인 타입 props → 클라이언트 뷰** 렌더.
- 화면 뷰: [apps/web/src/components/screens/](apps/web/src/components/screens/) — `home/matching/theme-result/course/spot/alternatives/discover/map/saved/profile/profile-edit/reviews/settings/doc/login/onboarding`.
- 전역 상태/크롬(Sidebar·TabBar·Toast): [apps/web/src/components/app-shell.tsx](apps/web/src/components/app-shell.tsx) — `useAppState()`로 auth/session/toast/lang 제공. auth 는 Auth.js+Keycloak 세션을 사용.
- 네비게이션 어댑터: [apps/web/src/lib/nav.ts](apps/web/src/lib/nav.ts) — `urlFor(name, params)` + `useAppNav()`.
- `design/` 에는 이제 **재사용 프리미티브만**: `icons.tsx`, `ui.tsx`(Sidebar/TabBar/ThemeHueBg/Signal/Placeholder 등), `brand-logos.tsx`, `styles.css`. 런타임 목 데이터 `data.ts`는 삭제했다. 화면 컴포넌트(screens-*)는 전부 삭제됨.

### 공공 API 연동 계층 (서버 전용)

- [apps/web/src/server/public-api/http.ts](apps/web/src/server/public-api/http.ts) — data.go.kr 공통 fetch(serviceKey 주입·타임아웃·XML 에러 감지).
- [apps/web/src/server/public-api/tourapi.ts](apps/web/src/server/public-api/tourapi.ts) — 국문관광정보(KorService2, 강원 lDongRegnCd=51). 현재 공공 API 8종 구현.
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
- ✅ **Phase 1b** 전 화면을 `getRepository()` 도메인 데이터 + Server Component 로 전환
- 🔄 **Phase 2** 공공 API 연동 — 신청 가이드·http 헬퍼·TourAPI·검증 스크립트 + **기상청 격자변환(`grid.ts`)·강원 권역 테이블(`regions.ts`)·기상청 단기예보(`kma.ts`)·에어코리아(`airkorea.ts`) 클라이언트 + `LiveRepository` 완료**. 환경변수 기반 데이터소스 전환과 런타임 mock repository 제거, 카탈로그는 DB에서 직접 조회. 외부 API 실패 시 mock이 아니라 DB 기본값 유지. **키 실검증·contentId 시드 확정·측정소 매핑·응답 캐시 영속화([server/cache.ts](apps/web/src/server/cache.ts) 메모리+파일 2층) 완료.**
- ✅ **Phase 3** 방문 적합성 스코어 — `scoreSuitability`(혼잡+날씨+대기질, 장소별 가중치) + `estimateCongestion`(동적 혼잡: 인기prior×시간대×요일×계절×날씨 + 하루 분산곡선·추천 방문시간대) + **`reorderSpotsByCongestion`(하루 스팟을 혼잡 최소가 되도록 시간 슬롯 재배정) 완료.** LiveRepository 가 `getSpot`/`getCourse` 에서 동적 혼잡 산출→`congestion`/`suitability`/`crowdTip`·코스 `reorderNote` 보강, spot·course 화면 노출. / ✅ **Phase 4** 인증·DB 핵심 구현 — **Keycloak SSO 전환 완료권: Auth.js=Keycloak OIDC client, 앱 DB=저장/리뷰/방문/온보딩 선호/앱 프로필 도메인 테이블만 보유(`user_id=Keycloak sub`), `SessionProvider`·`useSession`/`signIn`/`signOut` app-shell 전환 + 저장/방문/리뷰/온보딩/프로필 Server Action 연결.** GreedyLabs 원격 Keycloak 로그인·회원가입·SSO 로그아웃 확인, access token refresh 로직 추가, 보호 라우트 세션 가드 적용, 스팟 북마크 UX 정리, 중복 리뷰 정책 완료. IdP 브로커링은 후순위.

### 현재 블로커 / 다음 작업

- **공공 API 키 상태 ✅ 해소(2026-06-23 로컬 검증)**: TOUR/KMA/AIRKOREA 모두 ✓ (TourAPI 강원 totalCount=3355, KMA resultCode=00, 에어코리아 강원 40곳). 이전 403 블로커 종료. 샌드박스는 여전히 data.go.kr egress 불가 → 실호출 검증·실응답 수집은 로컬에서만.
- **테스트 ①②완료**: 순수 함수(matching/scoring/grid/congestion/course-reorder/course-compose/travel-time) + API 정규화(kma/airkorea/tourapi)·LiveRepository DB 기본값 유지/DB 코스 카탈로그 배선·캐시·에이전트·user-data·course-catalog·course route 옵션 전달·서버 이동시간 포트 = **107개 통과**(2026-06-30 `corepack pnpm --filter @eumgil/web test` green). `corepack pnpm --filter @eumgil/web typecheck` 통과, `corepack pnpm --filter @eumgil/web build` 통과.
- **contentId 시드 현황 ✅(2026-06-23 find:content 재조회로 확정)**: 확정 5건 — seorak-gwongeum(125798)/dongmyeong-port(129454)/sokcho-market(3354272) + **sacheon-beach(2773046 사천진항 type12 근접 POI)·woljeongsa-trail(2022311 오대산 선재길 type28)** + 실측 좌표 갱신. 미확정 4건은 적합 POI 부재로 contentId=null 확정: anmok-beach(후보 전부 숙박/음식점)·ojukheon(여행코스만)·daegwallyeong-sheep(후보는 평창 아닌 정선 양떼목장)·jumunjin-cafe(카페 POI 없음)([spot-mapping.ts](apps/web/src/data/live/spot-mapping.ts)).
- **detailCommon2 보강 버그 ✅ 수정(2026-06-23 verify:enrichment)**: KorService2 `detailCommon2`는 구버전 YN 플래그(defaultYN/firstImageYN/…)를 받지 않아 빈 응답 → 보강이 조용히 폴백되던 버그. `getItemDetail` 을 `contentId`+numOfRows/pageNo 만 넘기도록 수정. 확정 5개 contentId 모두 실호출로 title/개요/이미지/좌표 정상 확인(dongmyeong-port만 대표이미지 없음=데이터 특성). 검증: `pnpm --filter @eumgil/web verify:enrichment`([verify-enrichment.mjs](apps/web/scripts/verify-enrichment.mjs)).
- **측정소 매핑 ✅(2026-06-23 보정·실검증)**: 에어코리아 강원 40개 측정소 실목록 기준 — 빈 권역 yangyang/jeongseon/inje 를 양양읍/정선읍/인제읍으로 채우고, 목록에 없던 chuncheon(석사동)·wonju(명륜동)를 온의동·반곡동으로 보정([regions.ts](apps/web/src/server/public-api/regions.ts)). 사용 권역(gangneung 옥천동/sokcho 중앙동/pyeongchang 평창읍)은 실목록과 일치 확인.
- **혼잡 분산 동적 산출 ✅(2026-06-23)**: [congestion.ts](apps/web/src/domain/congestion.ts) 순수함수 — `demand = prior × f시간대 × f요일 × f계절 × f날씨`, `index = demand/RAW_MAX×100` (0~100), 등급 thresh 34/67. 하루 곡선(8~20시)으로 가장 한산한 `bestHours`·분산 tip 산출. LiveRepository 배선 + `Spot.crowdTip?` 추가 + spot 화면 노출. 테스트 `congestion.test.ts`(8개) 추가·repository.test.ts 동적 혼잡 대응(시각 고정) — **로컬 `pnpm --filter @eumgil/web test`로 재확인 필요**(샌드박스 rollup 바이너리 미설치).
- **코스 재정렬 ✅(2026-06-23)**: [course-reorder.ts](apps/web/src/domain/course-reorder.ts) 순수함수 — 하루 스팟들을 각자 혼잡 곡선 기준으로 방문 시각 슬롯에 재배정(총 혼잡 최소화, n≤7 완전탐색·이상 그리디, 식사/숙박 고정). LiveRepository `getCourse` 오버라이드 배선(네트워크 불필요) + `Course.reorderNote?` + course 화면 노출. 테스트 `course-reorder.test.ts`(5개)·`congestion.test.ts`(8개) 추가 — **로컬 `pnpm --filter @eumgil/web test`로 재확인 필요**.
- **코스 생성 MVP ✅(2026-06-29 → 2026-06-30 UI·동선·길찾기 갱신)**: [course-compose.ts](apps/web/src/domain/course-compose.ts) 순수함수 추가. 기존 큐레이션 코스는 고정 결과가 아니라 시간 슬롯 템플릿으로 사용하고, 테마/POI/식당/숙소/대체지 후보 풀을 받아 혼잡한 스팟을 같은 테마·권역 대체 후보로 교체, 식당·숙소는 당일 스팟 권역에 맞춰 재선택한다. [travel-time.ts](apps/web/src/domain/travel-time.ts) 순수 함수가 좌표 기반 도로 이동시간을 근사하고, `transport=car|transit|walk` 이동수단별 속도/대기 오버헤드를 반영한다. composer 는 원래 장소와의 거리뿐 아니라 하루 전후 방문지를 기준으로 추가 이동분이 큰 대체 후보를 낮춘다. [server/routing/travel-time.ts](apps/web/src/server/routing/travel-time.ts) 서버 이동시간 포트가 좌표쌍 매트릭스 lookup 을 만들고, `ROUTING_PROVIDER=kakao` + `KAKAO_MOBILITY_API_KEY`가 있으면 관광지 좌표쌍을 Kakao Mobility Directions 자동차 경로로 계산한다. 키가 없거나 실패한 구간은 근사값으로 폴백하며, 사용자 위치는 저장하지 않고 현재 구현은 관광지 좌표끼리만 계산한다. baseCourse 없이 새 코스를 만들 때도 연속 이동시간이 긴 후보를 낮춘다. `days/pace/companion/startRegion/transport` 조건을 받아 일수·하루 스팟 수·가족/권역/이동수단 우선순위를 조정하며, 템플릿 코스가 있어도 `days`로 일정을 줄인다. `/course/[id]`는 동일 이름의 쿼리 파라미터를 Repository 선택 인자로 전달하고, [course.tsx](apps/web/src/components/screens/course.tsx)에 조건 패널(일정/페이스/동행/이동수단/시작 권역) UI가 추가되어 URL 갱신→서버 Repository 재호출로 코스를 다시 생성한다. `LiveRepository.getCourse()`는 `composeSeedCourse()`로 DB 기반 코스를 만든 뒤 `planItinerary` 혼잡 재정렬 에이전트에 넘기며, Agent 도구의 `get_course/reorder_by_congestion`도 동일한 options를 사용하도록 배선했다. 테스트 [course-compose.test.ts](apps/web/src/domain/course-compose.test.ts)(11개)·[travel-time.test.ts](apps/web/src/domain/travel-time.test.ts)(4개)·[server/routing/travel-time.test.ts](apps/web/src/server/routing/travel-time.test.ts)(4개)·[agent-wiring.test.ts](apps/web/src/data/live/agent-wiring.test.ts)(5개)로 검증.
- **코스 생성 DB 테이블화 ✅(2026-06-29 → 2026-06-30 갱신)**: [schema.ts](apps/web/src/server/db/schema.ts)에 `spot_profile`/`course_template`/`course_template_item` 추가. [apply-app-schema.mjs](apps/web/scripts/apply-app-schema.mjs)와 [verify-db.mjs](apps/web/scripts/verify-db.mjs)도 새 테이블을 생성·검증하도록 갱신. [course-catalog.ts](apps/web/src/server/db/course-catalog.ts)는 DB `course_template`을 도메인 `Theme`/`Course`로, DB `spot_profile`을 도메인 `Spot`으로 정규화한다. `LiveRepository`는 DB 템플릿/스팟 후보만 사용하고, DB가 없거나 후보가 비어도 런타임 mock/seed repository로 폴백하지 않는다. [seed-course-catalog.mjs](apps/web/scripts/seed-course-catalog.mjs) 추가 + `pnpm --filter @eumgil/web db:seed:course` 등록: `design/data.ts`의 초기 큐레이션을 `spot_profile/course_template/course_template_item`으로 upsert하는 일회성/운영 보조 시드. 테스트 [course-catalog.test.ts](apps/web/src/server/db/course-catalog.test.ts)(6개) + [course-catalog-wiring.test.ts](apps/web/src/data/live/course-catalog-wiring.test.ts)(4개)로 DB 템플릿/DB 후보/옵션 반영/seed fallback 없음 계약을 검증.
- **Phase 5 품질 1차 ✅(2026-06-30)**: 빌드의 `@next/next/no-img-element` warning 3건 제거. 프로필/프로필 편집 아바타는 원격 소셜 이미지 도메인이 유동적이라 `next/image` allowlist 대신 장식용 background avatar 컴포넌트([avatar.tsx](apps/web/src/components/screens/avatar.tsx))로 정리. 검증: `corepack pnpm --filter @eumgil/web test` 104개 통과, `typecheck` 통과, `build` 통과(이미지 lint warning 없음, 공공 API는 샌드박스 네트워크 fallback 로그만 발생).
- **Phase 5 실로그인·반응형 회귀 패스 ✅(2026-06-30 → 2026-07-01 보강)**: 원격 Keycloak `Test User1` 로그인 상태에서 실 DB 회귀 확인. `verify:keycloak` 통과, `verify:db` 최초 누락이던 `spot_profile/course_template/course_template_item`은 `db:apply` + `db:seed:course` 후 전체 테이블 정상. `/profile`·`/saved`·`/reviews`·`/profile/edit` 보호/세션 동작, 코스 저장 해제→재저장, 방문 기록 작성→수정→삭제, 리뷰 작성→수정→삭제, 온보딩 선호 저장, 프로필 관심 테마 저장을 실제 브라우저로 확인. 테스트 데이터는 리뷰/방문 0건으로 정리하고 프로필 관심 테마는 기존 힐링/해변/카페로 복원. 모바일 390px 홈→결과→코스→스팟→리뷰 저장, 데스크톱 1280px Sidebar/TabBar 전환 확인. 전 점검 화면 가로 오버플로 0. 2026-07-01에 모바일 하단 TabBar 안전 여백(`screen-body` 하단 padding/scroll-padding), 44px 터치 타깃(`icon-btn`/`btn-sm`/coarse pointer chip), 스팟 별점·리뷰 혼잡도 칩 터치 영역 보강 완료. 검증: `corepack pnpm --filter @eumgil/web typecheck`, `test` 107개, `build` 통과.
- **응답 캐시 영속화 ✅(2026-06-23)**: [server/cache.ts](apps/web/src/server/cache.ts) — 메모리(핫)+파일(영속) 2층, TTL 신선도·디바운스 flush·maxAge prune, 주입식 `CacheStore`(파일/메모리/추후 DB). LiveRepository 모듈 Map 을 `apiCache` 로 교체(날씨/대기질 10분·관광상세 24h). 테스트 `cache.test.ts`(5개, 메모리 store) 추가. 콜드스타트/재시작 후에도 캐시 생존.
- **Phase 4 골격 ✅(2026-06-23 → 2026-06-29 갱신)**: Drizzle+PostgreSQL 앱 DB 채택. Keycloak 전환 전에는 Auth.js DrizzleAdapter 표준 테이블까지 포함했으나, 현재 **Keycloak SSO 구조로 전환 완료권** — 앱 DB 는 [db/schema.ts](apps/web/src/server/db/schema.ts)의 `saved_theme/review/visit/onboarding_preference/user_profile` 도메인 테이블만 보유하고 `user_id = Keycloak sub` 를 저장. [server/auth.ts](apps/web/src/server/auth.ts)는 Auth.js 를 Keycloak OIDC client 로 사용(`next-auth/providers/keycloak`, JWT session), Keycloak 이 사용자 원장/세션/소셜 브로커링을 담당. JWT/session callback 보강 완료: Keycloak token/profile → Auth.js 내부 JWT 에 `sub`/provider token/roles 저장, client session 에는 `id`/`roles` 만 노출([types/next-auth.d.ts](apps/web/src/types/next-auth.d.ts)). 셋업 문서 [docs/Phase4-인증DB-셋업.md](docs/Phase4-인증DB-셋업.md)도 Keycloak SSO 기준으로 갱신.
- **Phase 4 데이터 슬라이스(서버) ✅(2026-06-24 → 2026-06-30 갱신)**: 사용자 데이터를 세션→앱 DB 로 영속. 미로그인 상태는 mock 사용자/저장 시드로 대체하지 않고 `null`/빈 배열을 반환하며, 저장 변경은 로그인 요구 에러를 낸다. [db/user-data.ts](apps/web/src/server/db/user-data.ts)는 neutral `(db,keycloakSub)` 쿼리 계층(fetchSavedThemeIds/setSavedTheme/fetchReviews/fetchVisits/computeStats/fetchOnboardingPreference/setOnboardingPreference/fetchUserProfile/setUserProfile)으로 유지하고, 신원 email/image 는 Keycloak 세션, 앱 표시명/bio 는 `user_profile`에서 받도록 [live/repository.ts](apps/web/src/data/live/repository.ts) 갱신. `@auth/drizzle-adapter` 제거, `verify:db`는 앱 도메인 테이블을 확인.
- **Phase 4 데이터 슬라이스(클라이언트) ✅(2026-06-25 → 2026-06-26 갱신)**: [app/providers.tsx](apps/web/src/app/providers.tsx) `SessionProvider` 배선, [app-shell.tsx](apps/web/src/components/app-shell.tsx) `useSession`/`signIn`/`signOut` 유지. 로그인 버튼은 Keycloak 통합 로그인 1개(`providerId=keycloak`)로 정리([design/data.ts](apps/web/src/design/data.ts), [brand-logos.tsx](apps/web/src/design/brand-logos.tsx)). [actions/saved.ts](apps/web/src/app/actions/saved.ts) `setThemeSavedAction` + 코스 저장/해제 optimistic UI 유지.
- **Keycloak 스택 ✅(2026-06-26 코드 → 2026-06-29 원격 확인)**: [docker-compose.keycloak.yml](docker-compose.keycloak.yml) 로컬 개발 스택 유지 + GreedyLabs 공용 Keycloak `https://auth.greedylabs.kr/realms/eumgil` discovery HTTP 200 확인. 원격 client id 는 `eumgil`(로컬 import 기본값 `eumgil-web` 과 다름). `.env.example`/셋업 문서에 원격 issuer/client id 안내 추가. [server/auth.ts](apps/web/src/server/auth.ts) `keycloakEndSessionUrl` 을 client_id/id_token_hint 포함 end-session URL 로 보강하고, access token 만료 전 refresh token grant 로 갱신. [app/api/auth/keycloak/logout/route.ts](apps/web/src/app/api/auth/keycloak/logout/route.ts) 추가 + [app-shell.tsx](apps/web/src/components/app-shell.tsx) 로그아웃이 Auth.js 세션 종료 전 end-session URL 을 받은 뒤 Keycloak SSO 로그아웃으로 이동. 실제 브라우저에서 `Test User1` 로그인 상태·보호 라우트·로그아웃 후 Keycloak 로그인 화면 복귀 확인. 2026-06-29 실 DB 로그인 검증: 원격 Keycloak 로그인 후 `/profile` 보호 라우트 진입, 코스 저장→프로필 저장 코스 1 반영→저장 해제→0 복귀까지 앱 DB 쓰기/읽기 왕복 확인.
- **보호 라우트 세션 가드 ✅(2026-06-29)**: [server/require-session.ts](apps/web/src/server/require-session.ts) 추가. `/saved`, `/reviews`, `/settings`, `/profile/edit` 서버 컴포넌트에서 `auth()` 세션의 `user.id`(Keycloak sub)를 요구하고 미로그인 시 `/login?reason=...` 으로 redirect.
- **리뷰/방문 쓰기 ✅(2026-06-29)**: [db/user-data.ts](apps/web/src/server/db/user-data.ts)에 `createVisit`/`createReview`, [app/actions/reviews.ts](apps/web/src/app/actions/reviews.ts)에 세션+DB 검증 Server Action 추가. [spot.tsx](apps/web/src/components/screens/spot.tsx) 스팟 상세에 `내 기록` 카드(방문 기록 버튼, 별점+짧은 리뷰 폼) 추가. `profile`/`reviews`/`spot` revalidate.
- **스팟 북마크 UX 정리 ✅(2026-06-29)**: [app-shell.tsx](apps/web/src/components/app-shell.tsx)의 클라이언트 전용 `saved`/`toggleSave` 상태 제거. [spot.tsx](apps/web/src/components/screens/spot.tsx) 상단 북마크 버튼은 `내 코스에 추가` 액션으로 전환해, 실제 영속 모델(`saved_theme`)과 혼동되는 장소 저장 UI를 없앰. 검증: `corepack pnpm --filter @eumgil/web typecheck`·`corepack pnpm --filter @eumgil/web test` 68 green.
- **온보딩 선호 저장 ✅(2026-06-29)**: [schema.ts](apps/web/src/server/db/schema.ts)에 `onboarding_preference` 추가(사용자별 최신 관심테마/페이스/동행 1행), [user-data.ts](apps/web/src/server/db/user-data.ts)에 fetch/upsert 함수 추가, [actions/onboarding.ts](apps/web/src/app/actions/onboarding.ts) Server Action 추가. [onboarding.tsx](apps/web/src/components/screens/onboarding.tsx)는 완료 CTA에서 로그인 요구→DB 저장, 건너뛰기는 저장 없이 홈 이동. [live/repository.ts](apps/web/src/data/live/repository.ts)가 저장된 관심 테마를 `User.interests`로 반영해 프로필 관심 테마에 노출. 검증: `corepack pnpm --filter @eumgil/web typecheck`·`corepack pnpm --filter @eumgil/web test` 69 green.
- **리뷰/방문 수정·삭제 ✅(2026-06-29)**: [user-data.ts](apps/web/src/server/db/user-data.ts)에 `updateReview`/`deleteReview`/`updateVisit`/`deleteVisit` 추가. 모든 변경은 `user_id = Keycloak sub` + 레코드 `id` 조건으로 제한. [actions/reviews.ts](apps/web/src/app/actions/reviews.ts) Server Action 확장, [reviews.tsx](apps/web/src/components/screens/reviews.tsx)에서 리뷰 별점·본문 수정/삭제, 방문 당시 혼잡도 수정/삭제 UI 제공. 검증: `corepack pnpm --filter @eumgil/web typecheck`·`corepack pnpm --filter @eumgil/web test` 69 green.
- **프로필 편집 저장 ✅(2026-06-29)**: [schema.ts](apps/web/src/server/db/schema.ts)에 `user_profile` 추가(Keycloak 신원 위에 얹는 앱 표시명/bio), [user-data.ts](apps/web/src/server/db/user-data.ts)에 fetch/upsert 함수 추가, [actions/profile.ts](apps/web/src/app/actions/profile.ts) Server Action 추가. [profile-edit.tsx](apps/web/src/components/screens/profile-edit.tsx)는 닉네임/bio/관심 테마를 저장하고, 관심 테마는 기존 `onboarding_preference`와 같은 소스에 반영. [live/repository.ts](apps/web/src/data/live/repository.ts)가 `user_profile` 표시명/bio를 `User`에 병합. 검증: `corepack pnpm --filter @eumgil/web typecheck`·`corepack pnpm --filter @eumgil/web test` 70 green.
- **중복 리뷰 정책 ✅(2026-06-29)**: [user-data.ts](apps/web/src/server/db/user-data.ts)의 `createReview`가 `(user_id, spot_id)` 기존 리뷰를 먼저 조회해 있으면 최신 1개를 갱신하고 과거 중복 행은 정리. DB unique index 추가 없이 애플리케이션 계층에서 “사용자 1명당 스팟 1개 리뷰 1개” 정책 적용. [spot.tsx](apps/web/src/components/screens/spot.tsx) CTA 문구도 저장·갱신 의미로 정리.
- **다음 코딩 작업**: Kakao Mobility 키 발급 후 `ROUTING_PROVIDER=kakao` 실호출 검증, 조건 입력을 Agent 도구 인자로 확장, 또는 성능/캐싱·빈 상태 UI 마무리. Google→Kakao→Naver Keycloak Identity Provider 브로커링은 후순위로 보류.
- **Agent Layer 방향 확정 ✅(2026-06-23, 설계 문서)**: 자연어 매칭/오케스트레이션을 결정형 파이프라인 → **Multi-step Tool-Calling 에이전트**로 전환하는 설계 확정([docs/에이전트-레이어-설계.md](docs/에이전트-레이어-설계.md)). 핵심: Repository 인터페이스 불변, 에이전트는 그 **아래**에 위치(`matchThemes`/`getCourse` 내부만 Planner 위임 + 결정형 폴백). 기존 순수함수·API 클라이언트 8종을 도구로 래핑(재구현 아님). 키 없이 검증되도록 `LlmProvider` mock/real 주입 + `server` 도구 샌드박스 mock 대체. 1차 타깃=**코스 플래닝 에이전트**. 자격요건 매핑: Tool Calling·프롬프트·Multi-step(1차) → LLM Evaluation(2차) → RAG(3차) → 멀티모달/VLM(4차). 열린 결정: LLM 프로바이더 선정·Evaluation 기준 등(문서 §7). Phase 4(인증/DB)와 **병렬 트랙**.
- **Agent A단계 골격 ✅(2026-06-23, 코드)**: `apps/web/src/server/agent/` 4파일 — [types.ts](apps/web/src/server/agent/types.ts)(PlanRequest/PlanResult/AgentStep/ToolSpec/ToolContext/LlmProvider)·[tools.ts](apps/web/src/server/agent/tools.ts)(도구 8종 `buildTools(ctx)` 래핑: list_themes/get_course/search_pois/get_weather/get_air_quality/estimate_congestion/score_suitability/reorder_by_congestion — 기존 순수함수·포트 재사용, enum 으로 행동공간 제한)·[llm.ts](apps/web/src/server/agent/llm.ts)(`LlmProvider` + `scriptedProvider`/`heuristicProvider` 키 없는 mock)·[planner.ts](apps/web/src/server/agent/planner.ts)(`planCourse` ReAct 루프 + 4겹 가드레일: 화이트리스트·중복차단·MAX_STEPS·결정형 폴백, `source:"agent"|"fallback"` 노출). 테스트 [planner.test.ts](apps/web/src/server/agent/planner.test.ts)(의도분기·가드레일·래핑, 키·네트워크 불요). **tsc 클린(agent 파일 무에러). vitest 는 샌드박스 rollup 미설치로 로컬 `pnpm --filter @eumgil/web test` 재확인 필요.** 남음: C단계(RealLlmProvider+키) · D단계(LLM Evaluation).
- **Agent B단계 배선 ✅(2026-06-23 → 2026-06-30 갱신)**: `LiveRepository.matchThemes` 를 `planCourse`(에이전트)에 위임 + DB 테마 텍스트 기반 결정형 폴백 — Repository 인터페이스(ThemeMatch) 불변, 화면 무수정. `buildAgentContext()` 가 ToolContext 실구현(테마/코스/스팟메타=DB 카탈로그, 날씨=kma·대기질=airkorea·POI=tourapi+apiCache). LLM 자리는 `courseProviderFromEnv()`로 선택(기본 heuristic, `EUMGIL_AGENT_LLM=openai`이면 실 LLM). 보조 테마는 결정형 매칭으로 보강. 테스트 [agent-wiring.test.ts](apps/web/src/data/live/repository.ts)(DB 대역 주입, 유효 ThemeMatch). 캐시 테스트 격리 픽스: [vitest.config.ts](apps/web/vitest.config.ts) 가 `EUMGIL_CACHE_DIR` 를 테스트 전용 디렉터리로 격리·초기화(실 캐시 누수로 setSystemTime 시 음수 age→오HIT 버그 해소).
- **Agent getCourse 에이전트화 ✅(2026-06-23 → 2026-06-29 갱신)**: `LiveRepository.getCourse` 를 `planItinerary`(에이전트)에 위임. 공통 루프 `runAgentLoop` 추출 후 진입점 2개(planCourse=테마선택 / planItinerary=코스정리)가 공유. `getCourse` 앞단에는 결정형 `composeCourse`가 먼저 실행되어 시드/DB 후보 기반 코스를 만들고, 기본 heuristicItineraryProvider 가 get_course→날짜별 reorder_by_congestion→변경 시 search_pois→final 오케스트레이션한다. 실제 코스 조합·재배치 수치는 순수함수가 계산하고 대체 후보는 도구가 조회(**판단=LLM, 데이터/수치=코드** 분담). `applyReorderTrace`(순수)가 trace 의 reorder 결과를 base 코스에 반영(refId·체류시간 유지, 시각 슬롯만 이동)하고 search_pois 후보를 `Course.altNote`로 노출. 코스 화면은 `reorderNote`와 `altNote`를 모두 표시. 폴백=기존 결정형 재정렬을 `reorderCourseDeterministic` 로 추출. 테스트 [agent-wiring.test.ts](apps/web/src/data/live/agent-wiring.test.ts), [llm.test.ts](apps/web/src/server/agent/llm.test.ts), [course-compose.test.ts](apps/web/src/domain/course-compose.test.ts) 추가/갱신. 검증: `corepack pnpm --filter @eumgil/web typecheck`·`corepack pnpm --filter @eumgil/web test` 78 green.
- **Agent C단계 실 LLM ✅(2026-06-29, 코드)**: [llm.ts](apps/web/src/server/agent/llm.ts)에 SDK 의존성 없는 `openAiChatProvider` 추가(OpenAI-compatible Chat Completions `tool_calls` → `LlmDecision`, JSON final 파싱). [env.ts](apps/web/src/lib/env.ts)·[.env.example](.env.example)에 `EUMGIL_AGENT_LLM`/`OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_BASE_URL` 추가. `LiveRepository`는 `courseProviderFromEnv()`/`itineraryProviderFromEnv()`로 실 LLM↔heuristic 전환. 키가 없거나 `heuristic`이면 네트워크 없이 기존 동작 유지, 실 LLM 호출 실패는 planner 폴백 대상. 테스트 [llm.test.ts](apps/web/src/server/agent/llm.test.ts)(fetch 주입, 키·네트워크 불요) 추가. 검증: `corepack pnpm --filter @eumgil/web typecheck`·`corepack pnpm --filter @eumgil/web test` 73 green.
- **Agent D단계 Evaluation 골격 ✅(2026-06-23, 코드, mock 위)**: `apps/web/src/server/agent/eval/` 4파일 — [types.ts](apps/web/src/server/agent/eval/types.ts)(EvalCase/ScoreLine/CaseRun/EvalReport/Scorer)·[scorers.ts](apps/web/src/server/agent/eval/scorers.ts)(룰브릭 채점기: themeValidity/altThemesClean/agentCompleted/constraintAdherence/traceHealth + defaultScorers)·[dataset.ts](apps/web/src/server/agent/eval/dataset.ts)(의도 4케이스 + 오프라인 sampleEvalContext)·[runner.ts](apps/web/src/server/agent/eval/runner.ts)(`runEval` 프로바이더 무관 — llm 만 교체하면 mock↔real 동일 채점, `formatReport`). 테스트 [eval.test.ts](apps/web/src/server/agent/eval/eval.test.ts)(기준선 통과율·가드레일/제약 준수). **핵심 설계: 프로바이더 무관 → C단계 RealLlmProvider 합류 시 같은 데이터셋·채점기로 실모델 품질 정량 비교.** 현재는 룰브릭(코드 규칙)만; LLM-as-judge(주관 품질)는 실 LLM 후 추가. **tsc 클린. vitest 로컬 재확인 필요.**

## 컨벤션 / 주의사항

- **작업자 컨텍스트(메모)**: 이 프로젝트 담당자는 **AI Agent 설계를 학습 중인 개발자**다. 에이전트 관련 작업(Tool Calling·Multi-step·프롬프트·Evaluation·RAG·멀티모달, `server/agent/*`)을 할 때는 *왜 이렇게 설계했는지·결정형 대비 트레이드오프·일관성 확보 기법* 등을 코드와 함께 간단히 설명해 학습을 돕는다. 또한 인증/인가 작업(Auth.js·Keycloak·OAuth2/OIDC·JWT·세션·SSO·Identity Provider/Client·토큰 클레임·RBAC 등)을 할 때도 학습용 앱이라는 전제를 반영해, 면접에서 설명 가능한 수준으로 핵심 개념·운영 트레이드오프·현재 코드가 그 개념을 어떻게 구현하는지 간단히 설명한다. (단순 사실 질의·잡담엔 불필요)
- **새 코드는 타입 안전**하게. `design/*.tsx`(icons/ui/brand-logos/data)는 `@ts-nocheck`라 타입 없음 → 화면에서 쓸 땐 [components/screens/_ui.ts](apps/web/src/components/screens/_ui.ts)에서 `UI`/`Icon`을 `any`로 캐스팅해 사용(도메인 데이터 흐름은 정상 타입검사 유지).
- 화면은 **flat `_ko/_en` 직접 접근 금지**. 도메인 타입 + `localized(text, lang)` 사용.
- **공공 API/서비스키는 서버에서만**. `server/public-api/*`, `lib/env.ts`를 클라이언트에서 import 금지.
- **데이터 출처 디버그**: `EUMGIL_DEBUG`(=`1` 또는 `http,cache,repo`)로 서버 콘솔에 출처 로그. http=공공API 실호출(✓/✗·ms), cache=HIT/MISS/SET/FLUSH, repo=DB 카탈로그·스팟 보강·코스 재정렬. 구현 [server/log.ts](apps/web/src/server/log.ts). 기본 침묵.
- env 키는 `lib/env.ts`에서 대부분 optional. 실제 필요한 기능 경로에선 `requireEnv("KEY")` 사용.
- UI 텍스트·코드 주석은 **한국어**. 강원특별자치도 = TourAPI `lDongRegnCd` **51**, 시군구 `lDongSignguCd` 3자리.
- 확정된 방향: 전체 실연동 제출 / 자연어 매칭은 키워드 우선(후반 LLM 검토). 상세 [docs/구현-계획.md](docs/구현-계획.md).
- **테스트 전략(단계적, 확정 2026-06-23)**: ① 지금 = 순수 함수 단위 테스트(matching/scoring/grid, Vitest) ② 키 실검증 직후 = API 정규화·LiveRepository 폴백(fetch 목) ③ Phase 4~5 = 화면 RTL + 핵심 플로우 E2E(Playwright). "구현 굳은 것부터" 원칙. 상세 [docs/구현-계획.md](docs/구현-계획.md) "5. 테스트 전략".
- **이 문서를 최신으로 유지할 것**: 의미 있는 마일스톤(Phase 완료, 주요 모듈 완성, 블로커 발생·해소) 시 위의 **"진행 상태 / 현재 블로커"** 섹션을 별도 요청 없이 갱신한다. 문서 전체를 다시 쓰지 말고 해당 섹션만 국소 수정(상세 체크리스트는 [docs/구현-계획.md](docs/구현-계획.md)가 정본).
