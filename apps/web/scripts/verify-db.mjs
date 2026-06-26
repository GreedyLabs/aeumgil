#!/usr/bin/env node
// ─────────────────────────────────────────────
// DB 연결 검증 — .env 의 DATABASE_URL 로 실제 접속해 상태를 출력.
//
// 사용법 (루트에서):
//   pnpm --filter @eumgil/web verify:db
//   (또는) node --env-file=.env apps/web/scripts/verify-db.mjs
//
// 출력: 연결 성공 여부 + 서버 버전 + Phase 4 앱 도메인 테이블 존재 여부.
//   ✓ 있음 / – 없음(db:push 필요). 'postgres' 패키지는 pnpm install 후 사용 가능.
// ─────────────────────────────────────────────

const C = { green: "\x1b[32m", red: "\x1b[31m", gray: "\x1b[90m", cyan: "\x1b[36m", yellow: "\x1b[33m", reset: "\x1b[0m" };
const URL = process.env.DATABASE_URL;

if (!URL) {
  console.error(`${C.red}✗ DATABASE_URL 이 비어 있습니다.${C.reset} 루트 .env 에 연결 문자열을 넣어주세요.`);
  console.error(`  형식: ${C.gray}postgresql://USER:PASSWORD@HOST:5432/DBNAME${C.reset}`);
  console.error(`  (클라우드 DB는 보통 끝에 ?sslmode=require 가 붙습니다.)`);
  process.exit(1);
}

let postgres;
try {
  ({ default: postgres } = await import("postgres"));
} catch {
  console.error(`${C.red}✗ 'postgres' 패키지를 찾을 수 없습니다.${C.reset} 먼저 ${C.cyan}pnpm install${C.reset} 을 실행하세요.`);
  process.exit(1);
}

const EXPECTED = ["saved_theme", "review", "visit"];
const SCHEMA = (process.env.DATABASE_SCHEMA || "public").trim();
const masked = URL.replace(/(:\/\/[^:]+:)[^@]+@/, "$1****@");
console.log(`\nDB 연결 검증 → ${masked}\n대상 스키마: ${C.cyan}${SCHEMA}${C.reset}\n──────────────────────────────`);

const sql = postgres(URL, { prepare: false, idle_timeout: 5, connect_timeout: 8, max: 1 });
try {
  const [info] = await sql`select version() as version`;
  console.log(`${C.green}✓ 연결 성공${C.reset}  ${C.gray}${String(info.version).split(",")[0]}${C.reset}`);

  const rows = await sql`select table_name from information_schema.tables where table_schema = ${SCHEMA}`;
  const present = new Set(rows.map((r) => r.table_name));
  console.log(`\n테이블 상태 (${SCHEMA}):`);
  for (const t of EXPECTED) {
    console.log(present.has(t) ? `  ${C.green}✓ ${t}${C.reset}` : `  ${C.yellow}– ${t} (없음)${C.reset}`);
  }
  const missing = EXPECTED.filter((t) => !present.has(t));
  console.log(
    "\n" +
      (missing.length === 0
        ? `${C.green}모든 테이블 존재 — 스키마 적용 완료.${C.reset}`
        : `${C.yellow}누락 ${missing.length}개 → ${C.cyan}pnpm --filter @eumgil/web db:push${C.reset}${C.yellow} 로 생성하세요.${C.reset}`),
  );
} catch (e) {
  console.error(`${C.red}✗ 연결/쿼리 실패 — ${e instanceof Error ? e.message : String(e)}${C.reset}`);
  console.error(`  ${C.gray}호스트/포트/계정/SSL 설정과 DB 기동 여부를 확인하세요.${C.reset}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
console.log("──────────────────────────────\n");
