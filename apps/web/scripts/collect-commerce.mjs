#!/usr/bin/env node
// ─────────────────────────────────────────────
// TourAPI 식사(39)/숙박(32) 후보 수집 → commerce_profile 적재.
//
// 사용법 (apps/web 에서):
//   pnpm db:collect:commerce            # 권역당 종류별 10건
//   COLLECT_ROWS=20 pnpm db:collect:commerce
//
// 설계 (운영-준비-플랜 §4.1):
//   - 멱등 upsert(id 충돌 시 갱신) — 여러 번 실행해도 안전하다.
//     지금은 수동 실행이지만, 그대로 별도 배치 프로세스(cron)에 옮겨 주기 실행할 수 있다.
//   - 삭제(prune)는 하지 않는다 — 코스 템플릿이 참조 중일 수 있어 수동 판단.
//   - 시군구 코드는 하드코딩하지 않고 areaCode2 로 매 실행 시 조회해
//     권역명(REGIONS ko: 강릉/속초/…)과 접두 매칭한다(코드 변경·오타에 안전).
//   - region_ko 는 REGIONS 권역명으로 저장 — composeCourse.pickByRegion 이
//     스팟의 region_ko 와 문자열 일치로 매칭하기 때문(스팟과 같은 이름 체계 필수).
// ─────────────────────────────────────────────

const C = { green: "\x1b[32m", red: "\x1b[31m", gray: "\x1b[90m", cyan: "\x1b[36m", yellow: "\x1b[33m", reset: "\x1b[0m" };
const URL_DB = process.env.DATABASE_URL;
const SCHEMA = (process.env.DATABASE_SCHEMA || "public").trim();
const SERVICE_KEY = process.env.TOUR_API_SERVICE_KEY;
const ROWS = Math.max(1, Math.min(50, Number(process.env.COLLECT_ROWS) || 10));

if (!URL_DB) {
  console.error(`${C.red}✗ DATABASE_URL 이 비어 있습니다.${C.reset} 루트 .env 를 확인하세요.`);
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error(`${C.red}✗ TOUR_API_SERVICE_KEY 가 비어 있습니다.${C.reset} 루트 .env 를 확인하세요.`);
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
const qTable = `${quoteIdent(SCHEMA)}.${quoteIdent("commerce_profile")}`;

// ── 대상 권역 (server/public-api/regions.ts 의 REGIONS ko/en 과 동일 체계) ──
const TARGET_REGIONS = [
  { ko: "강릉", en: "Gangneung" },
  { ko: "속초", en: "Sokcho" },
  { ko: "양양", en: "Yangyang" },
  { ko: "평창", en: "Pyeongchang" },
  { ko: "정선", en: "Jeongseon" },
  { ko: "인제", en: "Inje" },
  { ko: "춘천", en: "Chuncheon" },
  { ko: "원주", en: "Wonju" },
];

// ── TourAPI 소분류(cat3) → 표시용 종류 라벨 ──
const FOOD_TYPE = {
  A05020100: "한식",
  A05020200: "서양식",
  A05020300: "일식",
  A05020400: "중식",
  A05020700: "이색음식점",
  A05020900: "카페·찻집",
  A05021000: "클럽",
};
const STAY_TYPE = {
  B02010100: "관광호텔",
  B02010500: "콘도미니엄",
  B02010600: "유스호스텔",
  B02010700: "펜션",
  B02010900: "모텔",
  B02011000: "민박",
  B02011100: "게스트하우스",
  B02011200: "홈스테이",
  B02011300: "레지던스",
  B02011600: "한옥",
};

const KINDS = [
  { kind: "eat", contentTypeId: 39, typeOf: (cat3) => FOOD_TYPE[cat3] ?? "음식점" },
  { kind: "stay", contentTypeId: 32, typeOf: (cat3) => STAY_TYPE[cat3] ?? "숙소" },
];

// ── TourAPI 호출 (http.ts 와 동일하게 serviceKey 1회 인코딩 — Decoding 원본 키 전제) ──
const BASE = "https://apis.data.go.kr/B551011/KorService2";
const COMMON = { MobileOS: "ETC", MobileApp: "eumgil", _type: "json" };

async function callTour(operation, params) {
  const u = new URL(`${BASE}/${operation}`);
  u.searchParams.set("serviceKey", SERVICE_KEY);
  for (const [k, v] of Object.entries({ ...COMMON, ...params })) u.searchParams.set(k, String(v));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(u, { signal: ctrl.signal });
    const text = await res.text();
    if (text.trimStart().startsWith("<")) {
      const msg = /<returnAuthMsg>(.*?)<\/returnAuthMsg>/.exec(text)?.[1] ?? "XML 오류 응답";
      throw new Error(`${operation}: ${msg}`);
    }
    const json = JSON.parse(text);
    const header = json?.response?.header;
    if (header?.resultCode !== "0000") throw new Error(`${operation}: ${header?.resultMsg ?? "unknown"} (${header?.resultCode})`);
    const items = json?.response?.body?.items;
    if (!items) return [];
    return Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 시군구 코드 조회: "강릉" ↔ "강릉시" 접두 매칭 ──
async function resolveSigunguCodes() {
  const rows = await callTour("areaCode2", { areaCode: 32, numOfRows: 50, pageNo: 1 });
  const resolved = [];
  for (const region of TARGET_REGIONS) {
    const hit = rows.find((r) => typeof r?.name === "string" && r.name.startsWith(region.ko));
    if (!hit?.code) {
      console.log(`${C.yellow}– ${region.ko}: 시군구 코드 미발견 → 건너뜀${C.reset}`);
      continue;
    }
    resolved.push({ ...region, sigunguCode: hit.code, sigunguName: hit.name });
  }
  return resolved;
}

const masked = URL_DB.replace(/(:\/\/[^:]+:)[^@]+@/, "$1****@");
console.log(`\nTourAPI 식사/숙박 수집 → ${masked}\n대상 스키마: ${C.cyan}${SCHEMA}${C.reset} · 권역당 종류별 ${ROWS}건\n──────────────────────────────`);

const sql = postgres(URL_DB, { prepare: false, idle_timeout: 5, connect_timeout: 8, max: 1 });

try {
  const regions = await resolveSigunguCodes();
  if (regions.length === 0) throw new Error("시군구 코드를 하나도 찾지 못했습니다 (areaCode2 응답 확인 필요).");

  let total = 0;
  for (const region of regions) {
    for (const { kind, contentTypeId, typeOf } of KINDS) {
      await sleep(200); // 쿼터 완화용 직렬 호출
      const items = await callTour("areaBasedList2", {
        areaCode: 32,
        sigunguCode: region.sigunguCode,
        contentTypeId,
        numOfRows: ROWS,
        pageNo: 1,
        arrange: "C", // 수정일순 + 대표이미지 있는 항목 우선
      });

      let n = 0;
      for (const it of items) {
        const contentId = it?.contentid;
        const title = (it?.title ?? "").trim();
        if (!contentId || !title) continue;
        await sql`
          insert into ${sql(SCHEMA)}.commerce_profile
            (id, kind, name_ko, name_en, type_ko, type_en, region_ko, region_en, price_ko, price_en,
             rating, addr, tel, lat, lon, image_url, source, source_content_id, updated_at)
          values
            (${`${kind}-${contentId}`}, ${kind}, ${title}, ${null}, ${typeOf(it?.cat3 ?? "")}, ${null},
             ${region.ko}, ${region.en}, ${""}, ${null}, ${0},
             ${it?.addr1 ?? null}, ${it?.tel ?? null},
             ${it?.mapy ? Number(it.mapy) : null}, ${it?.mapx ? Number(it.mapx) : null},
             ${it?.firstimage || null}, ${"tourapi"}, ${String(contentId)}, now())
          on conflict (id) do update set
            name_ko = excluded.name_ko,
            type_ko = excluded.type_ko,
            region_ko = excluded.region_ko,
            region_en = excluded.region_en,
            addr = excluded.addr,
            tel = excluded.tel,
            lat = excluded.lat,
            lon = excluded.lon,
            image_url = coalesce(excluded.image_url, commerce_profile.image_url),
            updated_at = now()
        `;
        n++;
      }
      total += n;
      console.log(`${C.green}✓${C.reset} ${region.ko}(${region.sigunguName}) ${kind === "eat" ? "음식점" : "숙박"} ${n}건 upsert`);
    }
  }

  const counts = await sql.unsafe(`select kind, count(*)::int as n from ${qTable} group by kind order by kind`);
  console.log(`──────────────────────────────\n${C.green}✓ 수집 완료${C.reset} 이번 실행 ${total}건 upsert · 테이블 합계: ${counts.map((r) => `${r.kind} ${r.n}`).join(" · ")}\n`);
} catch (e) {
  console.error(`${C.red}✗ 수집 실패 — ${e instanceof Error ? e.message : String(e)}${C.reset}`);
  console.error(`${C.gray}선행 조건: pnpm db:apply (commerce_profile 테이블), TOUR_API_SERVICE_KEY(Decoding 원본 키).${C.reset}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
