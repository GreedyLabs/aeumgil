// ─────────────────────────────────────────────
// 환경변수 검증 (서버 전용)
//
// .env 값을 zod 로 형식 검증해 타입 안전하게 노출한다.
// Phase 0 에서는 대부분 optional — 각 기능(공공 API/DB/인증)이 붙는 단계에서
// 해당 키 미설정 시 그 기능 경로에서 명시적으로 에러를 낸다.
// 클라이언트에서 import 하지 말 것 (NEXT_PUBLIC_* 외 키는 서버에만 존재).
// ─────────────────────────────────────────────

import { z } from "zod";

const optionalUrl = z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional());

const schema = z.object({
  // 앱
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  /** 디버그 로그 네임스페이스 (예: "1"=전체, "http,cache"=일부). server/log.ts */
  EUMGIL_DEBUG: z.string().optional(),
  /** 응답 캐시 파일 디렉터리 (기본: OS 임시). server/cache.ts */
  EUMGIL_CACHE_DIR: z.string().optional(),
  /** 에이전트 LLM 선택. 기본 heuristic 은 키 없이 동작한다. */
  EUMGIL_AGENT_LLM: z.enum(["heuristic", "openai"]).default("heuristic"),
  /** "1"이면 dev 에서도 기동 워밍 실행(운영 런타임은 항상). server/warmup.ts */
  EUMGIL_WARMUP: z.string().optional(),

  // 데이터베이스
  DATABASE_URL: z.string().optional(),
  /** 대상 PostgreSQL 스키마 (없거나 "public" 이면 public). db/schema.ts */
  DATABASE_SCHEMA: z.string().optional(),

  // 공공데이터 OpenAPI
  TOUR_API_SERVICE_KEY: z.string().optional(),
  TOUR_BIGDATA_SERVICE_KEY: z.string().optional(),
  KMA_SERVICE_KEY: z.string().optional(),
  AIRKOREA_SERVICE_KEY: z.string().optional(),
  EX_ROAD_SERVICE_KEY: z.string().optional(),

  // 길찾기/이동시간 API
  ROUTING_PROVIDER: z.enum(["approx", "kakao"]).default("approx"),
  KAKAO_MOBILITY_API_KEY: z.string().optional(),

  // 인증
  AUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().url().optional(),
  AUTH_KEYCLOAK_ID: z.string().optional(),
  AUTH_KEYCLOAK_SECRET: z.string().optional(),
  AUTH_KEYCLOAK_ISSUER: z.string().url().optional(),
  // 회원 탈퇴 시 Keycloak 계정 삭제용 service account 클라이언트(realm-management: manage-users).
  // 미설정이면 앱 DB 만 삭제하고 Keycloak 계정은 수동 절차(플랜 §7.2)로 정리한다.
  KEYCLOAK_ADMIN_CLIENT_ID: z.string().optional(),
  KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().optional(),

  // Agent C단계: OpenAI-compatible Chat Completions
  // 로컬 OpenAI-호환 서버(llama.cpp 등)는 BASE_URL 만 지정하면 API_KEY 없이 동작한다.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_BASE_URL: optionalUrl,
  // LLM 호출 1회 타임아웃(ms). 미설정 시 30초(로컬 소형 모델 생성 속도 고려).
  OPENAI_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().int().positive().optional(),
  ),
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

/**
 * 운영 런타임 여부. `next build` 도 NODE_ENV=production 으로 돌지만
 * 빌드 단계(Dockerfile builder)에는 시크릿이 주입되지 않으므로,
 * NEXT_PHASE 로 빌드 페이즈를 제외하고 실제 서비스 프로세스만 판별한다.
 */
export const isProductionRuntime =
  process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";

/** 운영 기동에 필수인 인증 환경변수 (운영-준비-플랜 §1.1 / 부록 A) */
const PRODUCTION_REQUIRED_KEYS = [
  "AUTH_SECRET",
  "AUTH_URL",
  "AUTH_KEYCLOAK_ID",
  "AUTH_KEYCLOAK_SECRET",
  "AUTH_KEYCLOAK_ISSUER",
] as const;

/**
 * 운영 런타임에서 필수 키가 하나라도 빠지면 즉시 throw.
 * 개발용 폴백 시크릿(세션 위조 가능)으로 서비스가 조용히 뜨는 사고를 막는다.
 * instrumentation.ts(부팅 시)와 server/auth.ts(모듈 로드 시 방어선)에서 호출.
 */
export function assertProductionEnv(): void {
  if (!isProductionRuntime) return;
  const missing = PRODUCTION_REQUIRED_KEYS.filter((key) => {
    const value = env[key];
    return value === undefined || value === "";
  });
  if (missing.length > 0) {
    throw new Error(
      `운영(NODE_ENV=production) 기동에 필수인 환경변수가 없습니다: ${missing.join(", ")} — ` +
        "배포 환경 주입 목록은 docs/운영-준비-플랜.md 부록 A 참고.",
    );
  }
}
