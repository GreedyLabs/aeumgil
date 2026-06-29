# Local Keycloak

로컬 SSO 검증용 Keycloak 구성이다. 운영 배포용이 아니며, `start-dev`와 고정 secret/test user를 사용한다.

## 실행

```bash
pnpm keycloak:up
pnpm keycloak:logs
pnpm --filter @eumgil/web verify:keycloak
```

Docker Desktop 또는 Docker daemon 이 먼저 실행 중이어야 한다.

## Discovery 오류 점검

`verify:keycloak` 이 `fetch failed` 를 내면 먼저 컨테이너 상태를 확인한다.

```bash
docker compose -f docker-compose.keycloak.yml ps
curl -sS http://localhost:8080/realms/eumgil/.well-known/openid-configuration
```

`ps` 에서 `eumgil-keycloak` 이 `healthy` 이고 브라우저에서 discovery URL 이 열리면 Keycloak은 정상이다.
Codex 샌드박스 같은 격리된 실행 환경에서는 일반 권한 프로세스가 호스트 `localhost:8080`에 붙지 못해
같은 오류가 날 수 있다.

접속:

- Admin console: http://localhost:8080
- Health: http://localhost:9000/health/ready
- Realm issuer: http://localhost:8080/realms/eumgil

기본 계정:

| 용도 | ID | Password |
| --- | --- | --- |
| Keycloak admin | `admin` | `admin` |
| 앱 테스트 사용자 | `demo` | `demo1234` |
| 앱 테스트 관리자 | `admin-user` | `admin1234` |

## 에움길 `.env`

```env
AUTH_KEYCLOAK_ID="eumgil-web"
AUTH_KEYCLOAK_SECRET="eumgil-local-dev-secret"
AUTH_KEYCLOAK_ISSUER="http://localhost:8080/realms/eumgil"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

GreedyLabs 공용 Keycloak 을 쓰는 경우 issuer 만 원격 realm 으로 바꾼다. client secret 은 해당
Keycloak client 의 값으로 맞춘다.

```env
AUTH_KEYCLOAK_ID="eumgil"
AUTH_KEYCLOAK_ISSUER="https://auth.greedylabs.kr/realms/eumgil"
```

Auth.js callback URL:

```text
http://localhost:3000/api/auth/callback/keycloak
```

## 초기화

Realm import 는 처음 컨테이너가 빈 DB로 뜰 때 적용된다. import JSON을 바꾼 뒤 다시 적용하려면:

```bash
pnpm keycloak:reset
pnpm keycloak:up
```

## 학습 메모

Keycloak은 Identity Provider이고, 에움길은 OIDC Client다. Keycloak이 로그인 세션과 외부 소셜 계정을 관리하고, 에움길은 `sub` claim만 앱 DB의 사용자 식별자로 사용한다.
