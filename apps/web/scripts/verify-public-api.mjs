#!/usr/bin/env node
// ─────────────────────────────────────────────
// 공공 API 키 연결 검증 스크립트
//
// 사용법 (루트에서):
//   node --env-file=.env apps/web/scripts/verify-public-api.mjs
//
// .env 의 각 서비스키로 실제 1회 호출해 연결 상태를 출력한다.
//   ✓ 연결됨   ✗ 오류(메시지)   – 키없음(건너뜀)   ? 수동확인 권장
//
// 진단 정보: HTTP 상태코드 + 응답 형태(JSON/XML/HTML) + 키 지문(길이/끝 4자/중복 여부).
// data.go.kr 는 계정당 인증키 1개로 승인된 모든 서비스를 호출한다 →
//   TOUR/KMA/AIRKOREA 키는 보통 같은 값이어야 한다(아래 지문으로 확인).
// 개발계정 자동승인이라도 발급 직후 1~2시간 반영 지연이 있을 수 있다.
// ─────────────────────────────────────────────

const KST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");

async function getRes(url, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return { status: res.status, ctype: res.headers.get("content-type") ?? "", text: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

function shape(text) {
  const s = text.trimStart();
  if (s.startsWith("{") || s.startsWith("[")) return "JSON";
  if (/^<\?xml|^<response|^<OpenAPI/i.test(s)) return "XML";
  if (s.startsWith("<")) return "HTML";
  return "TEXT";
}

function parseMaybeJson(text) {
  const s = text.trimStart();
  if (s.startsWith("<")) {
    const msg = /<returnAuthMsg>(.*?)<\/returnAuthMsg>/.exec(s)?.[1];
    const code = /<returnReasonCode>(.*?)<\/returnReasonCode>/.exec(s)?.[1];
    return { xmlError: msg ? `${msg}${code ? ` (${code})` : ""}` : null };
  }
  try {
    return { json: JSON.parse(text) };
  } catch {
    return {};
  }
}

const build = (base, params, key) => {
  const u = new URL(base);
  u.searchParams.set("serviceKey", key);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
};

const statusHint = (s) =>
  s === 401
    ? " → 키 미인식(키 값 오류/누락)"
    : s === 403
      ? " → 키는 유효하나 이 서비스 권한 없음: data.go.kr 활용신청 '승인' 여부·반영(최대 1~2h) 확인"
      : s === 400
        ? " → 요청 파라미터 오류"
        : "";
const diag = (r) => `[HTTP ${r.status} · ${shape(r.text)}] ${r.text.replace(/\s+/g, " ").trim().slice(0, 100)}${statusHint(r.status)}`;

// ── 자동 프로브 (https 사용) ──────────────────
async function probeTourApi(key) {
  const r = await getRes(
    build("https://apis.data.go.kr/B551011/KorService2/areaBasedList2", { MobileOS: "ETC", MobileApp: "eumgil", _type: "json", areaCode: 32, numOfRows: 1, pageNo: 1 }, key),
  );
  const p = parseMaybeJson(r.text);
  if (p.json?.response?.header?.resultCode === "0000")
    return { ok: true, msg: `강원 totalCount=${p.json.response.body?.totalCount ?? "?"}` };
  return { ok: false, msg: p.xmlError ?? diag(r) };
}

async function probeKma(key) {
  const r = await getRes(
    build("https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst", { dataType: "JSON", base_date: KST(), base_time: "0500", nx: 92, ny: 131, numOfRows: 1, pageNo: 1 }, key),
  );
  const p = parseMaybeJson(r.text);
  const code = p.json?.response?.header?.resultCode;
  if (code === "00" || code === "03") return { ok: true, msg: `resultCode=${code}` };
  return { ok: false, msg: p.xmlError ?? diag(r) };
}

async function probeAirKorea(key) {
  const r = await getRes(
    build("https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty", { returnType: "json", sidoName: "강원", numOfRows: 1, pageNo: 1, ver: "1.0" }, key),
  );
  const p = parseMaybeJson(r.text);
  if (p.json?.response?.header?.resultCode === "00")
    return { ok: true, msg: `강원 측정소 ${p.json.response.body?.totalCount ?? "?"}곳` };
  return { ok: false, msg: p.xmlError ?? diag(r) };
}

const CHECKS = [
  { name: "1. 국문 관광정보(TourAPI)", env: "TOUR_API_SERVICE_KEY", probe: probeTourApi },
  { name: "4. 기상청 단기예보", env: "KMA_SERVICE_KEY", probe: probeKma },
  { name: "5. 기상청 생활기상지수", env: "KMA_SERVICE_KEY", manual: "단기예보와 동일 KMA 키(4번으로 검증)" },
  { name: "6. 에어코리아 대기오염", env: "AIRKOREA_SERVICE_KEY", probe: probeAirKorea },
  { name: "2. 관광 빅데이터 방문자수", env: "TOUR_BIGDATA_SERVICE_KEY", manual: "파라미터 확정 후 자동화 예정" },
  { name: "3. 관광지 집중률 예측", env: "TOUR_BIGDATA_SERVICE_KEY", manual: "데이터랩 형태 확인 후 자동화 예정" },
  { name: "7. 한국도로공사 실시간 소통", env: "EX_ROAD_SERVICE_KEY", manual: "data.ex.co.kr 확정 후 자동화 예정" },
];

const C = { green: "\x1b[32m", red: "\x1b[31m", gray: "\x1b[90m", yellow: "\x1b[33m", cyan: "\x1b[36m", reset: "\x1b[0m" };
const fp = (k) => (k ? `len=${k.length} …${k.slice(-4)}` : "(없음)");

// ── 키 지문 (같은 값인지 확인) ───────────────
console.log("\n공공 API 연결 검증\n──────────────────────────────");
const tour = process.env.TOUR_API_SERVICE_KEY;
const kma = process.env.KMA_SERVICE_KEY;
const air = process.env.AIRKOREA_SERVICE_KEY;
console.log(`${C.cyan}키 지문${C.reset}`);
console.log(`  TOUR     ${fp(tour)}`);
console.log(`  KMA      ${fp(kma)}${kma && tour ? (kma === tour ? `  ${C.gray}(TOUR와 동일)${C.reset}` : `  ${C.yellow}(TOUR와 다름!)${C.reset}`) : ""}`);
console.log(`  AIRKOREA ${fp(air)}${air && tour ? (air === tour ? `  ${C.gray}(TOUR와 동일)${C.reset}` : `  ${C.yellow}(TOUR와 다름!)${C.reset}`) : ""}`);
console.log(`  ${C.gray}※ data.go.kr 는 계정당 인증키 1개 — 세 값이 같아야 정상인 경우가 많음${C.reset}`);
console.log("──────────────────────────────");

for (const check of CHECKS) {
  const key = process.env[check.env];
  if (!key) {
    console.log(`${C.gray}–  ${check.name} — 키없음 (${check.env})${C.reset}`);
    continue;
  }
  if (check.manual) {
    console.log(`${C.yellow}?  ${check.name} — 키 설정됨, ${check.manual}${C.reset}`);
    continue;
  }
  try {
    const r = await check.probe(key);
    console.log(`${r.ok ? C.green + "✓" : C.red + "✗"}  ${check.name} — ${r.msg}${C.reset}`);
  } catch (e) {
    console.log(`${C.red}✗  ${check.name} — ${e instanceof Error ? e.message : String(e)}${C.reset}`);
  }
}
console.log("──────────────────────────────\n");
