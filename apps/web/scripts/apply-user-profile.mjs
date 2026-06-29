#!/usr/bin/env node
// ─────────────────────────────────────────────
// user_profile 테이블만 안전하게 생성한다.
//
// drizzle-kit push 가 기존 PK 제약을 건드리는 환경을 피하기 위한 additive DDL 스크립트.
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
const tableSql = `${schemaSql}.${quoteIdent("user_profile")}`;
const masked = URL.replace(/(:\/\/[^:]+:)[^@]+@/, "$1****@");

console.log(`\nuser_profile 적용 → ${masked}\n대상 스키마: ${C.cyan}${SCHEMA}${C.reset}\n──────────────────────────────`);

const sql = postgres(URL, { prepare: false, idle_timeout: 5, connect_timeout: 8, max: 1 });
try {
  if (SCHEMA !== "public") {
    await sql.unsafe(`create schema if not exists ${schemaSql}`);
  }

  await sql.unsafe(`
    create table if not exists ${tableSql} (
      user_id text primary key,
      display_name text not null,
      bio text not null default '',
      updated_at timestamp not null default now()
    )
  `);

  console.log(`${C.green}✓ user_profile 준비 완료${C.reset}`);
} catch (e) {
  console.error(`${C.red}✗ 적용 실패 — ${e instanceof Error ? e.message : String(e)}${C.reset}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
console.log("──────────────────────────────\n");
