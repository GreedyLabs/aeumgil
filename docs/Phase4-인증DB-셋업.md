# Phase 4 — Keycloak SSO · 앱 DB(PostgreSQL) 셋업

이 문서는 에움길을 **Keycloak 기반 SSO**에 붙이고, 앱 DB에는 저장/리뷰/방문 같은 서비스 데이터만
보관하는 기준 절차다.

> 샌드박스에선 Keycloak·DB 실검증이 제한될 수 있다. 아래 검증은 로컬 실행 기준.

## 0. 구조

```text
사용자
  → 에움길 Next.js 앱(Auth.js = OIDC Client)
  → Keycloak Realm(eumgil, Identity Provider)
  → Kakao/Naver/Google 같은 외부 IdP 브로커링

에움길 DB(PostgreSQL)
  → saved_theme / review / visit
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
| `apps/web/src/server/db/schema.ts` | 앱 도메인 테이블(saved_theme/review/visit). Auth.js adapter 테이블 없음 |
| `apps/web/src/server/db/user-data.ts` | `(db, keycloakSub)` 기준 저장/리뷰/방문 조회·쓰기 |
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
AUTH_KEYCLOAK_SECRET="..."
AUTH_KEYCLOAK_ISSUER="http://localhost:8080/realms/eumgil"
```

개발 기본값은 `AUTH_KEYCLOAK_ISSUER=http://localhost:8080/realms/eumgil`,
`AUTH_KEYCLOAK_ID=eumgil-web` 이다. 실제 로그인 검증에는 client secret 이 필요하다.

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
  - saved_theme/review/visit
  - user_id = session.user.id = Keycloak sub
```

`apps/web/src/server/auth.ts` 정책:

- `session.strategy = "jwt"`: Auth.js adapter DB 세션을 쓰지 않는다.
- `session.maxAge = jwt.maxAge = 8시간`: 운영 전 Keycloak realm session timeout 과 함께 조정한다.
- `jwt` callback: Keycloak `sub`, `access_token`, `id_token`, `refresh_token`, roles 를 서버 쿠키(JWE)에 정리한다.
- `session` callback: 브라우저에는 `id`와 `roles`만 노출한다. provider access token 은 client session 으로 내보내지 않는다.

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
pnpm --filter @eumgil/web db:push
```

생성 대상 테이블:

- `saved_theme`
- `review`
- `visit`

Auth.js의 `user/account/session/verificationToken` 테이블은 만들지 않는다.

## 5. Keycloak 준비

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

## 8. 다음 작업

- 로컬 Keycloak Docker Compose 추가.
- Keycloak realm/client/import JSON 작성.
- Google → Kakao → Naver 순으로 Keycloak identity provider 검증.
- Keycloak end-session endpoint 로 SSO 로그아웃 연결.
- 보호 라우트 세션 가드 적용.
- 리뷰/방문 쓰기 Server Action/Form 추가.
