#!/usr/bin/env node
// ─────────────────────────────────────────────
// 실응답 수집 헬퍼 (로컬 1회 실행 — 샌드박스는 data.go.kr egress 불가).
//
// 사용법 (루트에서):
//   pnpm --filter @eumgil/web find:content
//   (또는) node --env-file=.env apps/web/scripts/find-content-ids.mjs
//
// 출력:
//   1) 9개 큐레이션 스팟별 TourAPI searchKeyword2(강원 areaCode=32) 후보
//      → contentId / title / addr / mapx(경도) / mapy(위도)
//   2) 기상청 getVilageFcst 샘플 1건의 category 목록 (정규화 검증·테스트 픽스처용)
//   3) 에어코리아 강원 측정정보 샘플 item 1건의 필드
//
// 이 출력을 그대로 붙여주면 → spot-mapping.ts 시드 확정 + API 정규화 테스트(②) 작성.
// ─────────────────────────────────────────────

const TOUR = process.env.TOUR_API_SERVICE_KEY;
const KMA = process.env.KMA_SERVICE_KEY;
const AIR = process.env.AIRKOREA_SERVICE_KEY;

// ── 격자 변환 (grid.ts 와 동일 표준식) ──
const DEGRAD = Math.PI / 180;
function latLonToGrid(lat, lon) {
  const re = 6371.00877 / 5.0,
    slat1 = 30 * DEGRAD,
    slat2 = 60 * DEGRAD,
    olon = 126 * DEGRAD,
    olat = 38 * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + 43 + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5),
  };
}

async function getJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    const text = await res.text();
    if (text.trimStart().startsWith("<")) {
      const msg = /<returnAuthMsg>(.*?)<\/returnAuthMsg>/.exec(text)?.[1];
      throw new Error(`XML 오류 응답${msg ? ` (${msg})` : ""}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

function buildUrl(base, params, key) {
  const u = new URL(base);
  u.searchParams.set("serviceKey", key);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u;
}

// ── 검색 대상: 큐레이션 스팟 id → 검색 키워드 후보(앞에서부터 결과 나올 때까지 시도) ──
// 1차 조회에서 후보 없음/타입 불일치였던 스팟은 키워드를 넓혔다.
const SPOTS = [
  ["anmok-beach", ["안목", "안목해변", "강릉커피거리"]],
  ["sacheon-beach", ["사천해변", "사천진", "사천진해변"]],
  ["ojukheon", ["오죽헌", "강릉 오죽헌"]], // type 12/14 POI 우선(여행코스 type25 제외 표시)
  ["daegwallyeong-sheep", ["양떼목장", "대관령양떼목장", "대관령"]],
  ["woljeongsa-trail", ["선재길", "오대산 선재길", "월정사"]],
  ["seorak-gwongeum", ["권금성"]],
  ["sokcho-market", ["속초관광수산시장", "속초수산시장"]],
  ["dongmyeong-port", ["동명항"]],
  ["jumunjin-cafe", ["주문진 카페", "주문진해변", "주문진"]],
];

const TOUR_BASE = "http://apis.data.go.kr/B551011/KorService2";
const COMMON = { MobileOS: "ETC", MobileApp: "eumgil", _type: "json" };

async function searchOnce(keyword) {
  const url = buildUrl(
    `${TOUR_BASE}/searchKeyword2`,
    { ...COMMON, areaCode: 32, keyword, numOfRows: 5, pageNo: 1, arrange: "C" },
    TOUR,
  );
  const data = await getJson(url);
  const items = data?.response?.body?.items;
  const arr = items && items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : [];
  return arr.map((it) => ({
    contentId: it.contentid,
    typeId: it.contenttypeid,
    title: it.title,
    addr: it.addr1 ?? "",
    mapx: it.mapx,
    mapy: it.mapy,
  }));
}

/** 키워드 후보를 앞에서부터 시도해 결과가 나오는 첫 키워드를 사용. */
async function searchSpot(keywords) {
  for (const kw of keywords) {
    const cands = await searchOnce(kw);
    if (cands.length > 0) return { used: kw, cands };
  }
  return { used: keywords[keywords.length - 1], cands: [] };
}

async function main() {
  if (!TOUR || !KMA || !AIR) {
    console.error("키 누락 — TOUR/KMA/AIRKOREA 키가 .env 에 있어야 합니다. (--env-file 확인)");
    process.exit(1);
  }

  console.log("\n══════════ 1) TourAPI 스팟 검색 후보 ══════════");
  console.log("  (type: 12관광지 14문화시설 15행사 25여행코스 28레포츠 32숙박 38쇼핑 39음식점)");
  for (const [id, keywords] of SPOTS) {
    try {
      const { used, cands } = await searchSpot(keywords);
      console.log(`\n● ${id}  (검색어: "${used}")`);
      if (cands.length === 0) console.log("   (후보 없음 — 키워드 조정 필요)");
      cands.forEach((c, i) =>
        console.log(
          `   ${i + 1}. id=${c.contentId} type=${c.typeId} "${c.title}" | ${c.addr} | x=${c.mapx} y=${c.mapy}`,
        ),
      );
    } catch (e) {
      console.log(`\n● ${id}  검색 실패: ${e.message}`);
    }
  }

  // 2) KMA 단기예보 샘플 (강릉 격자)
  console.log("\n══════════ 2) KMA getVilageFcst 샘플 ══════════");
  try {
    const { nx, ny } = latLonToGrid(37.7519, 128.8761); // 강릉
    const now = new Date(Date.now() + 9 * 3600 * 1000);
    const slots = [2, 5, 8, 11, 14, 17, 20, 23];
    const h = now.getUTCHours();
    let slot = slots.filter((s) => h > s || (h === s && now.getUTCMinutes() >= 15)).pop();
    if (slot === undefined) {
      now.setUTCDate(now.getUTCDate() - 1);
      slot = 23;
    }
    const baseDate = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
    const url = buildUrl(
      "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst",
      { dataType: "JSON", MobileOS: "ETC", MobileApp: "eumgil", numOfRows: 60, pageNo: 1, base_date: baseDate, base_time: `${String(slot).padStart(2, "0")}00`, nx, ny },
      KMA,
    );
    const data = await getJson(url);
    const items = data?.response?.body?.items?.item ?? [];
    const first = items[0]?.fcstDate + items[0]?.fcstTime;
    const slice = items.filter((it) => it.fcstDate + it.fcstTime === first);
    console.log(`   격자 nx=${nx} ny=${ny}, 첫 예보시점 ${first}`);
    console.log("   카테고리:", slice.map((it) => `${it.category}=${it.fcstValue}`).join(", "));
  } catch (e) {
    console.log("   실패:", e.message);
  }

  // 3) 에어코리아 강원 샘플
  console.log("\n══════════ 3) 에어코리아 강원 측정 샘플 ══════════");
  try {
    const url = buildUrl(
      "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty",
      { returnType: "json", numOfRows: 5, pageNo: 1, sidoName: "강원", ver: "1.3" },
      AIR,
    );
    const data = await getJson(url);
    const items = data?.response?.body?.items ?? [];
    const arr = Array.isArray(items) ? items : [items];
    console.log("   측정소 수(페이지):", arr.length);
    const s = arr[0] ?? {};
    console.log(
      `   샘플: station=${s.stationName} khaiGrade=${s.khaiGrade} pm10=${s.pm10Value}(${s.pm10Grade}) pm25=${s.pm25Value}`,
    );
  } catch (e) {
    console.log("   실패:", e.message);
  }

  // 4) 에어코리아 강원 측정소 전체 목록 (권역→측정소 매핑 보정용)
  console.log("\n══════════ 4) 강원 측정소 전체 목록 ══════════");
  try {
    const url = buildUrl(
      "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty",
      { returnType: "json", numOfRows: 100, pageNo: 1, sidoName: "강원", ver: "1.3" },
      AIR,
    );
    const data = await getJson(url);
    const items = data?.response?.body?.items ?? [];
    const arr = Array.isArray(items) ? items : [items];
    const names = arr.map((s) => s.stationName).filter(Boolean);
    console.log(`   (${names.length}곳) ${names.join(", ")}`);
  } catch (e) {
    console.log("   실패:", e.message);
  }

  console.log("\n──────────────────────────────");
  console.log("위 출력을 그대로 붙여주세요 → contentId 시드 확정 + 측정소 매핑 보정.\n");
}

main();
