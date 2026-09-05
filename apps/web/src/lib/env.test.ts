// ─────────────────────────────────────────────
// 운영 필수 환경변수 가드(assertProductionEnv) 테스트 — 운영-준비-플랜 §1.1
//
// env.ts 는 import 시점에 process.env 를 파싱하므로,
// 케이스마다 vi.stubEnv 로 환경을 만든 뒤 모듈을 새로 로드한다.
// ─────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PROD_AUTH_ENV = {
  AUTH_SECRET: "test-secret-32bytes-random-value",
  AUTH_URL: "https://eumgil.example.com",
  AUTH_KEYCLOAK_ID: "eumgil",
  AUTH_KEYCLOAK_SECRET: "test-keycloak-secret",
  AUTH_KEYCLOAK_ISSUER: "https://auth.eumgil.example.com/realms/eumgil",
} as const;

async function loadEnvModule() {
  return import("@/lib/env");
}

function stubAll(vars: Record<string, string>) {
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertProductionEnv", () => {
  it("운영 런타임에서 필수 인증 키가 빠지면 throw 한다 (누락 키 나열)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    stubAll({ ...PROD_AUTH_ENV, AUTH_SECRET: "", AUTH_KEYCLOAK_SECRET: "" });

    const { assertProductionEnv } = await loadEnvModule();
    expect(() => assertProductionEnv()).toThrowError(/AUTH_SECRET.*AUTH_KEYCLOAK_SECRET/);
  });

  it("운영 런타임에서 필수 키가 모두 있으면 통과한다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubAll({ ...PROD_AUTH_ENV });

    const { assertProductionEnv, isProductionRuntime } = await loadEnvModule();
    expect(isProductionRuntime).toBe(true);
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it("next build 페이즈에서는 검증을 건너뛴다 (빌드 단계에는 시크릿 미주입)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");

    const { assertProductionEnv, isProductionRuntime } = await loadEnvModule();
    expect(isProductionRuntime).toBe(false);
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it("개발/테스트 환경에서는 미설정이어도 통과한다 (로컬 폴백 편의 유지)", async () => {
    const { assertProductionEnv, isProductionRuntime } = await loadEnvModule();
    expect(isProductionRuntime).toBe(false);
    expect(() => assertProductionEnv()).not.toThrow();
  });
});
