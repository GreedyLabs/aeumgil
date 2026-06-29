#!/usr/bin/env node
// ─────────────────────────────────────────────
// 에움길 앱 도메인 테이블을 안전하게 생성/보정한다.
//
// drizzle-kit push 가 기존 primary key 제약을 재조정하려다 실패하는 로컬 DB를 피하기 위해,
// 앱이 실제로 쓰는 테이블/컬럼만 idempotent SQL 로 적용한다.
// - 기존 테이블은 drop 하지 않는다.
// - 누락 컬럼은 add column if not exists 로 추가한다.
// - primary key 는 없을 때만 추가한다.
// ─────────────────────────────────────────────

const C = { green: "\x1b[32m", red: "\x1b[31m", gray: "\x1b[90m", cyan: "\x1b[36m", yellow: "\x1b[33m", reset: "\x1b[0m" };
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
const qTable = (table) => `${schemaSql}.${quoteIdent(table)}`;
const masked = URL.replace(/(:\/\/[^:]+:)[^@]+@/, "$1****@");

const sql = postgres(URL, { prepare: false, idle_timeout: 5, connect_timeout: 8, max: 1 });

async function primaryKeyExists(table) {
  const rows = await sql`
    select 1
    from information_schema.table_constraints
    where table_schema = ${SCHEMA}
      and table_name = ${table}
      and constraint_type = 'PRIMARY KEY'
    limit 1
  `;
  return rows.length > 0;
}

async function ensureNoNulls(table, columns) {
  const where = columns.map((c) => `${quoteIdent(c)} is null`).join(" or ");
  const rows = await sql.unsafe(`select count(*)::int as n from ${qTable(table)} where ${where}`);
  const n = rows[0]?.n ?? 0;
  if (n > 0) {
    throw new Error(`${table} 테이블에 primary key 컬럼(${columns.join(", ")})이 NULL 인 행 ${n}개가 있어 자동 보정할 수 없습니다.`);
  }
}

async function addPrimaryKey(table, columns) {
  if (await primaryKeyExists(table)) return;
  await ensureNoNulls(table, columns);
  const cols = columns.map(quoteIdent).join(", ");
  await sql.unsafe(`alter table ${qTable(table)} add primary key (${cols})`);
}

async function setNotNullIfClean(table, column) {
  const rows = await sql.unsafe(`select count(*)::int as n from ${qTable(table)} where ${quoteIdent(column)} is null`);
  const n = rows[0]?.n ?? 0;
  if (n === 0) {
    await sql.unsafe(`alter table ${qTable(table)} alter column ${quoteIdent(column)} set not null`);
  } else {
    console.log(`${C.yellow}– ${table}.${column} NULL ${n}개 → not null 설정은 건너뜀${C.reset}`);
  }
}

async function ensureSavedTheme() {
  await sql.unsafe(`
    create table if not exists ${qTable("saved_theme")} (
      user_id text not null,
      theme_id text not null,
      saved_at timestamp not null default now(),
      primary key (user_id, theme_id)
    )
  `);
  await sql.unsafe(`alter table ${qTable("saved_theme")} add column if not exists user_id text`);
  await sql.unsafe(`alter table ${qTable("saved_theme")} add column if not exists theme_id text`);
  await sql.unsafe(`alter table ${qTable("saved_theme")} add column if not exists saved_at timestamp default now()`);
  await setNotNullIfClean("saved_theme", "user_id");
  await setNotNullIfClean("saved_theme", "theme_id");
  await sql.unsafe(`update ${qTable("saved_theme")} set saved_at = now() where saved_at is null`);
  await setNotNullIfClean("saved_theme", "saved_at");
  await addPrimaryKey("saved_theme", ["user_id", "theme_id"]);
}

async function ensureReview() {
  await sql.unsafe(`
    create table if not exists ${qTable("review")} (
      id text primary key,
      user_id text not null,
      spot_id text not null,
      rating integer not null,
      text text not null,
      helpful integer not null default 0,
      created_at timestamp not null default now()
    )
  `);
  await sql.unsafe(`alter table ${qTable("review")} add column if not exists id text`);
  await sql.unsafe(`alter table ${qTable("review")} add column if not exists user_id text`);
  await sql.unsafe(`alter table ${qTable("review")} add column if not exists spot_id text`);
  await sql.unsafe(`alter table ${qTable("review")} add column if not exists rating integer`);
  await sql.unsafe(`alter table ${qTable("review")} add column if not exists text text`);
  await sql.unsafe(`alter table ${qTable("review")} add column if not exists helpful integer default 0`);
  await sql.unsafe(`alter table ${qTable("review")} add column if not exists created_at timestamp default now()`);
  await sql.unsafe(`update ${qTable("review")} set id = md5(random()::text || clock_timestamp()::text) where id is null`);
  await sql.unsafe(`update ${qTable("review")} set helpful = 0 where helpful is null`);
  await sql.unsafe(`update ${qTable("review")} set created_at = now() where created_at is null`);
  for (const col of ["id", "user_id", "spot_id", "rating", "text", "helpful", "created_at"]) await setNotNullIfClean("review", col);
  await addPrimaryKey("review", ["id"]);
}

async function ensureVisit() {
  await sql.unsafe(`
    create table if not exists ${qTable("visit")} (
      id text primary key,
      user_id text not null,
      spot_id text not null,
      visited_at timestamp not null default now(),
      congestion_then text
    )
  `);
  await sql.unsafe(`alter table ${qTable("visit")} add column if not exists id text`);
  await sql.unsafe(`alter table ${qTable("visit")} add column if not exists user_id text`);
  await sql.unsafe(`alter table ${qTable("visit")} add column if not exists spot_id text`);
  await sql.unsafe(`alter table ${qTable("visit")} add column if not exists visited_at timestamp default now()`);
  await sql.unsafe(`alter table ${qTable("visit")} add column if not exists congestion_then text`);
  await sql.unsafe(`update ${qTable("visit")} set id = md5(random()::text || clock_timestamp()::text) where id is null`);
  await sql.unsafe(`update ${qTable("visit")} set visited_at = now() where visited_at is null`);
  for (const col of ["id", "user_id", "spot_id", "visited_at"]) await setNotNullIfClean("visit", col);
  await addPrimaryKey("visit", ["id"]);
}

async function ensureOnboardingPreference() {
  await sql.unsafe(`
    create table if not exists ${qTable("onboarding_preference")} (
      user_id text primary key,
      interest_theme_ids jsonb not null,
      pace_id text not null,
      companion_id text not null,
      updated_at timestamp not null default now()
    )
  `);
  await sql.unsafe(`alter table ${qTable("onboarding_preference")} add column if not exists user_id text`);
  await sql.unsafe(`alter table ${qTable("onboarding_preference")} add column if not exists interest_theme_ids jsonb`);
  await sql.unsafe(`alter table ${qTable("onboarding_preference")} add column if not exists pace_id text`);
  await sql.unsafe(`alter table ${qTable("onboarding_preference")} add column if not exists companion_id text`);
  await sql.unsafe(`alter table ${qTable("onboarding_preference")} add column if not exists updated_at timestamp default now()`);
  await sql.unsafe(`update ${qTable("onboarding_preference")} set interest_theme_ids = '[]'::jsonb where interest_theme_ids is null`);
  await sql.unsafe(`update ${qTable("onboarding_preference")} set updated_at = now() where updated_at is null`);
  for (const col of ["user_id", "interest_theme_ids", "pace_id", "companion_id", "updated_at"]) await setNotNullIfClean("onboarding_preference", col);
  await addPrimaryKey("onboarding_preference", ["user_id"]);
}

async function ensureUserProfile() {
  await sql.unsafe(`
    create table if not exists ${qTable("user_profile")} (
      user_id text primary key,
      display_name text not null,
      bio text not null default '',
      updated_at timestamp not null default now()
    )
  `);
  await sql.unsafe(`alter table ${qTable("user_profile")} add column if not exists user_id text`);
  await sql.unsafe(`alter table ${qTable("user_profile")} add column if not exists display_name text`);
  await sql.unsafe(`alter table ${qTable("user_profile")} add column if not exists bio text default ''`);
  await sql.unsafe(`alter table ${qTable("user_profile")} add column if not exists updated_at timestamp default now()`);
  await sql.unsafe(`update ${qTable("user_profile")} set bio = '' where bio is null`);
  await sql.unsafe(`update ${qTable("user_profile")} set updated_at = now() where updated_at is null`);
  for (const col of ["user_id", "display_name", "bio", "updated_at"]) await setNotNullIfClean("user_profile", col);
  await addPrimaryKey("user_profile", ["user_id"]);
}

console.log(`\n앱 DB 스키마 적용 → ${masked}\n대상 스키마: ${C.cyan}${SCHEMA}${C.reset}\n──────────────────────────────`);

try {
  if (SCHEMA !== "public") {
    const exists = await sql`select 1 from information_schema.schemata where schema_name = ${SCHEMA} limit 1`;
    if (exists.length === 0) await sql.unsafe(`create schema ${schemaSql}`);
  }
  await ensureSavedTheme();
  await ensureReview();
  await ensureVisit();
  await ensureOnboardingPreference();
  await ensureUserProfile();
  console.log(`${C.green}✓ 앱 도메인 테이블 준비 완료${C.reset}`);
} catch (e) {
  console.error(`${C.red}✗ 적용 실패 — ${e instanceof Error ? e.message : String(e)}${C.reset}`);
  console.error(`${C.gray}기존 데이터에 NULL/중복 primary key 후보가 있으면 수동 정리가 필요합니다.${C.reset}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

console.log("──────────────────────────────\n");
