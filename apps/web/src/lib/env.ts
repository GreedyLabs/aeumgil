// ─────────────────────────────────────────────
// 환경변수 검증 (서버 전용)
//
// .env 값을 zod 로 형식 검증해 타입 안전하게 노출한다.
// Phase 0 에서는 대부분 optional — 각 기능(공공 API/DB/인증)이 붙는 단계에서
// 해당 키 미설정 시 그 기능 경로에서 명시적으로 에러를 낸다.
// 클라이언트에서 import 하지 말 것 (NEXT_PUBLIC_* 외 키는 서버에만 존재).
// ─────────────────────────────────────────────

import { z } from "zod";

const schema = z.object({
  // 앱
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATA_SOURCE: z.enum(["mock", "live"]).default("mock"),

  // 데이터베이스
  DATABASE_URL: z.string().optional(),

  // 공공데이터 OpenAPI
  TOUR_API_SERVICE_KEY: z.string().optional(),
  TOUR_BIGDATA_SERVICE_KEY: z.string().optional(),
  KMA_SERVICE_KEY: z.string().optional(),
  AIRKOREA_SERVICE_KEY: z.string().optional(),
  EX_ROAD_SERVICE_KEY: z.string().optional(),

  // 인증
  AUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().url().optional(),
  AUTH_KAKAO_ID: z.string().optional(),
  AUTH_KAKAO_SECRET: z.string().optional(),
  AUTH_NAVER_ID: z.string().optional(),
  AUTH_NAVER_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_APPLE_ID: z.string().optional(),
  AUTH_APPLE_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ 환경변수 형식 오류:", parsed.error.flatten().fieldErrors);
  throw new Error("환경변수 검증 실패 — .env 설정을 확인하세요.");
}

export const env = parsed.data;
export type Env = typeof env;

/** 필수 키를 요구하는 기능 경로에서 사용. 미설정 시 명확한 에러. */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === "") {
    throw new Error(`환경변수 ${String(key)} 가 설정되지 않았습니다. .env 를 확인하세요.`);
  }
  return value as NonNullable<Env[K]>;
}
