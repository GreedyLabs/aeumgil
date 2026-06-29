#!/usr/bin/env node
// ─────────────────────────────────────────────
// mock 큐레이션 시드를 코스 생성 DB 카탈로그로 적재한다.
//
// 대상 테이블:
//   - spot_profile
//   - course_template
//   - course_template_item
//
// 설계:
//   - 기존 DATA.SPOTS/COURSES 를 정본 시드로 사용한다.
//   - 같은 스크립트를 여러 번 실행해도 결과가 같도록 upsert/delete+insert 로 동기화한다.
//   - 사용자 데이터 테이블은 건드리지 않는다.
// ─────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const dataPath = path.join(appDir, "src/design/data.ts");
const mappingPath = path.join(appDir, "src/data/live/spot-mapping.ts");

const quoteIdent = (s) => `"${s.replaceAll('"', '""')}"`;
const schemaSql = quoteIdent(SCHEMA);
const qTable = (table) => `${schemaSql}.${quoteIdent(table)}`;
const masked = URL.replace(/(:\/\/[^:]+:)[^@]+@/, "$1****@");

function readData() {
  const raw = fs.readFileSync(dataPath, "utf8");
  const js = raw.replace(/\/\/ @ts-nocheck\s*/, "").replace("export const DATA =", "const DATA =");
  return Function(`${js}\nreturn DATA;`)();
}

function readSpotMappings() {
  const raw = fs.readFileSync(mappingPath, "utf8");
  const map = new Map();
  const rowRe =
    /["']?([a-z0-9-]+)["']?\s*:\s*\{\s*tourContentId:\s*([^,]+),\s*lat:\s*([-0-9.]+),\s*lon:\s*([-0-9.]+),\s*region:\s*["']([^"']+)["'],\s*env:\s*["']([^"']+)["']/g;
  let m;
  while ((m = rowRe.exec(raw))) {
    const contentRaw = m[2]?.trim() ?? "null";
    map.set(m[1], {
      sourceContentId: contentRaw === "null" ? null : contentRaw.replaceAll('"', "").replaceAll("'", ""),
      lat: Number(m[3]),
      lon: Number(m[4]),
      region: m[5],
      env: m[6],
    });
  }
  return map;
}

function themeIdsBySpot(courses, altSpots) {
  const out = new Map();
  for (const [themeId, course] of Object.entries(courses)) {
    for (const item of course.items ?? []) {
      if (!item.spot) continue;
      const ids = [item.spot, ...(altSpots[item.spot] ?? [])];
      for (const id of ids) {
        const set = out.get(id) ?? new Set();
        set.add(themeId);
        out.set(id, set);
      }
    }
  }
  return out;
}

function durationMin(spot) {
  const text = spot.duration_ko ?? "";
  const hours = /(\d+)\s*시간/.exec(text)?.[1];
  const mins = /(\d+)\s*분/.exec(text)?.[1];
  return (hours ? Number(hours) * 60 : 0) + (mins ? Number(mins) : 0) || 60;
}

function templateItem(raw, seq) {
  const stayDuration = typeof raw.stay === "number" ? raw.stay : null;
  if (raw.spot) return { seq, kind: "spot", day: raw.day, time: raw.time, refId: raw.spot, durationMin: stayDuration };
  if (raw.eat) return { seq, kind: "eat", day: raw.day, time: raw.time, refId: raw.eat, durationMin: stayDuration };
  return { seq, kind: "stay", day: raw.day, time: raw.time, refId: raw.stay, durationMin: null };
}

const DATA = readData();
const mappings = readSpotMappings();
const spotThemes = themeIdsBySpot(DATA.COURSES, DATA.ALT_SPOTS ?? {});
const sql = postgres(URL, { prepare: false, idle_timeout: 5, connect_timeout: 8, max: 1 });

console.log(`\n코스 카탈로그 시드 적재 → ${masked}\n대상 스키마: ${C.cyan}${SCHEMA}${C.reset}\n──────────────────────────────`);

try {
  const schemaExists = await sql`select 1 from information_schema.schemata where schema_name = ${SCHEMA} limit 1`;
  if (schemaExists.length === 0) {
    throw new Error(`스키마 ${SCHEMA} 가 없습니다. 먼저 pnpm --filter @eumgil/web db:apply 를 실행하세요.`);
  }

  let spotCount = 0;
  for (const spot of Object.values(DATA.SPOTS)) {
    const m = mappings.get(spot.id);
    const themeIds = [...(spotThemes.get(spot.id) ?? new Set())];
    await sql.unsafe(
      `
      insert into ${qTable("spot_profile")} (
        spot_id, name_ko, name_en, type_ko, type_en, region_ko, region_en,
        theme_ids, tags_ko, tags_en, baseline_congestion, suitability, rating,
        review_count, default_duration_min, lat, lon, env, source, source_content_id, updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7,
        $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13,
        $14, $15, $16, $17, $18, 'seed', $19, now()
      )
      on conflict (spot_id) do update set
        name_ko = excluded.name_ko,
        name_en = excluded.name_en,
        type_ko = excluded.type_ko,
        type_en = excluded.type_en,
        region_ko = excluded.region_ko,
        region_en = excluded.region_en,
        theme_ids = excluded.theme_ids,
        tags_ko = excluded.tags_ko,
        tags_en = excluded.tags_en,
        baseline_congestion = excluded.baseline_congestion,
        suitability = excluded.suitability,
        rating = excluded.rating,
        review_count = excluded.review_count,
        default_duration_min = excluded.default_duration_min,
        lat = excluded.lat,
        lon = excluded.lon,
        env = excluded.env,
        source = excluded.source,
        source_content_id = excluded.source_content_id,
        updated_at = now()
      `,
      [
        spot.id,
        spot.name_ko,
        spot.name_en ?? null,
        spot.type_ko,
        spot.type_en ?? null,
        spot.region_ko,
        spot.region_en ?? null,
        JSON.stringify(themeIds),
        JSON.stringify(spot.tags_ko ?? []),
        JSON.stringify(spot.tags_en ?? []),
        spot.congestion ?? "moderate",
        spot.suitability ?? 70,
        spot.rating ?? 0,
        spot.reviews ?? 0,
        durationMin(spot),
        m?.lat ?? null,
        m?.lon ?? null,
        m?.env ?? "inland",
        m?.sourceContentId ?? null,
      ],
    );
    spotCount++;
  }

  let templateCount = 0;
  let itemCount = 0;
  for (const [themeId, course] of Object.entries(DATA.COURSES)) {
    const templateId = `seed:${themeId}`;
    await sql.unsafe(
      `
      insert into ${qTable("course_template")} (
        id, theme_id, title_ko, title_en, day_count, alt_note_ko, alt_note_en, is_default, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, null, true, now())
      on conflict (id) do update set
        theme_id = excluded.theme_id,
        title_ko = excluded.title_ko,
        title_en = excluded.title_en,
        day_count = excluded.day_count,
        alt_note_ko = excluded.alt_note_ko,
        alt_note_en = excluded.alt_note_en,
        is_default = true,
        updated_at = now()
      `,
      [templateId, themeId, course.title_ko, course.title_en ?? null, course.day_count, course.alt_note_ko ?? null],
    );

    await sql.unsafe(`delete from ${qTable("course_template_item")} where template_id = $1`, [templateId]);
    const items = (course.items ?? []).map((item, idx) => templateItem(item, idx + 1));
    for (const item of items) {
      await sql.unsafe(
        `
        insert into ${qTable("course_template_item")} (
          template_id, seq, kind, day, time, ref_id, duration_min
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [templateId, item.seq, item.kind, item.day, item.time, item.refId, item.durationMin],
      );
      itemCount++;
    }
    templateCount++;
  }

  console.log(`${C.green}✓ spot_profile ${spotCount}개 upsert${C.reset}`);
  console.log(`${C.green}✓ course_template ${templateCount}개 upsert${C.reset}`);
  console.log(`${C.green}✓ course_template_item ${itemCount}개 동기화${C.reset}`);
} catch (e) {
  console.error(`${C.red}✗ 시드 적재 실패 — ${e instanceof Error ? e.message : String(e)}${C.reset}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

console.log("──────────────────────────────\n");
