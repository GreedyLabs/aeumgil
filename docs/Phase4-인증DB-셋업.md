# Phase 4 — 인증(Auth.js) · DB(Drizzle/PostgreSQL) 셋업

이 슬라이스는 **스키마 + Auth.js 골격 + 마이그레이션**까지다. 실제 데이터 영속(저장/리뷰/방문
읽기·쓰기, app-shell mock 인증 대체)은 **다음 슬라이스**. 이 문서는 골격을 로컬에서 돌려보고
검증하는 절차다.

> 샌드박스에선 DB·OAuth 검증이 불가하여 코드만 작성됨. 아래는 **로컬 실행 기준**.

## 0. 추가된 것

| 파일 | 역할 |
| --- | --- |
| `apps/web/src/server/db/schema.ts` | Drizzle 스키마 — Auth.js 표준(user/account/session/verificationToken) + 앱(saved_theme/review/visit) |
| `apps/web/src/server/db/index.ts` | DB 클라이언트(auth 라우트만 import — mock 화면은 DATABASE_URL 불요, 연결은 첫 쿼리 시 lazy) |
| `apps/web/src/server/auth.ts` | Auth.js 설정(DrizzleAdapter + 카카오/네이버/구글/애플) |
| `apps/web/src/app/api/auth/[...nextauth]/route.ts` | `/api/auth/*` 핸들러 |
| `apps/web/drizzle.config.ts` | drizzle-kit 설정(루트 `.env` 로드) |

새 의존성: `next-auth@5`, `@auth/drizzle-adapter`, `drizzle-orm`, `postgres`, (dev) `drizzle-kit`.

## 1. 설치

```bash
pnpm install
```

## 2. PostgreSQL 준비

로컬 Docker 예시:

```bash
docker run --name eumgil-pg -e POSTGRES_PASSWORD=eumgil -e POSTGRES_DB=eumgil \
  -p 5432:5432 -d postgres:16
```

`.env`(모노레포 루트)에 연결 문자열 설정:

```
DATABASE_URL="postgresql://postgres:eumgil@localhost:5432/eumgil"
# DB 스키마가 public 이 아니면 스키마명을 지정(비우면 public)
DATABASE_SCHEMA="eumgil"
```

> **비-public 스키마**: `DATABASE_SCHEMA` 를 채우면 모든 테이블이 해당 스키마에 정의·생성된다
> (`db/schema.ts` 가 `pgSchema(name)` 로 전환, drizzle.config 의 `schemaFilter` 도 그 스키마로 한정).
> 그 스키마에 **이미 다른 테이블이 있다면** `db:push` 가 "drizzle 스키마에 없는 테이블"을 삭제하자고
> 물을 수 있으니 출력 프롬프트를 꼭 확인할 것(엔터로 무심코 승인 금지). 안전하게 가려면 `db:push`
> 대신 `db:generate`(SQL 검토) → `db:migrate` 를 권장. 대상 스키마는 미리 존재해야 한다
> (`CREATE SCHEMA IF NOT EXISTS eumgil;`).

## 3. 스키마 적용

```bash
# 개발 중 빠른 동기화(마이그레이션 파일 없이 DB에 직접 반영)
pnpm --filter @eumgil/web db:push

# 또는 마이그레이션 파일 기반(권장 — 이력 관리)
pnpm --filter @eumgil/web db:generate   # drizzle/ 에 SQL 생성
pnpm --filter @eumgil/web db:migrate

# 테이블 확인(브라우저 GUI)
pnpm --filter @eumgil/web db:studio
```

`user / account / session / verificationToken / saved_theme / review / visit` 7개 테이블이
생기면 정상.

## 4. Auth.js 환경변수

`.env` 에 채운다(이미 키 항목은 `.env.example` 에 있음):

```
AUTH_SECRET="..."          # npx auth secret  또는  openssl rand -base64 32
AUTH_URL="http://localhost:3000"

AUTH_KAKAO_ID="..."        AUTH_KAKAO_SECRET="..."
AUTH_NAVER_ID="..."        AUTH_NAVER_SECRET="..."
AUTH_GOOGLE_ID="..."       AUTH_GOOGLE_SECRET="..."
AUTH_APPLE_ID="..."        AUTH_APPLE_SECRET="..."   # 애플은 client secret 이 JWT
```

### 각 제공자 콘솔에 등록할 Redirect URI (개발)

| 제공자 | 콜백 URL |
| --- | --- |
| 카카오 | `http://localhost:3000/api/auth/callback/kakao` |
| 네이버 | `http://localhost:3000/api/auth/callback/naver` |
| 구글 | `http://localhost:3000/api/auth/callback/google` |
| 애플 | `http://localhost:3000/api/auth/callback/apple` |

- **카카오**: developers.kakao.com → 앱 → 카카오 로그인 활성화 → Redirect URI 등록. REST API 키 = `AUTH_KAKAO_ID`, 보안의 Client Secret = `AUTH_KAKAO_SECRET`.
- **네이버**: developers.naver.com → 애플리케이션 등록 → 로그인 오픈API → Callback URL. Client ID/Secret.
- **구글**: console.cloud.google.com → OAuth 2.0 클라이언트 → 승인된 리디렉션 URI.
- **애플**: developer.apple.com → Sign in with Apple. Service ID = `AUTH_APPLE_ID`, client secret(JWT)을 생성해 `AUTH_APPLE_SECRET` 에. (가장 손이 많이 감 — 우선순위 낮으면 나중에.)

## 5. 검증 체크리스트

1. `pnpm typecheck` — 설치 후 통과해야 함(설치 전엔 모듈 미해결로 실패하는 게 정상).
2. `pnpm build` — auth 라우트 포함 빌드 성공.
3. `pnpm dev` 후:
   - `GET http://localhost:3000/api/auth/providers` → 등록된 4개 제공자 JSON 이 보이면 라우트·설정 정상.
   - `http://localhost:3000/api/auth/signin` → 제공자 버튼이 뜨는 기본 로그인 페이지.
   - 키를 채운 제공자로 로그인 → DB `user`/`account`/`session` 에 행이 생기면 어댑터·DB 연결 성공(`db:studio` 로 확인).
4. **mock 모드 무중단 확인**: 일반 화면(`/`, `/discover` 등)은 db 를 import 하지 않으므로 `DATABASE_URL` 없이도 `pnpm dev` 로 정상. (단 `pnpm build` 는 auth 라우트를 컴파일하므로 DATABASE_URL 필요.)

## 6. 다음 슬라이스 (예고)

- `Repository.getCurrentUser` 를 `auth()` 세션 → DB `user` 조회로 교체(현재 mock).
- `saved_theme/review/visit` 읽기·쓰기 메서드 추가 → app-shell 의 클라이언트 mock 상태 대체.
- 보호 라우트(`/profile`, `/saved`)에 세션 가드.
