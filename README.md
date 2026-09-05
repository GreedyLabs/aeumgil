# 에움길 (Eumgil)

강원특별자치도 여행을 **목적 입력 → 추천 코스 비교 → 내 일정 편집**으로 계획하는 웹 서비스입니다.

[운영 서비스](https://에움길.한국) · [문서 안내](docs/README.md) · [서비스 기획](docs/제안서.md) · [개발자 컨텍스트](AGENTS.md)

- 자연어 여행 목적과 테마 키워드로 추천을 찾고, 지역·여행지·행사를 탐색합니다.
- 실제 관광정보·날씨·대기질·집중률 예측·무장애 안내를 판단 근거로 제공합니다.
- 추천을 복사하거나 빈 일정에서 개인 코스를 만들고 날짜·순서·체류시간을 편집합니다.
- 지도는 장소 위치와 방문 순서를 보여줍니다. 이동시간은 좌표 기반 추정이며 실시간 길찾기는 제공하지 않습니다.

## 개발 시작

Node.js 22 이상과 `package.json`에 지정된 pnpm 10.23.0을 사용합니다. 카탈로그 수집 명령은 Node.js의 TypeScript 실행 기능을 사용합니다.

```bash
pnpm install
cp .env.example .env
# .env에 DB·인증·공공 API 값을 입력
pnpm dev
```

카탈로그·사용자 데이터는 실제 DB를 사용하며 런타임 샘플 데이터로 대체하지 않습니다. 로컬 앱도 `https://auth.greedylabs.kr/realms/eumgil`의 기존 인증 서버에 연결합니다. `.env`의 Client Secret과 localhost 콜백 허용 주소를 확인하고 별도 Keycloak 컨테이너는 실행하지 않습니다. 설정은 [환경변수·배포](docs/환경변수-배포.md), DB 준비는 [인증·DB](docs/Phase4-인증DB-셋업.md)를 참고하세요.

```bash
pnpm --filter @eumgil/web exec next typegen
pnpm typecheck
pnpm --filter @eumgil/web test
pnpm build
```

브라우저·API 검사는 [검증 안내](docs/검증.md)를 따릅니다.

## 구조

| 위치                     | 역할                                                |
| ------------------------ | --------------------------------------------------- |
| `apps/web`               | Next.js 15 App Router · React 19 · TypeScript 웹 앱 |
| `packages/ui`            | 공용 UI 패키지                                      |
| `apps/web/src/domain`    | 도메인 모델·추천·검색·코스 계산                     |
| `apps/web/src/data/live` | 화면에 DB와 공공 API 데이터를 제공하는 Repository   |
| `apps/web/src/server`    | DB·Auth.js/Keycloak·API·캐시·선택적 에이전트        |
| `infra/keycloak`         | 운영 인증 테마 소스·Gitops 반영 안내                |
| `docs`                   | 현행 기획·아키텍처·운영·검증·별도 AI 학습 자료      |

운영은 GitHub Actions → GHCR 이미지 → 별도 Gitops 저장소의 Dockhand 스택으로 배포합니다. 환경별 비밀값은 Git에 저장하지 않습니다.
