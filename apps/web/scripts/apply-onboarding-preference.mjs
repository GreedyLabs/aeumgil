#!/usr/bin/env node
// ─────────────────────────────────────────────
// onboarding_preference 테이블만 안전하게 생성한다.
//
// drizzle-kit push 는 기존 DB 전체를 diff 하면서 review/visit PK 제약까지 조정하려 할 수 있다.
// 이번 변경은 신규 테이블 추가만 필요하므로, 기존 테이블을 건드리지 않는 idempotent SQL 로 적용한다.
// ─────────────────────────────────────────────

const C = { green: "\x1b[32m", red: "\x1b[31m", gray: "\x1b[90m", cyan: "\x1b[36m", reset: "\x1b[0m" };
const URL = process.env.DATABASE_URL;
const SCHEMA = (process.env.DATABASE_SCHEMA || "public").trim();

if (!URL) {
  console.error(`${C.red}✗ DATABASE_URL 이 비어 있습니다.${C.reset} 루트 .env 를 확인하세요.`);
  process.exit(1);
}

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(SCHEMA)) {
  console.error(`${C.red}✗ DATABASE_SCHEMA 값이 올바르지 않습니다:${C.reset} ${SCHEMA}`);
  process.exit(1);
}

let postgres;
try {
  ({ default: postgres } = await import("postgres"));
} catch {
  console.error(`${C.red}✗ 'postgres' 패키지를 찾을 수 없습니다.${C.reset} 먼저 ${C.cyan}pnpm install${C.reset} 을 실행하세요.`);
  process.exit(1);
}

const quoteIdent = (s) => `"${s.replaceAll('"', '""')}"`;
const schemaSql = quoteIdent(SCHEMA);
const tableSql = `${schemaSql}.${quoteIdent("onboarding_preference")}`;
const masked = URL.replace(/(:\/\/[^:]+:)[^@]+@/, "$1****@");

console.log(`\nonboarding_preference 적용 → ${masked}\n대상 스키마: ${C.cyan}${SCHEMA}${C.reset}\n──────────────────────────────`);

const sql = postgres(URL, { prepare: false, idle_timeout: 5, connect_timeout: 8, max: 1 });
try {
  if (SCHEMA !== "public") {
    await sql.unsafe(`create schema if not exists ${schemaSql}`);
  }

  await sql.unsafe(`
    create table if not exists ${tableSql} (
      user_id text primary key,
      interest_theme_ids jsonb not null,
      pace_id text not null,
      companion_id text not null,
      updated_at timestamp not null default now()
    )
  `);

  console.log(`${C.green}✓ onboarding_preference 준비 완료${C.reset}`);
} catch (e) {
  console.error(`${C.red}✗ 적용 실패 — ${e instanceof Error ? e.message : String(e)}${C.reset}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
console.log("──────────────────────────────\n");
