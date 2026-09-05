#!/usr/bin/env node
// 무장애 안내 보유 목록만 DB에 저장한다. 시설별 상세는 요청 시 24시간 캐시로 조회한다.
import fs from "node:fs/promises";
import postgres from "postgres";
const apply = process.argv.includes("--apply");
const input = process.argv.indexOf("--input");
let snapshot;
if (input >= 0) snapshot = JSON.parse(await fs.readFile(process.argv[input + 1], "utf8"));
else {
  if (!process.env.DATA_GO_KR_SERVICE_KEY) throw Error("DATA_GO_KR_SERVICE_KEY가 필요합니다.");
  const items = [];
  let total = 1;
  for (let page = 1; items.length < total; page++) {
    if (page > 10) throw Error("무장애 목록 페이지 한도 초과");
    const url = new URL("https://apis.data.go.kr/B551011/KorWithService2/areaBasedList2");
    for (const [k, v] of Object.entries({
      serviceKey: process.env.DATA_GO_KR_SERVICE_KEY,
      MobileOS: "ETC",
      MobileApp: "eumgil",
      _type: "json",
      lDongRegnCd: 51,
      numOfRows: 1000,
      pageNo: page,
    }))
      url.searchParams.set(k, String(v));
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(`무장애 목록 HTTP ${response.status}`);
    const data = await response.json();
    if (!/^0+$/.test(data.response?.header?.resultCode || "")) throw Error("무장애 목록 응답 오류");
    const rows = data.response?.body?.items?.item;
    total = Number(data.response?.body?.totalCount);
    if (!Array.isArray(rows) || !rows.length || !Number.isFinite(total))
      throw Error("불완전한 무장애 목록");
    items.push(...rows);
  }
  snapshot = { fetchedAt: new Date().toISOString(), total, items };
}
if (
  !Array.isArray(snapshot.items) ||
  snapshot.items.length !== snapshot.total ||
  snapshot.total < 1
)
  throw Error("무장애 목록이 불완전합니다.");
const ids = [
  ...new Set(
    snapshot.items.map((r) => r.contentid).filter((v) => typeof v === "string" && /^\d+$/.test(v)),
  ),
];
console.log({ fetchedAt: snapshot.fetchedAt, sourceCount: snapshot.total, apply });
if (apply) {
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 10,
    onnotice: () => {},
  });
  const table = sql(`${process.env.DATABASE_SCHEMA || "public"}.spot_profile`);
  try {
    await sql.begin(async (tx) => {
      await tx`alter table ${table} add column if not exists has_accessibility_info boolean not null default false`;
      await tx`update ${table} set has_accessibility_info=(source_content_id=any(${ids}::text[])) where source_content_id is not null`;
      const [counts] =
        await tx`select count(*)::int as spots,count(*) filter(where has_accessibility_info)::int as with_accessibility_info,count(*) filter(where image_url is not null and image_url<>'')::int as with_photo,count(*) filter(where jsonb_typeof(theme_ids)<>'array')::int as invalid_theme_arrays from ${table}`;
      console.log(counts);
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
