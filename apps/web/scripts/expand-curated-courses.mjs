#!/usr/bin/env node
// 기본은 실 DB를 읽어 검토 보고서만 쓴다. --apply도 기존 원데이 코스·사용자 데이터는 건드리지 않는다.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import postgres from "postgres";
import definitions from "../src/domain/curated-courses.json" with { type: "json" };
import { buildCuratedCatalog } from "../src/domain/curated-catalog.ts";
import { distanceKm } from "../src/domain/catalog-import.ts";
import { estimateDrive } from "../src/domain/travel-time.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const option = (name) => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw Error(`${name} 값이 필요합니다.`);
  return value;
};
const snapshotPath = option("--snapshot");
const reportPath = path.resolve(option("--report") ?? ".cache/curated-catalog-report.json");
const expected = option("--expect-hash");
if (apply && snapshotPath) throw Error("--apply는 스냅샷이 아닌 최신 DB를 다시 읽어 검증합니다.");
const schema = process.env.DATABASE_SCHEMA || "public";
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw Error("스키마 이름이 올바르지 않습니다.");
const measure = (from, to) => ({
  straightKm: distanceKm(from, to),
  minutes: estimateDrive(from, to, "car").driveMinutes,
});
const compile = (snapshot) => {
  const compiled = buildCuratedCatalog(definitions, snapshot.spots, snapshot.commerce, measure);
  const fingerprint = createHash("sha256").update(JSON.stringify(compiled)).digest("hex");
  if (expected && fingerprint !== expected)
    throw Error("검토한 카탈로그와 현재 결과가 다릅니다. 보고서를 다시 확인하세요.");
  return { compiled, fingerprint };
};
async function readCatalog(sql) {
  const table = (name) => sql(`${schema}.${name}`);
  const spots =
    await sql`select spot_id as id, name_ko as name, region_ko as region, lat, lon, theme_ids from ${table("spot_profile")}`;
  const commerce =
    await sql`select id, kind, name_ko as name, region_ko as region, lat, lon, type_ko as type from ${table("commerce_profile")}`;
  return { spots, commerce };
}
async function writeReport(result) {
  const distribution = {};
  for (const course of result.compiled)
    distribution[course.days.length] = (distribution[course.days.length] ?? 0) + 1;
  const report = {
    generatedAt: new Date().toISOString(),
    fingerprint: result.fingerprint,
    apply,
    basis:
      "공식 관광안내의 장소를 참고해 에움길이 재구성한 자동차 기준 일정. 이동·체류 시간은 추정이며 운영·예약을 보증하지 않음.",
    courseCount: result.compiled.length,
    dayDistribution: distribution,
    uniqueSpotCount: new Set(result.compiled.flatMap((course) => course.spotIds)).size,
    courses: result.compiled,
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify(
      {
        ...report,
        courses: undefined,
        reportPath,
        warnings: result.compiled.flatMap((course) =>
          course.warnings.map((warning) => `${course.definition.id}: ${warning}`),
        ),
      },
      null,
      2,
    ),
  );
}

if (snapshotPath) await writeReport(compile(JSON.parse(await fs.readFile(snapshotPath, "utf8"))));
else {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL이 필요합니다.");
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 10,
    onnotice: () => {},
  });
  try {
    if (!apply) {
      await sql`set default_transaction_read_only = on`;
      await writeReport(compile(await readCatalog(sql)));
    } else {
      const applied = await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtext('eumgil:curated-catalog'))`;
        const table = (name) => tx(`${schema}.${name}`);
        const snapshot = await readCatalog(tx);
        const result = compile(snapshot);
        const managed = result.compiled.map((course) => course.definition.id);
        const templateIds = managed.map((id) => `tpl-${id}`);
        const current =
          await tx`select * from ${table("course_template")} where theme_id in ${tx(managed)} or id in ${tx(templateIds)}`;
        if (current.some((row) => row.id !== `tpl-${row.theme_id}`))
          throw Error("같은 테마 ID를 사용하는 다른 템플릿이 있습니다.");
        const membership = new Map();
        for (const course of result.compiled)
          for (const id of course.spotIds)
            membership.set(id, [...(membership.get(id) ?? []), course.definition.id]);
        const touched = snapshot.spots.filter(
          (spot) => membership.has(spot.id) || spot.theme_ids?.some((id) => managed.includes(id)),
        );
        const backupPath = path.resolve(`.cache/curated-catalog-backup-${Date.now()}.json`);
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.writeFile(
          backupPath,
          JSON.stringify({
            templates: current,
            items:
              await tx`select * from ${table("course_template_item")} where template_id in ${tx(templateIds)}`,
            memberships: touched.map(({ id, theme_ids }) => ({ id, theme_ids })),
          }),
          { mode: 0o600 },
        );
        for (const course of result.compiled) {
          const definition = course.definition;
          const templateId = `tpl-${definition.id}`;
          const note = `${definition.planningNote} ${definition.days.map((day, index) => `Day ${index + 1}: ${day.note}`).join(" ")}`;
          await tx`insert into ${table("course_template")} (id,theme_id,title_ko,day_count,alt_note_ko,is_default) values (${templateId},${definition.id},${definition.title},${definition.days.length},${note},true) on conflict(id) do update set title_ko=excluded.title_ko,day_count=excluded.day_count,alt_note_ko=excluded.alt_note_ko,is_default=true,updated_at=now()`;
          await tx`delete from ${table("course_template_item")} where template_id=${templateId}`;
          const rows = course.items.map((item) => ({
            template_id: templateId,
            seq: item.seq,
            kind: item.kind,
            day: item.day,
            time: item.time,
            ref_id: item.refId,
            duration_min: item.durationMin,
          }));
          await tx`insert into ${table("course_template_item")} ${tx(rows)}`;
        }
        for (const spot of touched) {
          const next = membership.get(spot.id) ?? [];
          // 이번에 관리하는 추가 코스만 교체하고 기존 지역·테마 소속은 보존한다.
          await tx`update ${table("spot_profile")} set theme_ids=(select coalesce(jsonb_agg(distinct value),'[]'::jsonb) from (select value from jsonb_array_elements(theme_ids) where not (${tx.json(managed)}::jsonb @> jsonb_build_array(value)) union all select value from jsonb_array_elements(${tx.json(next)}::jsonb)) merged),updated_at=now() where spot_id=${spot.id}`;
        }
        return { result, backupPath };
      });
      await writeReport(applied.result);
      console.log(`카탈로그 적용 완료. 이전 상태 백업: ${applied.backupPath}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
