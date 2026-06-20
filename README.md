# 에움길 (Eumgil)

강원도 특화 테마 관광 추천 서비스 — 관광데이터 공모전 출품작.

여행 목적을 자연어로 입력하면 강원도 특화 테마 코스를 추천하고, 한국관광공사 OpenAPI의
혼잡도·방문 적합성 데이터와 기상·대기질·교통 공공데이터를 결합해 더 쾌적한 여행 결정을 돕습니다.

## 기술 스택

- **모노레포**: pnpm workspaces
- **프레임워크**: Next.js 15 (App Router) · React 19
- **언어**: TypeScript
- **스타일**: Tailwind CSS v4

## 디렉터리 구조

```
.
├── apps/
│   └── web/          # Next.js 웹 애플리케이션
├── packages/
│   └── ui/           # 공용 UI 컴포넌트 (@eumgil/ui)
└── docs/             # 기획/제안 문서
```

## 시작하기

```bash
pnpm install      # 의존성 설치
pnpm dev          # 개발 서버 (http://localhost:3000)
pnpm build        # 프로덕션 빌드
pnpm typecheck    # 타입 검사
pnpm lint         # 린트
```
