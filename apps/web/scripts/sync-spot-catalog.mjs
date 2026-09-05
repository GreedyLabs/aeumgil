#!/usr/bin/env node
// 검증된 매핑의 실제 좌표·사진만 보강한다. 기본은 미리보기, --apply로 DB에 반영.
import postgres from "postgres";
import { readFileSync } from "node:fs";
import ts from "typescript";
// Node 20에서도 실행되도록 타입 선언만 제거한다. 외부 입력 코드는 실행하지 않는다.
const source = readFileSync(new URL("../src/data/live/spot-mapping.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const { SPOT_MAPPING } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const selected = process.argv.find((x) => x.startsWith("--spot="))?.slice(7);
const apply = process.argv.includes("--apply");
const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
if (!serviceKey || !process.env.DATABASE_URL)
  throw new Error("DATA_GO_KR_SERVICE_KEY와 DATABASE_URL이 필요합니다.");
const schema = process.env.DATABASE_SCHEMA || "public";
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw new Error("잘못된 DB schema");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10 });
async function get(op, params) {
  const url = new URL("https://apis.data.go.kr/B551011/KorService2/" + op);
  for (const [k, v] of Object.entries({
    serviceKey,
    MobileOS: "ETC",
    MobileApp: "eumgil",
    _type: "json",
    pageNo: 1,
    numOfRows: 30,
    ...params,
  }))
    url.searchParams.set(k, String(v));
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("TourAPI HTTP " + res.status);
  const data = await res.json();
  const code = data.response?.header?.resultCode;
  if (!["0000", "00"].includes(code)) throw new Error("TourAPI 결과 코드 " + code);
  const raw = data.response?.body?.items?.item;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}
let failed = 0;
try {
  for (const [spotId, mapping] of Object.entries(SPOT_MAPPING)) {
    if (selected && selected !== spotId) continue;
    if (!mapping.tourContentId) continue;
    try {
      const detail = (
        await get("detailCommon2", { contentId: mapping.tourContentId, numOfRows: 1 })
      )[0];
      if (!detail || detail.contentid !== mapping.tourContentId)
        throw new Error("관광지 ID 불일치");
      const lat = Number(detail.mapy),
        lon = Number(detail.mapx);
      if (
        !detail.mapy ||
        !detail.mapx ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < 37 ||
        lat > 39 ||
        lon < 127 ||
        lon > 130
      )
        throw new Error("강원 좌표 범위 확인 필요");
      let image = detail.firstimage;
      if (!image)
        image = (
          await get("detailImage2", { contentId: mapping.tourContentId, imageYN: "Y" })
        ).find((x) => x.cpyrhtDivCd === "Type1")?.originimgurl;
      if (apply) {
        const rows = await sql.unsafe(
          `UPDATE "${schema}".spot_profile SET source_content_id=$1,lat=$2,lon=$3,image_url=COALESCE(NULLIF($4,''),image_url) WHERE spot_id=$5 RETURNING spot_id`,
          [mapping.tourContentId, lat, lon, image || "", spotId],
        );
        if (rows.length !== 1) throw new Error("기존 DB 관광지 없음");
      }
      console.log(
        apply ? "반영" : "미리보기",
        spotId,
        mapping.tourContentId,
        detail.title,
        "사진",
        !!image,
      );
    } catch (e) {
      failed++;
      console.error(spotId, e.message);
    }
  }
} finally {
  await sql.end();
}
if (failed) process.exitCode = 1;
