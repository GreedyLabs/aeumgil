#!/usr/bin/env node
// ─────────────────────────────────────────────
// spot_profile.image_url 동기화.
//
// 운영 제출 전 1회 실행:
//   pnpm --filter @eumgil/web sync:spot-images
//
// DB 의 source_content_id 가 있는 스팟만 TourAPI detailCommon2 로 조회하고,
// 실제 firstimage 가 있는 경우에만 image_url 을 저장한다.
// firstimage 가 없거나 API 가 실패한 스팟은 임의 이미지로 대체하지 않는다.
// ─────────────────────────────────────────────

const C = { green: "\x1b[32m", red: "\x1b[31m", gray: "\x1b[90m", cyan: "\x1b[36m", yellow: "\x1b[33m", reset: "\x1b[0m" };
const DATABASE_URL = process.env.DATABASE_URL;
const SCHEMA = (process.env.DATABASE_SCHEMA || "public").trim();
const TOUR = process.env.DATA_GO_KR_SERVICE_KEY;

if (!DATABASE_URL) {
  console.error(`${C.red}✗ DATABASE_URL 이 비어 있습니다.${C.reset}`);
  process.exit(1);
}
if (!TOUR) {
  console.error(`${C.red}✗ DATA_GO_KR_SERVICE_KEY 가 비어 있습니다.${C.reset}`);
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
const masked = DATABASE_URL.replace(/(:\/\/[^:]+:)[^@]+@/, "$1****@");
const sql = postgres(DATABASE_URL, { prepare: false, idle_timeout: 5, connect_timeout: 8, max: 1 });

const TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2/detailCommon2";
const COMMON = { MobileOS: "ETC", MobileApp: "eumgil", _type: "json", numOfRows: 1, pageNo: 1 };

function buildUrl(contentId) {
  const u = new URL(TOUR_BASE);
  u.searchParams.set("serviceKey", TOUR);
  for (const [k, v] of Object.entries({ ...COMMON, contentId })) u.searchParams.set(k, String(v));
  return u;
}

async function fetchImage(contentId) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(buildUrl(contentId), { signal: ctrl.signal, headers: { Accept: "application/json" } });
    const text = await res.text();
    if (text.trimStart().startsWith("<")) {
      const msg = /<returnAuthMsg>(.*?)<\/returnAuthMsg>/.exec(text)?.[1];
      throw new Error(`XML 오류 응답${msg ? ` (${msg})` : ""}`);
    }
    const data = JSON.parse(text);
    const item = data.response?.body?.items?.item?.[0];
    return typeof item?.firstimage === "string" && item.firstimage ? item.firstimage : "";
  } finally {
    clearTimeout(t);
  }
}

console.log(`\n스팟 실제 이미지 동기화 → ${masked}\n대상 스키마: ${C.cyan}${SCHEMA}${C.reset}\n──────────────────────────────`);

try {
  const spots = await sql.unsafe(`
    select spot_id, name_ko, source_content_id, image_url
    from ${qTable("spot_profile")}
    where source_content_id is not null and source_content_id <> ''
    order by spot_id
  `);

  let updated = 0;
  let missing = 0;
  let failed = 0;

  for (const spot of spots) {
    try {
      const image = await fetchImage(spot.source_content_id);
      if (!image) {
        missing++;
        console.log(`${C.yellow}– ${spot.spot_id}${C.reset} (${spot.source_content_id}) 이미지 없음`);
        continue;
      }
      await sql.unsafe(
        `update ${qTable("spot_profile")} set image_url = $1, updated_at = now() where spot_id = $2`,
        [image, spot.spot_id],
      );
      updated++;
      console.log(`${C.green}✓ ${spot.spot_id}${C.reset} (${spot.source_content_id}) image_url 저장`);
    } catch (e) {
      failed++;
      console.log(`${C.red}✗ ${spot.spot_id}${C.reset} (${spot.source_content_id}) ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`──────────────────────────────\n${C.green}완료${C.reset}: 업데이트 ${updated}개, 이미지 없음 ${missing}개, 실패 ${failed}개`);
  if (failed > 0) process.exitCode = 1;
} catch (e) {
  console.error(`${C.red}✗ 이미지 동기화 실패 — ${e instanceof Error ? e.message : String(e)}${C.reset}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
