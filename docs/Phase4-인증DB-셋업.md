# Phase 4 — Keycloak SSO · 앱 DB(PostgreSQL) 셋업

이 문서는 에움길을 **Keycloak 기반 SSO**에 붙이고, 앱 DB에는 저장/리뷰/방문/온보딩 선호 같은 서비스 데이터만
보관하는 기준 절차다.

> 샌드박스에선 Keycloak·DB 실검증이 제한될 수 있다. 아래 검증은 로컬 실행 기준.

## 0. 구조

```text
사용자
  → 에움길 Next.js 앱(Auth.js = OIDC Client)
  → Keycloak Realm(eumgil, Identity Provider)
  → Kakao/Naver/Google 같은 외부 IdP 브로커링

에움길 DB(PostgreSQL)
  → saved_theme / review / visit / onboarding_preference / user_profile
  → user_id = Keycloak token 의 sub
```

학습 포인트:

- **Identity Provider(IdP)**: 사용자를 인증하고 토큰을 발급하는 주체. 여기서는 Keycloak.
- **Client/Relying Party**: IdP를 신뢰하고 로그인 결과를 받는 앱. 여기서는 에움길 Next.js 앱.
- **OIDC `sub` claim**: IdP 안에서 사용자를 안정적으로 식별하는 subject. 앱 DB의 `user_id`로 사용한다.
- **SSO**: 여러 서비스가 같은 IdP(Keycloak)를 신뢰해 한 계정/세션으로 로그인하는 구조.

## 1. 코드 구성

| 파일 | 역할 |
| --- | --- |
| `apps/web/src/server/auth.ts` | Auth.js 설정. Keycloak provider 하나만 사용, 세션은 JWT 전략 |
| `apps/web/src/types/next-auth.d.ts` | `session.user.id`(Keycloak sub)·`roles` 타입 확장 |
| `apps/web/src/server/db/schema.ts` | 앱 도메인 테이블(saved_theme/review/visit/onboarding_preference/user_profile). Auth.js adapter 테이블 없음 |
| `apps/web/src/server/db/user-data.ts` | `(db, keycloakSub)` 기준 저장/리뷰/방문/온보딩 선호/앱 프로필 조회·쓰기 |
| `apps/web/src/data/live/repository.ts` | `auth()` 세션의 `session.user.id`(Keycloak sub) → 앱 DB 조회 |
| `apps/web/src/app/api/auth/[...nextauth]/route.ts` | `/api/auth/*` 핸들러 |

의존성:

- 유지: `next-auth`, `drizzle-orm`, `postgres`, `drizzle-kit`
- 제거: `@auth/drizzle-adapter` (세션/계정 원장은 Keycloak 책임)

## 2. 환경변수

루트 `.env`:

```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
DATA_SOURCE="live"

DATABASE_URL="postgresql://postgres:eumgil@localhost:5432/eumgil"
DATABASE_SCHEMA=""

AUTH_SECRET="..." # openssl rand -base64 32
AUTH_URL="http://localhost:3000"

AUTH_KEYCLOAK_ID="eumgil-web"
AUTH_KEYCLOAK_SECRET="eumgil-local-dev-secret"
AUTH_KEYCLOAK_ISSUER="http://localhost:8080/realms/eumgil"
```

개발 기본값은 `AUTH_KEYCLOAK_ISSUER=http://localhost:8080/realms/eumgil`,
`AUTH_KEYCLOAK_ID=eumgil-web`, `AUTH_KEYCLOAK_SECRET=eumgil-local-dev-secret` 이다.

GreedyLabs 공용 Keycloak 을 쓰는 경우:

```env
AUTH_KEYCLOAK_ID="eumgil"
AUTH_KEYCLOAK_ISSUER="https://auth.greedylabs.kr/realms/eumgil"
```

이때 Keycloak client 의 Valid redirect URI / Web origins 는 앱 도메인별로 추가해야 한다.

```text
http://localhost:3000/api/auth/callback/keycloak
https://서비스도메인/api/auth/callback/keycloak
```

로그아웃 후 돌아올 주소는 `NEXT_PUBLIC_APP_URL` 이므로, 운영 배포에서는 `AUTH_URL` 과
`NEXT_PUBLIC_APP_URL` 을 실제 서비스 URL 로 맞춘다.

## 3. 세션/JWT 정책

에움길은 앱 DB에 세션 테이블을 만들지 않는다. 세션 계층은 다음처럼 나눈다.

```text
Keycloak
  - 실제 로그인 세션
  - 외부 IdP 연결
  - access/id/refresh token 발급

Auth.js
  - 앱 내부 HttpOnly JWT cookie session
  - token.sub → session.user.id
  - Keycloak roles → session.user.roles

에움길 DB
  - saved_theme/review/visit/onboarding_preference/user_profile
  - user_id = session.user.id = Keycloak sub
```

`apps/web/src/server/auth.ts` 정책:

- `session.strategy = "jwt"`: Auth.js adapter DB 세션을 쓰지 않는다.
- `session.maxAge = jwt.maxAge = 8시간`: 운영 전 Keycloak realm session timeout 과 함께 조정한다.
- `jwt` callback: Keycloak `sub`, `access_token`, `id_token`, `refresh_token`, roles 를 서버 쿠키(JWE)에 정리한다.
- `jwt` callback: access token 만료 60초 전부터 Keycloak token endpoint 에 refresh token grant 로 갱신한다.
- `session` callback: 브라우저에는 `id`와 `roles`만 노출한다. provider access token 은 client session 으로 내보내지 않는다.
- 로그아웃: 앱 세션 삭제 전에 `/api/auth/keycloak/logout?format=json` 으로 `id_token_hint` 포함 end-session URL 을 받은 뒤 Auth.js 쿠키를 지우고 Keycloak SSO 세션까지 종료한다.

학습 포인트:

- Auth.js JWT 는 이 앱이 발급·해석하는 **앱 내부 세션 토큰**이다.
- Keycloak access token 은 Keycloak 이 보호하는 API 호출용 토큰이다.
- 둘을 같은 JWT 라고 뭉뚱그리면 안 된다. 발급자, 대상, 검증 주체가 다르다.

## 4. 앱 DB 준비

로컬 Docker 예시:

```bash
docker run --name eumgil-pg -e POSTGRES_PASSWORD=eumgil -e POSTGRES_DB=eumgil \
  -p 5432:5432 -d postgres:16
```

스키마 적용:

```bash
pnpm --filter @eumgil/web verify:db
pnpm --filter @eumgil/web db:apply
pnpm --filter @eumgil/web verify:db
```

`db:push`는 기존 DB 전체를 diff 하면서 `review`/`visit` primary key 제약을 건드릴 수 있다.
이 프로젝트의 현재 로컬 개발 DB에는 `db:apply`를 기본 경로로 쓴다. 이 스크립트는 앱 도메인 테이블만
`create/alter if not exists`로 생성·보정하고 기존 데이터를 drop 하지 않는다.

```bash
pnpm --filter @eumgil/web db:apply
pnpm --filter @eumgil/web verify:db
```

생성 대상 테이블:

- `saved_theme`
- `review`
- `visit`
- `onboarding_preference`
- `user_profile`

Auth.js의 `user/account/session/verificationToken` 테이블은 만들지 않는다.

## 5. Keycloak 준비

로컬 Keycloak 은 별도 compose 파일로 제공한다.

```bash
pnpm keycloak:up
pnpm keycloak:logs
```

Docker Desktop 또는 Docker daemon 이 실행 중이어야 한다.

구성 파일:

| 파일 | 역할 |
| --- | --- |
| `docker-compose.keycloak.yml` | 로컬 Keycloak + Keycloak 전용 Postgres |
| `infra/keycloak/import/eumgil-realm.json` | `eumgil` realm/client/test user import |
| `infra/keycloak/README.md` | 로컬 Keycloak 실행 메모 |

기본 접속:

- Admin console: `http://localhost:8080`
- Admin: `admin` / `admin`
- Realm issuer: `http://localhost:8080/realms/eumgil`
- Client: `eumgil-web`
- Client secret: `eumgil-local-dev-secret`
- Demo user: `demo` / `demo1234`
- Admin test user: `admin-user` / `admin1234`

Realm import 는 빈 Keycloak DB에서 처음 뜰 때 적용된다. import JSON 변경을 다시 반영하려면:

```bash
pnpm keycloak:reset
pnpm keycloak:up
```

Keycloak 서버가 준비되면:

1. Realm 생성: `eumgil`
2. Client 생성: `eumgil-web`
3. Client type: OpenID Connect
4. Access type: confidential
5. Valid redirect URI:
   ```text
   http://localhost:3000/api/auth/callback/keycloak
   ```
6. Web origins:
   ```text
   http://localhost:3000
   ```
7. Client secret 을 `.env`의 `AUTH_KEYCLOAK_SECRET`에 입력

운영 도메인에서는 아래처럼 바꾼다:

```text
https://서비스도메인/api/auth/callback/keycloak
```

## 6. 외부 소셜 Provider 브로커링

에움길 앱은 Kakao/Naver/Google을 직접 붙이지 않는다. Keycloak에 Identity Provider로 등록한다.

- Google: Keycloak 기본 social provider로 우선 검증하기 좋음
- Kakao: OIDC/OAuth provider로 등록, profile claim mapping 확인 필요
- Naver: OIDC/OAuth provider로 등록, profile claim mapping 확인 필요

앱 입장에서는 어떤 외부 provider로 로그인했는지와 무관하게 Keycloak이 발급한 `sub`만 안정적으로
받으면 된다.

## 7. 검증 체크리스트

```bash
pnpm --filter @eumgil/web typecheck
pnpm --filter @eumgil/web test
pnpm --filter @eumgil/web build
pnpm --filter @eumgil/web verify:keycloak
pnpm dev
```

브라우저:

1. `http://localhost:3000/api/auth/providers`
   - `keycloak` provider가 보이면 Auth.js 설정 정상.
2. `/login`
   - “통합 계정으로 시작하기” 버튼 클릭.
3. Keycloak 로그인 성공 후 `/profile`로 복귀.
4. `/course/{themeId}`에서 저장/해제.
5. DB `saved_theme.user_id`가 Keycloak `sub`로 저장되는지 확인.

추가 API 확인:

```bash
curl -s http://localhost:3000/api/auth/providers
curl -s http://localhost:3000/api/auth/session
```

비로그인 상태에서 session 은 `null`, providers 는 `keycloak` 하나를 반환하면 정상이다.

`verify:keycloak` 이 `fetch failed` 를 내면:

```bash
docker compose -f docker-compose.keycloak.yml ps
curl -sS http://localhost:8080/realms/eumgil/.well-known/openid-configuration
```

컨테이너가 `healthy` 이고 브라우저에서 discovery URL 이 열리면 Keycloak은 정상이다. Codex 샌드박스처럼
격리된 실행 환경에서는 일반 권한 프로세스가 호스트 `localhost:8080`에 붙지 못해 같은 오류가 날 수 있다.

원격 GreedyLabs Keycloak discovery 검증:

```bash
AUTH_KEYCLOAK_ISSUER="https://auth.greedylabs.kr/realms/eumgil" \
  pnpm --filter @eumgil/web verify:keycloak
```

2026-06-29 기준 `https://auth.greedylabs.kr/realms/eumgil/.well-known/openid-configuration` 은 HTTP 200.

## 8. 다음 작업

- Google → Kakao → Naver 순 Keycloak identity provider 검증은 후순위.
- 리뷰/방문 수정·삭제 액션 추가.
- 스팟 북마크 UX 를 테마 저장 모델과 정리.
