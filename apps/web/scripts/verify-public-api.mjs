#!/usr/bin/env node
// 실제 연결·응답 품질을 함께 확인한다. 키·원문 응답은 로그에 남기지 않는다.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
const root = new URL("../../../", import.meta.url);
config({ path: fileURLToPath(new URL(".env.local", root)) });
config({ path: fileURLToPath(new URL(".env", root)) });
const now = new Date();
const kst = new Date(now.getTime() + 9 * 3600000);
const slot = [2, 5, 8, 11, 14, 17, 20, 23]
  .filter((h) => h < kst.getUTCHours() || (h === kst.getUTCHours() && kst.getUTCMinutes() >= 15))
  .at(-1);
const base = new Date(kst);
if (slot === undefined) base.setUTCDate(base.getUTCDate() - 1);
const date = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");
const common = { MobileOS: "ETC", MobileApp: "eumgil", _type: "json", numOfRows: 5, pageNo: 1 };
const array = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const checks = [
  {
    name: "국문 관광정보",
    env: "DATA_GO_KR_SERVICE_KEY",
    endpoint: "B551011/KorService2/areaBasedList2",
    params: { ...common, lDongRegnCd: 51 },
    inspect: (body) => {
      const items = array(body.items?.item);
      if (!items.length || items.some((it) => !it.contentid || !it.title))
        throw new Error("관광지 ID·제목 누락 또는 빈 목록");
      return {
        totalCount: body.totalCount,
        sampleCount: items.length,
        withImage: items.filter((it) => it.firstimage).length,
      };
    },
  },
  {
    name: "관광 상세 보강",
    env: "DATA_GO_KR_SERVICE_KEY",
    endpoint: "B551011/KorService2/detailCommon2",
    params: { ...common, contentId: "2022311", numOfRows: 1 },
    inspect: (body) => {
      const item = array(body.items?.item)[0];
      if (!item?.contentid || !item.overview) throw new Error("관광 상세·개요 누락");
      return { contentId: item.contentid, hasOverview: true, hasImage: Boolean(item.firstimage) };
    },
  },
  {
    name: "기상청 단기예보",
    env: "DATA_GO_KR_SERVICE_KEY",
    endpoint: "1360000/VilageFcstInfoService_2.0/getVilageFcst",
    params: {
      dataType: "JSON",
      base_date: date(base),
      base_time: `${String(slot ?? 23).padStart(2, "0")}00`,
      nx: 92,
      ny: 132,
      numOfRows: 300,
      pageNo: 1,
    },
    inspect: (body) => {
      const items = array(body.items?.item);
      const current = kst.toISOString().slice(0, 13).replace(/[-T:]/g, "") + "00";
      const stamp = (it) => `${it.fcstDate}${it.fcstTime}`;
      const target = [...new Set(items.map(stamp))].sort().find((t) => t >= current);
      const slice = items.filter((it) => stamp(it) === target);
      const values = Object.fromEntries(slice.map((it) => [it.category, it.fcstValue]));
      if (
        !target ||
        ["TMP", "POP", "WSD", "PTY", "SKY"].some(
          (key) =>
            values[key] === undefined ||
            values[key] === "" ||
            !Number.isFinite(Number(values[key])),
        )
      )
        throw new Error("현재 시각 예보·필수 수치 누락");
      return {
        forecastAt: target,
        temperature: Number(values.TMP),
        rainProbability: Number(values.POP),
        itemCount: items.length,
      };
    },
  },
  {
    name: "에어코리아",
    env: "DATA_GO_KR_SERVICE_KEY",
    endpoint: "B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty",
    params: { returnType: "json", sidoName: "강원", numOfRows: 200, pageNo: 1, ver: "1.3" },
    inspect: (body) => {
      const items = array(body.items);
      const valid = items.filter((it) => /^[1-4]$/.test(it.khaiGrade));
      if (!valid.length) throw new Error("유효한 대기질 측정값 없음");
      return {
        stations: items.length,
        validStations: valid.length,
        observedAt: valid[0].dataTime,
        mapping: ["옥천동", "중앙동", "평창읍"].map((name) => ({
          name,
          found: items.some((it) => it.stationName?.replace(/\(.*?\)/g, "").trim() === name),
        })),
      };
    },
  },
  {
    name: "관광지 일별 집중률 예측",
    env: "DATA_GO_KR_SERVICE_KEY",
    endpoint: "B551011/TatsCnctrRateService/tatsCnctrRatedList",
    params: { ...common, areaCd: 51, signguCd: 51150, tAtsNm: "안목해변", numOfRows: 100 },
    inspect: (body) => {
      const rows = array(body.items?.item);
      if (!rows.length) throw new Error("집중률 예측 없음");
      return { place: rows[0].tAtsNm, days: rows.length, firstDate: rows[0].baseYmd };
    },
  },
  {
    name: "지역별 방문자수",
    env: "DATA_GO_KR_SERVICE_KEY",
    endpoint: "B551011/DataLabService/locgoRegnVisitrDDList",
    params: {
      ...common,
      startYmd: date(new Date(kst.getTime() - 35 * 86400000)),
      endYmd: date(new Date(kst.getTime() - 35 * 86400000)),
      numOfRows: 1000,
    },
    inspect: (body) => {
      const rows = array(body.items?.item).filter((x) => x.signguCode === "51150");
      return {
        rows: rows.length,
        date: rows[0]?.baseYmd,
        note: rows.length ? "공개 표본일 자료" : "정상 빈 응답: 공개 시차 확인 필요",
      };
    },
  },
  {
    name: "기상청 자외선지수",
    env: "DATA_GO_KR_SERVICE_KEY",
    endpoint: "1360000/LivingWthrIdxServiceV5/getUVIdxV5",
    params: {
      dataType: "JSON",
      areaNo: "5115000000",
      time:
        date(new Date(kst.getTime() - 1800000)) +
        String(Math.floor(new Date(kst.getTime() - 1800000).getUTCHours() / 3) * 3).padStart(
          2,
          "0",
        ),
      numOfRows: 10,
      pageNo: 1,
    },
    inspect: (body) => {
      const row = array(body.items?.item)[0];
      if (!row?.date) throw new Error("자외선 발표자료 없음");
      return { issuedAt: row.date, index: row.h0 };
    },
  },
];
async function probe(check) {
  const key = process.env[check.env];
  if (!key) return { name: check.name, status: "missing-key", env: check.env };
  const url = new URL(`https://apis.data.go.kr/${check.endpoint}`);
  url.searchParams.set("serviceKey", key);
  for (const [k, v] of Object.entries(check.params)) url.searchParams.set(k, String(v));
  const started = performance.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (text.trimStart().startsWith("<")) throw new Error("XML 오류 응답: 활용 승인·키 확인 필요");
    const data = JSON.parse(text);
    const code = data.response?.header?.resultCode;
    if (code === undefined || !/^0+$/.test(String(code)))
      throw new Error(`API resultCode=${String(code).slice(0, 12)}`);
    return {
      name: check.name,
      status: "ok",
      durationMs: Math.round(performance.now() - started),
      ...check.inspect(data.response.body ?? {}),
    };
  } catch (error) {
    return {
      name: check.name,
      status: "failed",
      durationMs: Math.round(performance.now() - started),
      error:
        error instanceof SyntaxError
          ? "JSON 파싱 오류"
          : (error.message ?? "요청 실패").replaceAll(key, "[redacted]"),
    };
  }
}
async function probeHighways() {
  const name = "한국도로공사 실시간 소통";
  const key = process.env.EX_ROAD_SERVICE_KEY;
  if (!key) return { name, status: "missing-key", env: "EX_ROAD_SERVICE_KEY" };
  const url = new URL("https://data.ex.co.kr/openapi/odtraffic/trafficAmountByRealtime");
  url.searchParams.set("key", key);
  url.searchParams.set("type", "json");
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.code !== "SUCCESS" || !Array.isArray(data.list)) throw new Error("응답 형식 오류");
    const rows = data.list.filter((x) => ["0500", "0600", "0650"].includes(x.routeNo));
    if (!rows.length) throw new Error("강원 연결 노선 자료 없음");
    return {
      name,
      status: "ok",
      rows: rows.length,
      observedAt: `${rows[0].stdDate}${rows[0].stdHour}`,
    };
  } catch {
    return { name, status: "failed", error: "도로공사 호출·응답 실패" };
  }
}
const results = await Promise.all([...checks.map(probe), probeHighways()]);
console.log(JSON.stringify({ checkedAt: now.toISOString(), results }, null, 2));
process.exitCode = results.some((r) => r.status === "failed")
  ? 1
  : results.some((r) => r.status === "missing-key")
    ? 2
    : 0;
