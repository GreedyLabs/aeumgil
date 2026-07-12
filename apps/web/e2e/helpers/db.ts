// ─────────────────────────────────────────────
// E2E 테스트 사용자 데이터 정리 — 매 실행 전(global-setup) 호출해
// 저장/리뷰/방문 등 쓰기 시나리오를 결정적 초기 상태에서 시작한다.
// 대상 테이블은 server/db/user-data.ts deleteUserData 와 동일한 5개.
// ─────────────────────────────────────────────

import postgres from "postgres";
import { TEST_USER } from "./session";

const USER_TABLES = ["saved_theme", "review", "visit", "onboarding_preference", "user_profile"] as const;

export async function cleanupTestUser(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정 — E2E 는 실 DB 가 필요합니다(루트 .env 확인).");
  const schema = process.env.DATABASE_SCHEMA || "public";
  const sql = postgres(url, { connection: { search_path: schema }, max: 1, connect_timeout: 5 });
  try {
    for (const table of USER_TABLES) {
      await sql`delete from ${sql(table)} where user_id = ${TEST_USER.id}`;
    }
  } finally {
    await sql.end();
  }
}
