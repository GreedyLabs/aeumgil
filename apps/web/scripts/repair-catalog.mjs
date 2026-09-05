#!/usr/bin/env node
// 과거 시드의 이중 JSON 인코딩·샘플 수치·실재하지 않는 POI를 한 번에 정리한다.
import fs from "node:fs/promises";
import postgres from "postgres";
const schema = process.env.DATABASE_SCHEMA || "public";
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw Error("잘못된 스키마");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
function array(value) {
  if (Array.isArray(value)) return [...new Set(value.flatMap(array))];
  if (typeof value !== "string") return [];
  if (value.trim().startsWith("[")) {
    try {
      return array(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return value ? [value] : [];
}
try {
  await sql.begin(async (tx) => {
    const table = (n) => tx(`${schema}.${n}`);
    const rows = await tx`select * from ${table("spot_profile")}`;
    await fs.mkdir(".cache", { recursive: true });
    await fs.writeFile(`.cache/catalog-repair-backup-${Date.now()}.json`, JSON.stringify(rows), {
      mode: 0o600,
    });
    for (const r of rows)
      await tx`update ${table("spot_profile")} set theme_ids=${tx.json(array(r.theme_ids))},tags_ko=${tx.json(array(r.tags_ko))},tags_en=${tx.json(array(r.tags_en))} where spot_id=${r.spot_id}`;
    await tx`update ${table("spot_profile")} set rating=0,review_count=0 where source='seed'`;
    // 일반 명칭뿐인 가상 카페. 실제 방문·리뷰 행은 삭제하지 않는다.
    await tx`delete from ${table("course_template_item")} where kind='spot' and ref_id='jumunjin-cafe'`;
    await tx`delete from ${table("spot_profile")} where spot_id='jumunjin-cafe' and source_content_id is null`;
    await tx`delete from ${table("course_template_item")} i where kind in ('eat','stay') and not exists(select 1 from ${table("commerce_profile")} c where c.id=i.ref_id)`;
    const refs =
      await tx`select i.ref_id,t.theme_id from ${table("course_template_item")} i join ${table("course_template")} t on t.id=i.template_id where i.kind='spot'`;
    for (const r of refs)
      await tx`update ${table("spot_profile")} set theme_ids=(select jsonb_agg(distinct value) from jsonb_array_elements(theme_ids || ${tx.json([r.theme_id])})) where spot_id=${r.ref_id}`;
    console.log({
      repaired: rows.length,
      remaining: (await tx`select count(*) total from ${table("spot_profile")}`)[0].total,
    });
  });
} finally {
  await sql.end();
}
