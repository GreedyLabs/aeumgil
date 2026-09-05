# 인증과 DB 설정

에움길은 Keycloak의 OIDC Client이며 Auth.js JWT 세션을 사용한다. Keycloak이 사용자 신원·비밀번호·Google 연결·인증 세션을 관리하고 앱 DB는 여행과 활동 데이터만 보관한다.

## 인증 관계

```text
브라우저 → 에움길 Auth.js → Keycloak eumgil realm → Google(선택)
             ↓                    ↓
       앱 세션 쿠키            신원·SSO 세션
             ↓
    Keycloak sub로 앱 DB 접근
```

OAuth Client Secret은 앱이 Keycloak에 자신의 신원을 증명하는 값이다. `AUTH_SECRET`은 별도로 Auth.js 세션을 암호화하는 값이며 서로 바꿔 쓰지 않는다. Google Client Secret은 Keycloak에만 둔다.

| 항목                   | 운영 설정                                                         |
| ---------------------- | ----------------------------------------------------------------- |
| Issuer                 | `https://auth.greedylabs.kr/realms/eumgil`                        |
| 앱 Client ID           | `eumgil`                                                          |
| 앱 URL                 | `https://xn--wk0bk16buua.xn--3e0b707e`                            |
| 앱 Callback            | `/api/auth/callback/keycloak`                                     |
| Google 브로커 Callback | `https://auth.greedylabs.kr/realms/eumgil/broker/google/endpoint` |
| 앱 세션                | 암호화 JWT 쿠키, 최대 8시간                                       |

운영 Keycloak은 26.6.3이며 에움길 테마·한국어/영어·Google 버튼을 확인했다. 실제 Google 계정 왕복과 SMTP는 [검증 기록](검증.md)에서 별도로 추적한다. 로컬 import의 기본 `eumgil-web` Client는 운영 Client ID와 다르다.

## 로그인·토큰·로그아웃

[auth.ts](../apps/web/src/server/auth.ts)는 Keycloak 토큰의 `sub`와 역할을 세션에 연결한다. provider access/id/refresh 토큰은 서버의 암호화 쿠키에 보관하고 브라우저가 읽는 세션에 노출하지 않는다. access token은 만료 60초 전부터 refresh token으로 갱신하며 실패 상태는 `session.authError`로 전달한다.

보호 화면과 쓰기 액션은 서버에서 사용자 `sub`를 요구한다. 개인 코스 조회/수정/삭제는 DB에서도 사용자 조건을 적용한다. 로그인 복귀 URL은 허용된 앱 경로만 사용하며 개인 코스·행사 경로를 포함한다.

[logoutAction](../apps/web/src/app/actions/logout.ts)은 다음 순서로 동작한다.

1. 앱 쿠키를 제거하기 전에 서버에서 ID 토큰을 읽는다.
2. Auth.js 세션 쿠키를 삭제한다.
3. `id_token_hint`와 `post_logout_redirect_uri`를 포함한 Keycloak end-session으로 이동한다.

이 순서로 앱 세션만 지운 뒤 즉시 SSO 재로그인되는 상황과 불필요한 추가 확인을 줄인다. ID 토큰이 없는 비정상 세션은 같은 확인창 없는 종료를 보장하지 않는다. [session-token.ts](../apps/web/src/server/session-token.ts)는 HTTPS 접두사와 분할 쿠키를 처리한다.

## 앱 DB 준비

`.env`에 `DATABASE_URL`을 넣는다. 필요한 경우 `DATABASE_SCHEMA`도 지정한다. 상세 환경변수는 [배포 안내](환경변수-배포.md)를 따른다.

```bash
pnpm --filter @eumgil/web db:apply
pnpm --filter @eumgil/web verify:db
pnpm --filter @eumgil/web db:collect:gangwon
pnpm --filter @eumgil/web db:collect:gangwon --apply
pnpm --filter @eumgil/web db:sync:accessibility --apply
```

`db:apply`는 [현재 스키마 적용 스크립트](../apps/web/scripts/apply-app-schema.mjs)를 실행한다. 카탈로그 수집의 `--apply`는 실제 DB를 수정하므로 대상 DB와 검토 결과를 확인하고 실행한다. 앱 부팅 시 자동 수집하지 않는다. 폐기한 프로토타입 시드 명령을 신규 DB 준비에 사용하지 않는다.

| 테이블                                    | 역할                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `spot_profile`                            | 원천 콘텐츠 ID·관광지·좌표·사진·검색 분류·무장애 안내 보유             |
| `course_template`, `course_template_item` | 추천 테마와 일정 틀                                                    |
| `commerce_profile`                        | 실제 음식점·숙박                                                       |
| `saved_theme`                             | 사용자가 보관한 추천 테마 ID                                           |
| `personal_course`                         | 소유자·일정 항목·이름·메모·여행 날짜·이동수단·하루 출발 시간·수정 버전 |
| `review`, `visit`                         | 사용자 리뷰·방문 기록                                                  |
| `onboarding_preference`, `user_profile`   | 앱 취향·표시명·소개                                                    |

Auth.js adapter용 users/accounts/sessions 테이블은 사용하지 않는다. 신원은 Keycloak, 앱 프로필과 여행 데이터는 PostgreSQL이라는 경계를 유지한다.

## 개인 데이터 변경

Server Action이 세션과 입력을 검사하고 Repository/DB 계층이 소유자 조건을 적용한다. 개인 코스는 조회한 버전과 현재 버전이 다르면 충돌을 반환한다. 기존 코스에 장소를 추가하는 액션도 저장 시 버전을 재검사한다. 다른 탭의 변경을 마지막 저장으로 무조건 덮어쓰지 않는다.

`personal_course.start_date`와 `end_date`는 nullable PostgreSQL DATE이며 앱에는 `YYYY-MM-DD` 문자열로 전달한다. 이전 코스의 두 값은 NULL(날짜 미정)로 남긴다. `db:apply`가 두 컬럼을 멱등 추가하므로 새 앱 배포 전에 적용하고 `verify:db`로 확인한다. 날짜를 지정할 때는 둘 다 필요하며 종료일이 시작일보다 빠르거나 항목의 일차가 기간을 넘으면 저장을 거절한다. 날짜 미정으로 전환하면 두 컬럼을 NULL로 저장하고 기존 장소의 일차·순서를 유지한다. 5일 제한은 없으며 장소는 최대 30곳이다. 기존 코스 담기도 저장된 날짜 범위를 검증한다.

`transport`는 car/transit/walk, `start_time`은 HH:mm으로 저장한다. 이전 행의 기본값은 car/09:30이다. `day_start_times`는 일차별 출발 시각 예외를 담는 JSONB이며 기본값은 `{}`다. 추천 복사 시 현재 이동 방식과 날짜별 첫 출발 시각을 가져오므로 첫날 오후 도착과 다음 날 오전 시작을 보존한다. 해당 일차의 예외가 없으면 `start_time`을 쓴다. `db:apply`는 이 컬럼도 멱등 추가한다.

편집 초안은 같은 탭의 sessionStorage에 계정별로 격리한다. 서버 버전이 같으면 자동 복원하고, 다르면 기존 DB를 덮어쓰지 않고 새 코스로 복구하는 선택을 제공한다. 로그아웃 후 다른 사용자에게 같은 초안을 연결하지 않으며 DB 저장과 임시 저장을 구분한다. 이전 버전 백업은 최신 편집 초안과 별도 키에 보존하며, 복구본 DB 저장이 성공한 뒤 동일 사용자·원본 버전 조건을 확인해 정리한다.

탈퇴는 앱 데이터 6개 테이블을 삭제한 뒤 Keycloak 계정 삭제를 시도한다. 자동 삭제를 쓰려면 별도 service account Client에 `realm-management/manage-users` 역할을 부여하고 `KEYCLOAK_ADMIN_CLIENT_ID`·`KEYCLOAK_ADMIN_CLIENT_SECRET`을 설정한다. 앱의 일반 로그인 Client Secret과는 다른 권한이다.

관리 Client 미설정 또는 삭제 실패 시 앱 DB는 삭제되지만 Keycloak 계정은 남을 수 있다. 액션 결과의 `keycloakDeleted`와 서버 로그를 확인하고 운영자가 동일 `sub`의 인증 계정을 수동 정리한다. 다른 GreedyLabs 서비스와의 신원 공유 정책도 함께 고려해야 한다.

## Keycloak 테마·로컬 미리보기

테마 소스는 [infra/keycloak/themes/eumgil](../infra/keycloak/themes/eumgil), 배포 방식은 [테마 안내](../infra/keycloak/THEME.md)에 있다. 운영 배포는 별도 Gitops 저장소의 Keycloak Compose를 사용한다. 로컬 Compose의 초기 realm import를 운영 realm 갱신 방법으로 쓰지 않는다.

테마 선택은 realm의 Login theme 설정에서 확인한다. CSS/아이콘을 변경한 경우 실제 응답 자산과 브라우저 캐시를 함께 확인한다. 파비콘 URL 버전을 바꾸는 코드가 포함되어 있다. 에움길 앱의 파비콘과 인증 서버의 파비콘은 서로 다른 배포 자산이다.

```bash
pnpm --filter @eumgil/web verify:keycloak
```

이 명령의 discovery/Client 인증 성공은 사용자 로그인 완료를 뜻하지 않는다. 세션 픽스처 기반 앱 E2E, 독립 Keycloak 미리보기, 운영 Google 인증을 구분해서 기록한다.
