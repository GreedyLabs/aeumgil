#!/usr/bin/env node
// 기본은 수집·검토만. --apply는 기존 ID·사용자 데이터를 보존하며 카탈로그만 upsert한다.
import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import {
  normalizeTourismRow,
  buildRegionalCourses,
  distanceKm,
} from "../src/domain/catalog-import.ts";
const apply = process.argv.includes("--apply");
const inputIndex = process.argv.indexOf("--input");
const snapshotPath =
  inputIndex >= 0 ? process.argv[inputIndex + 1] : path.resolve(".cache/gangwon-catalog.json");
const schema = process.env.DATABASE_SCHEMA || "public";
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw Error("스키마 이름이 올바르지 않습니다.");
let snapshot;
if (inputIndex >= 0) snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
else {
  if (!process.env.DATA_GO_KR_SERVICE_KEY) throw Error("DATA_GO_KR_SERVICE_KEY가 필요합니다.");
  const items = [];
  let total = 1;
  for (let page = 1; items.length < total; page++) {
    if (page > 20) throw Error("페이지 한도를 초과했습니다.");
    const url = new URL("https://apis.data.go.kr/B551011/KorService2/areaBasedList2");
    for (const [k, v] of Object.entries({
      serviceKey: process.env.DATA_GO_KR_SERVICE_KEY,
      MobileOS: "ETC",
      MobileApp: "eumgil",
      _type: "json",
      lDongRegnCd: 51,
      arrange: "A",
      numOfRows: 1000,
      pageNo: page,
    }))
      url.searchParams.set(k, String(v));
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(`관광 목록 HTTP ${response.status}`);
    const data = await response.json();
    const body = data.response?.body;
    if (!/^0+$/.test(data.response?.header?.resultCode || "")) throw Error("관광 목록 응답 오류");
    const rows = body?.items?.item;
    total = Number(body?.totalCount);
    if (!Array.isArray(rows) || !rows.length || !Number.isFinite(total))
      throw Error("불완전한 관광 목록");
    items.push(...rows);
    console.log({ page, received: rows.length, total });
  }
  snapshot = { fetchedAt: new Date().toISOString(), total, items };
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot));
}
if (!Array.isArray(snapshot.items) || snapshot.items.length !== snapshot.total)
  throw Error("수집 스냅샷이 불완전합니다.");
const normalized = [
  ...new Map(
    snapshot.items
      .map(normalizeTourismRow)
      .filter(Boolean)
      .map((p) => [p.contentId, p]),
  ).values(),
];
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10, onnotice: () => {} });
const table = (name) => sql(`${schema}.${name}`);
try {
  const existing = await sql`select spot_id, source_content_id from ${table("spot_profile")}`;
  const ids = new Map(
    existing.filter((r) => r.source_content_id).map((r) => [r.source_content_id, r.spot_id]),
  );
  const places = normalized.map((p) => ({
    ...p,
    id: ids.get(p.contentId) || `tour-${p.contentId}`,
  }));
  const courses = buildRegionalCourses(places);
  const membership = new Map();
  for (const course of courses)
    for (const spot of course.stops)
      membership.set(spot.id, [...(membership.get(spot.id) || []), course.id]);
  const counts = {};
  for (const p of places) counts[p.kind] = (counts[p.kind] || 0) + 1;
  const report = {
    fetchedAt: snapshot.fetchedAt,
    raw: snapshot.total,
    accepted: counts,
    excluded: snapshot.total - places.length,
    courses: courses.length,
    regions: [...new Set(places.map((p) => p.region.ko))],
    routes: courses.map((c) => ({
      id: c.id,
      title: c.title,
      places: c.stops.map((p) => ({ id: p.id, name: p.title })),
      maxDistanceKm:
        Math.round(Math.max(...c.stops.flatMap((a) => c.stops.map((b) => distanceKm(a, b)))) * 10) /
        10,
    })),
  };
  const reportPath = path.resolve(".cache/gangwon-import-report.json");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, routes: undefined, apply, reportPath }));
  if (apply)
    await sql.begin(async (tx) => {
      const backup = {};
      for (const name of [
        "spot_profile",
        "commerce_profile",
        "course_template",
        "course_template_item",
      ])
        backup[name] = await tx`select * from ${tx(`${schema}.${name}`)}`;
      await fs.writeFile(
        path.resolve(`.cache/catalog-backup-${Date.now()}.json`),
        JSON.stringify(backup),
        { mode: 0o600 },
      );
      await tx`alter table ${table("spot_profile")} add column if not exists address text`;
      await tx`alter table ${table("spot_profile")} add column if not exists category text not null default 'other'`;
      const spots = places
        .filter((p) => p.kind === "spot")
        .map((p) => ({
          spot_id: p.id,
          name_ko: p.title,
          type_ko: p.type,
          region_ko: p.region.ko,
          region_en: p.region.en,
          theme_ids: tx.json(membership.get(p.id) || []),
          tags_ko: tx.json([p.type, p.region.ko]),
          lat: p.lat,
          lon: p.lon,
          env: p.environment,
          source: "tourapi",
          source_content_id: p.contentId,
          image_url: p.imageUrl,
          address: p.address,
          category: p.category,
          default_duration_min: p.duration,
        }));
      for (let i = 0; i < spots.length; i += 200)
        await tx`insert into ${table("spot_profile")} ${tx(spots.slice(i, i + 200))} on conflict(spot_id) do update set name_ko=excluded.name_ko,type_ko=excluded.type_ko,region_ko=excluded.region_ko,region_en=excluded.region_en,lat=excluded.lat,lon=excluded.lon,source_content_id=excluded.source_content_id,address=excluded.address,category=excluded.category,image_url=coalesce(excluded.image_url,${table("spot_profile")}.image_url),theme_ids=(select coalesce(jsonb_agg(distinct value),'[]'::jsonb) from jsonb_array_elements(${table("spot_profile")}.theme_ids || excluded.theme_ids)),updated_at=now()`;
      const commerce = places
        .filter((p) => p.kind !== "spot")
        .map((p) => ({
          id: `${p.kind}-${p.contentId}`,
          kind: p.kind,
          name_ko: p.title,
          type_ko: p.type,
          region_ko: p.region.ko,
          region_en: p.region.en,
          addr: p.address,
          tel: p.tel,
          lat: p.lat,
          lon: p.lon,
          image_url: p.imageUrl,
          source: "tourapi",
          source_content_id: p.contentId,
        }));
      for (let i = 0; i < commerce.length; i += 200)
        await tx`insert into ${table("commerce_profile")} ${tx(commerce.slice(i, i + 200))} on conflict(id) do update set name_ko=excluded.name_ko,type_ko=excluded.type_ko,region_ko=excluded.region_ko,region_en=excluded.region_en,addr=excluded.addr,tel=excluded.tel,lat=excluded.lat,lon=excluded.lon,image_url=coalesce(excluded.image_url,${table("commerce_profile")}.image_url),updated_at=now()`;
      for (const c of courses) {
        const templateId = `tpl-${c.id}`;
        const note =
          "한국관광공사 공개 관광정보를 바탕으로 에움길이 같은 지역의 가까운 명소를 연결한 추천 일정입니다. 이동·체류 시간은 추정이며 예약·휴무·입장 조건은 방문 전 확인하세요.";
        await tx`insert into ${table("course_template")} (id,theme_id,title_ko,day_count,alt_note_ko) values(${templateId},${c.id},${c.title},1,${note}) on conflict(id) do update set title_ko=excluded.title_ko,alt_note_ko=excluded.alt_note_ko,updated_at=now()`;
        await tx`delete from ${table("course_template_item")} where template_id=${templateId}`;
        const meal = places
          .filter((p) => p.kind === "eat" && p.region.ko === c.region)
          .sort((a, b) => distanceKm(c.stops[1], a) - distanceKm(c.stops[1], b))[0];
        const entries = c.stops.map((p, i) => ({
          template_id: templateId,
          seq: i * 2,
          kind: "spot",
          day: 1,
          time: ["09:30", "11:30", "15:00"][i],
          ref_id: p.id,
          duration_min: p.duration,
        }));
        if (meal && distanceKm(c.stops[1], meal) < 10)
          entries.push({
            template_id: templateId,
            seq: 3,
            kind: "eat",
            day: 1,
            time: "13:00",
            ref_id: `eat-${meal.contentId}`,
            duration_min: 60,
          });
        await tx`insert into ${table("course_template_item")} ${tx(entries)}`;
      }
      await tx`create index if not exists spot_profile_region_category_idx on ${table("spot_profile")} (region_ko,category)`;
      await tx`create index if not exists spot_profile_theme_ids_idx on ${table("spot_profile")} using gin(theme_ids)`;
    });
  console.log(
    apply
      ? "카탈로그 적재 완료. 사용자 데이터와 기존 큐레이션 ID는 유지했습니다."
      : "검토 완료. --apply를 추가하면 적재합니다.",
  );
} finally {
  await sql.end({ timeout: 5 });
}
