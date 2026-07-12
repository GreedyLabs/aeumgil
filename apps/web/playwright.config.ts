// ─────────────────────────────────────────────
// Playwright E2E 설정 (운영-준비-플랜 §8.1).
//
// 실행 전제: 실 DB 연결(.env DATABASE_URL). 공공 API 는 실패해도 화면이
// DB 기본값으로 렌더되므로(폴백 설계) 테스트는 값의 "유무"만 확인한다.
// dev 서버가 이미 떠 있으면 재사용, 없으면 여기서 띄운다.
//
// [CI 편입 결정 2026-07-12] 로컬 전용으로 시작 — CI 에는 DB·공공 API egress 가
// 없어 별도 픽스처 구축 비용이 크다. deploy.yml 게이트는 유닛(§8.3)까지,
// E2E 는 배포 전 로컬 1회(§8.2 스모크와 함께)로 운용한다.
// ─────────────────────────────────────────────

import { defineConfig } from "@playwright/test";
import { loadRootEnv } from "./e2e/helpers/env";

loadRootEnv();

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // 콜드 캐시 공공 API 팬아웃(30s+)에 더해, 재사용한 dev 서버가 실 LLM
  // (EUMGIL_AGENT_LLM=openai, 로컬 4B 모델 호출당 10~15s)로 돌고 있으면
  // 코스 렌더가 1분을 넘길 수 있어 넉넉히 둔다.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  // 단일 워커 순차 실행: 매칭 레이트리밋(§3.1 IP 토큰버킷)·서버 캐시를 공유하므로
  // 병렬이면 서로의 상태에 간섭한다.
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "ko-KR",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
    // E2E 는 화면 흐름 검증이 목적 — LLM 품질은 eval(§6.2)이 담당하므로
    // Playwright 가 직접 서버를 띄울 땐 결정형 heuristic 프로바이더로 고정한다.
    // (이미 떠 있는 dev 서버를 재사용하면 그 서버의 설정을 따른다 — 위 timeout 참고)
    env: { ...process.env, EUMGIL_AGENT_LLM: "heuristic" },
  },
});
