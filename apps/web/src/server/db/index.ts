// ─────────────────────────────────────────────
// Drizzle DB 클라이언트 (PostgreSQL / postgres-js) — 서버 전용.
//
// import 안전(중요): 이 모듈을 import 해도 DB 에 붙지 않는다.
//   - DATABASE_URL 이 없으면 getDb() 는 null 을 돌려준다 → 사용자 데이터 메서드는
//     mock 으로 폴백하므로 `pnpm dev`(mock)·DATABASE_URL 없는 환경도 정상.
//   - 클라이언트(postgres-js)는 첫 쿼리 때 lazy 연결 + 모듈 1회만 생성(메모이즈).
// 클라이언트(브라우저)에서 import 금지.
// ─────────────────────────────────────────────

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, requireEnv } from "@/lib/env";
import { schema } from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

let memo: Database | null = null;

/** DATABASE_URL 이 있으면 Drizzle DB(메모이즈), 없으면 null. import 시점엔 연결 안 함. */
export function getDb(): Database | null {
  if (memo) return memo;
  if (!env.DATABASE_URL) return null;
  // serverless/풀러 대비 prepare 비활성. 연결은 첫 쿼리 때 lazy 수립.
  const client = postgres(env.DATABASE_URL, { prepare: false });
  memo = drizzle(client, { schema });
  return memo;
}

/** DB 가 반드시 필요한 경로(Auth.js 어댑터 등)용 — 없으면 명확히 throw. */
export function requireDb(): Database {
  requireEnv("DATABASE_URL"); // 부재 시 친절한 에러
  return getDb() as Database;
}
