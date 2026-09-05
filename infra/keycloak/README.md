# Local Keycloak

에움길 로그인 테마와 공용 Keycloak 배포 적용은 [THEME.md](THEME.md)를 참고한다. 테마 변경에는 realm 초기화가 필요하지 않다.

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

## 소셜 로그인 브로커 (카카오 / 네이버 / 구글)

realm import(`eumgil-realm.json`)에 IdP 3종이 선언돼 있다. 자격증명은 하드코딩하지 않고
`${SOCIAL_*}` 플레이스홀더로 두었고, import 시 환경변수로 치환된다(Keycloak 기본 동작) —
compose 가 루트 `.env` 의 `SOCIAL_*` 값을 컨테이너에 전달한다.

| IdP | 방식 | 비고 |
| --- | --- | --- |
| 구글 | Keycloak 내장 `google` 프로바이더 | 설정만 필요 |
| 카카오 | 범용 OIDC 프로바이더 (`kauth.kakao.com`) | 카카오 앱에서 **OpenID Connect 활성화 필수**, 토큰 인증은 `client_secret_post`(카카오는 Basic 미지원) |
| 네이버 | 커스텀 SPI ([senshilabs/keycloak-naver-social-provider](https://github.com/senshilabs/keycloak-naver-social-provider)) | 네이버는 OIDC 미지원이라 플러그인 필요. **Keycloak 26.6.1 동작 확인(2026-07-13)** |

### 1) 네이버 SPI jar 다운로드 (최초 1회)

jar 는 git 미추적(바이너리)이라 클론 직후 받아야 한다:

```bash
pnpm keycloak:providers   # infra/keycloak/providers/ 에 다운로드
```

### 2) 각 개발자센터에서 앱 생성

공통 Redirect(Callback) URI 형식 — `{keycloak-origin}/realms/eumgil/broker/{alias}/endpoint`:

| IdP | 로컬 Redirect URI |
| --- | --- |
| 카카오 | `http://localhost:8080/realms/eumgil/broker/kakao/endpoint` |
| 네이버 | `http://localhost:8080/realms/eumgil/broker/naver/endpoint` |
| 구글 | `http://localhost:8080/realms/eumgil/broker/google/endpoint` |

- **카카오** ([developers.kakao.com](https://developers.kakao.com)): 애플리케이션 추가 → 카카오 로그인 **활성화** + **OpenID Connect 활성화** → Redirect URI 등록 → 동의항목(닉네임·프로필사진·**카카오계정 이메일**) 설정 → [보안]에서 Client Secret 생성·활성화. `SOCIAL_KAKAO_CLIENT_ID` 에는 **REST API 키**를 넣는다. 이메일 동의항목은 비즈 앱 전환이 필요할 수 있다.
- **네이버** ([developers.naver.com](https://developers.naver.com)): 애플리케이션 등록 → 사용 API "네이버 로그인" → 제공 정보(이메일·별명·프로필사진) 필수 동의 → 서비스 URL `http://localhost:3000`, Callback URL 위 표 값. SPI 매퍼가 attribute 를 채우려면 제공 정보 동의가 설정돼 있어야 한다.
- **구글** ([console.cloud.google.com](https://console.cloud.google.com)): 프로젝트 → OAuth 동의 화면 구성(외부) → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션) → 승인된 리디렉션 URI 에 위 표 값.

### 3) 반영 및 검증

```bash
# .env 에 SOCIAL_* 6개 채운 뒤 (realm import 는 빈 DB에서만 적용되므로 reset 필요)
pnpm keycloak:reset && pnpm keycloak:up
pnpm --filter @eumgil/web verify:keycloak
```

`http://localhost:3000/login` → Keycloak 로그인 화면에 카카오/네이버/Google 버튼 →
각 IdP 왕복 → 앱 프로필 화면에 이메일/이름 표시까지 확인한다.

이미 쓰던 로컬 realm 을 초기화하고 싶지 않으면 reset 대신 Admin console →
Identity providers 에서 수동으로 같은 값을 추가해도 된다(운영 Keycloak 적용 방식과 동일).

### 운영 적용 시 (플랜 §1.2)

- 운영 Keycloak 의 Admin console 에서 동일 구성(또는 이 realm JSON 참고) — Redirect URI 의
  origin 만 운영 Keycloak 도메인으로 교체해 **각 개발자센터와 Keycloak 양쪽**에 등록.
- 카카오/네이버 앱은 검수(운영) 전환 전까지 팀원 계정만 로그인 가능(플랜 §7.2, 리드타임 있음).
- 앱에서 특정 IdP 로 바로 보내려면 Auth.js `signIn("keycloak", ...)` 호출에
  `kc_idp_hint=kakao|naver|google` 파라미터를 넘기면 Keycloak 중간 화면을 건너뛴다(선택).

## 초기화

Realm import 는 처음 컨테이너가 빈 DB로 뜰 때 적용된다. import JSON을 바꾼 뒤 다시 적용하려면:

```bash
pnpm keycloak:reset
pnpm keycloak:up
```

## 학습 메모

Keycloak은 Identity Provider이고, 에움길은 OIDC Client다. Keycloak이 로그인 세션과 외부 소셜 계정을 관리하고, 에움길은 `sub` claim만 앱 DB의 사용자 식별자로 사용한다.
