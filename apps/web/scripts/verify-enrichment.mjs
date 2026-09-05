#!/usr/bin/env node
// ─────────────────────────────────────────────
// 보강 검증 스크립트 (로컬 1회 실행 — 샌드박스는 data.go.kr egress 불가).
//
// 사용법 (루트에서):
//   pnpm --filter @eumgil/web verify:enrichment
//   (또는) node --env-file=.env apps/web/scripts/verify-enrichment.mjs
//
// 무엇을 확인하나:
//   1) TourAPI detailCommon2 보강 — spot-mapping.ts 의 contentId 가 있는 스팟마다
//      실제 호출해 title/타입/주소/대표이미지/개요가 정상으로 오는지.
//      특히 sacheon-beach(2773046, 사천진'항' 프록시)·woljeongsa-trail(2022311, type28)
//      처럼 성격이 어긋날 수 있는 건은 눈으로 확인.
//   2) 에어코리아 측정소 매핑 — regions.ts 의 station 명이 강원 실응답에 실제로
//      존재하고 유효 등급(khaiGrade>0)으로 매칭되는지 (없으면 시도 평균 폴백).
//
// ※ 아래 두 테이블은 spot-mapping.ts / regions.ts 를 그대로 미러링한다. 원본을 바꾸면
//   여기도 같이 갱신할 것(검증 스크립트라 의존성 없이 독립 실행되도록 값만 복사).
// ─────────────────────────────────────────────

const TOUR = process.env.DATA_GO_KR_SERVICE_KEY;
const AIR = process.env.DATA_GO_KR_SERVICE_KEY;

// spot-mapping.ts 미러 — contentId 가 있는 스팟만(null 은 보강 대상 아님)
const SPOT_CONTENT = [
  ["anmok-beach", "127722"],
  ["ojukheon", "129784"],
  ["daegwallyeong-sheep", "129263"],
  ["seorak-gwongeum", "125798"],
  ["sokcho-market", "1260275"],
  ["dongmyeong-port", "129454"],
  ["sacheon-beach", "585526"], // 실제 사천진해변(type12)
  ["woljeongsa-trail", "2022311"], // 오대산 선재길(type28) — 개요/이미지 응답 확인
];

// regions.ts 미러 — station 이 빈 문자열이면 시도 평균 폴백(검증 생략)
const REGION_STATION = [
  ["gangneung", "옥천동"],
  ["sokcho", "중앙동"],
  ["yangyang", "양양읍"],
  ["pyeongchang", "평창읍"],
  ["jeongseon", "정선읍"],
  ["inje", "인제읍"],
  ["chuncheon", "온의동"],
  ["wonju", "반곡동"],
];

const TYPE_LABEL = {
  12: "관광지", 14: "문화시설", 15: "행사", 25: "여행코스",
  28: "레포츠", 32: "숙박", 38: "쇼핑", 39: "음식점",
};

const C = { green: "\x1b[32m", red: "\x1b[31m", gray: "\x1b[90m", yellow: "\x1b[33m", cyan: "\x1b[36m", reset: "\x1b[0m" };

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

// airkorea.ts 와 동일: 괄호 접미사·공백 제거 ("중앙동(강원)" → "중앙동")
const normStation = (name) => (name ?? "").replace(/\(.*?\)/g, "").trim();

const TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2";
const COMMON = { MobileOS: "ETC", MobileApp: "eumgil", _type: "json" };

// detailCommon2 를 호출하고 {item, code, msg, snippet} 를 돌려준다.
async function callDetail(contentId, params) {
  const url = buildUrl(`${TOUR_BASE}/detailCommon2`, { ...COMMON, contentId, ...params }, TOUR);
  const data = await getJson(url);
  const header = data?.response?.header ?? {};
  const item = data?.response?.body?.items?.item;
  return {
    item: Array.isArray(item) ? item[0] : item,
    code: header.resultCode,
    msg: header.resultMsg,
    snippet: JSON.stringify(data).replace(/\s+/g, " ").slice(0, 160),
  };
}

// 파라미터 셋 시도 순서 — minimal 이 정답(2026-06-23 확인, getItemDetail 도 이 셋 사용).
// YN플래그 셋은 회귀 감시용 폴백으로 남겨둠(KorService2 가 다시 받기 시작하면 그쪽으로 표시).
const PARAM_VARIANTS = [
  ["minimal(플래그 없음)", { numOfRows: 1, pageNo: 1 }],
  ["YN플래그(구 KorService1)", { defaultYN: "Y", firstImageYN: "Y", addrinfoYN: "Y", mapinfoYN: "Y", overviewYN: "Y" }],
];

async function fetchDetail(contentId) {
  let firstDiag = null;
  for (const [label, params] of PARAM_VARIANTS) {
    try {
      const r = await callDetail(contentId, params);
      if (r.item) return { item: r.item, variant: label };
      firstDiag ??= { label, code: r.code, msg: r.msg, snippet: r.snippet };
    } catch (e) {
      firstDiag ??= { label, code: "EXC", msg: e.message, snippet: "" };
    }
  }
  return { item: null, diag: firstDiag };
}

async function main() {
  if (!TOUR || !AIR) {
    console.error("키 누락 — DATA_GO_KR_SERVICE_KEY 가 .env 에 있어야 합니다. (--env-file 확인)");
    process.exit(1);
  }

  // ── 1) detailCommon2 보강 검증 ──────────────
  console.log("\n══════════ 1) TourAPI detailCommon2 보강 검증 ══════════");
  for (const [id, contentId] of SPOT_CONTENT) {
    try {
      const { item: d, variant, diag } = await fetchDetail(contentId);
      if (!d) {
        console.log(`${C.red}✗ ${id} (id=${contentId}) — 양쪽 파라미터 모두 item 없음${C.reset}`);
        if (diag) console.log(`${C.gray}   [${diag.label}] resultCode=${diag.code} msg=${diag.msg}\n   raw: ${diag.snippet}${C.reset}`);
        continue;
      }
      const type = `${d.contenttypeid}${TYPE_LABEL[d.contenttypeid] ? `(${TYPE_LABEL[d.contenttypeid]})` : ""}`;
      const img = d.firstimage ? `${C.green}있음${C.reset}` : `${C.yellow}없음${C.reset}`;
      const ov = (d.overview ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const ovShow = ov ? `${ov.slice(0, 70)}${ov.length > 70 ? "…" : ""}` : `${C.yellow}(개요 없음)${C.reset}`;
      const warn = !d.firstimage || !ov ? `  ${C.yellow}⚠ 이미지/개요 일부 비어있음${C.reset}` : "";
      console.log(`${C.green}✓${C.reset} ${C.cyan}${id}${C.reset} (id=${contentId})  ${C.gray}[${variant}]${C.reset}${warn}`);
      console.log(`   title="${d.title}"  type=${type}`);
      console.log(`   addr=${d.addr1 ?? "-"}  | 좌표 x=${d.mapx} y=${d.mapy}  | 이미지=${img}`);
      console.log(`   개요: ${ovShow}`);
    } catch (e) {
      console.log(`${C.red}✗ ${id} (id=${contentId}) — ${e.message}${C.reset}`);
    }
  }

  // ── 2) 측정소 매핑 검증 ─────────────────────
  console.log("\n══════════ 2) 에어코리아 측정소 매핑 검증 ══════════");
  try {
    const url = buildUrl(
      "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty",
      { returnType: "json", numOfRows: 200, pageNo: 1, sidoName: "강원", ver: "1.3" },
      AIR,
    );
    const data = await getJson(url);
    const items = data?.response?.body?.items ?? [];
    const arr = Array.isArray(items) ? items : [items];
    const live = arr.map((s) => ({ name: normStation(s.stationName), grade: Number(s.khaiGrade) || 0 }));

    for (const [region, station] of REGION_STATION) {
      const target = normStation(station);
      const hit = live.find((a) => a.name === target && a.grade > 0);
      const present = live.find((a) => a.name === target); // 등급 0 이라도 존재하는지
      if (hit) {
        console.log(`${C.green}✓${C.reset} ${region.padEnd(12)} station="${station}" → 매칭 (khaiGrade=${hit.grade})`);
      } else if (present) {
        console.log(`${C.yellow}~ ${region.padEnd(12)} station="${station}" → 측정소는 존재하나 등급 0(일시) → 폴백${C.reset}`);
      } else {
        console.log(`${C.red}✗ ${region.padEnd(12)} station="${station}" → 실응답에 없음 → 시도 평균 폴백${C.reset}`);
      }
    }
    console.log(`${C.gray}   (참조: 강원 실측정소 ${live.length}곳)${C.reset}`);
  } catch (e) {
    console.log(`${C.red}✗ 측정소 목록 조회 실패 — ${e.message}${C.reset}`);
  }

  console.log("\n──────────────────────────────");
  console.log("✓ 정상 / ~ 일시 등급0(폴백) / ✗ 보정 필요. 값 변경 시 spot-mapping.ts·regions.ts 와 함께 갱신.\n");
}

main();
