// ─────────────────────────────────────────────
// 에어코리아 대기오염정보 클라이언트 — 서버 전용.
// 포털: https://www.data.go.kr/data/15073861/openapi.do
// base: https://apis.data.go.kr/B552584/ArpltnInforInqireSvc
//
// 시도별 실시간 측정정보(getCtprvnRltmMesureDnsty, sidoName=강원)를 받아
// 측정소별 통합대기환경지수(khaiGrade)/미세먼지 등급을 정규화한다.
// 측정소명으로 권역 매칭, 없으면 시도 평균 등급으로 폴백.
// ─────────────────────────────────────────────

import { requireEnv } from "@/lib/env";
import { L, type LocalizedText } from "@/lib/i18n";
import { callDataGoKr } from "./http";
import { apiCache } from "../cache";

const BASE = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc";

/** 정규화된 대기질 */
export interface AirQuality {
  /** 등급 라벨 (좋음/보통/나쁨/매우나쁨) */
  grade: LocalizedText;
  /** 통합대기환경지수 등급 1좋음 2보통 3나쁨 4매우나쁨 (없으면 0) */
  khaiGrade: number;
  /** 미세먼지(PM10) ㎍/㎥ */
  pm10?: number;
  /** 초미세먼지(PM2.5) ㎍/㎥ */
  pm25?: number;
  /** 측정소명 */
  station?: string;
  observedAt?: string;
  scope?: "station" | "province";
}

interface RawAirResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: RawAirItem[] | RawAirItem };
  };
}

interface RawAirItem {
  stationName?: string;
  khaiGrade?: string;
  pm10Grade?: string;
  pm10Value?: string;
  pm25Value?: string;
  dataTime?: string;
}

const GRADE_LABEL: Record<number, LocalizedText> = {
  1: L("좋음", "Good"),
  2: L("보통", "Moderate"),
  3: L("나쁨", "Unhealthy"),
  4: L("매우나쁨", "Very Unhealthy"),
};

function gradeLabel(g: number): LocalizedText {
  return GRADE_LABEL[g] ?? L("정보없음", "N/A");
}

function num(v: string | undefined): number | undefined {
  if (v === undefined || v === "" || v === "-") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toQuality(item: RawAirItem): AirQuality {
  const validGrade = (v: string | undefined) => { const n = num(v); return n && [1, 2, 3, 4].includes(n) ? n : undefined; };
  const khaiGrade = validGrade(item.khaiGrade) ?? validGrade(item.pm10Grade) ?? 0;
  return {
    grade: gradeLabel(khaiGrade),
    khaiGrade,
    pm10: num(item.pm10Value),
    pm25: num(item.pm25Value),
    station: item.stationName,
    observedAt: item.dataTime,
    scope: "station",
  };
}

/** 강원 시도 전체 측정소 실시간 대기질 목록 */
export async function listGangwonAir(): Promise<AirQuality[]> {
  const data = await callDataGoKr<RawAirResponse>(
    `${BASE}/getCtprvnRltmMesureDnsty`,
    {
      returnType: "json",
      numOfRows: 200,
      pageNo: 1,
      sidoName: "강원",
      ver: "1.3",
    },
    { serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY") },
  );
  const items = data.response?.body?.items;
  const arr = Array.isArray(items) ? items : items ? [items] : [];
  if (arr.length === 0) throw new Error("대기질 응답이 비어있습니다.");
  return arr.map(toQuality);
}

/** 측정소명 정규화: 괄호 접미사·공백 제거 ("중앙동(강원)" → "중앙동"). */
function normStation(name: string | undefined): string {
  return (name ?? "").replace(/\(.*?\)/g, "").trim();
}

/**
 * 특정 측정소명 대기질. 측정소 미일치(또는 빈 힌트)면 강원 시도 평균 등급으로 폴백.
 * 응답 측정소명에 "(강원)" 등 접미사가 붙으므로 정규화 후 비교한다.
 */
export async function getAirForStation(stationName: string): Promise<AirQuality> {
  // 원천 API는 항상 강원 전체를 반환하므로 모든 권역이 한 번의 요청을 공유한다.
  const all = await apiCache.cached("air:gangwon:v2", 30 * 60 * 1000, listGangwonAir);
  const target = normStation(stationName);
  const hit = target
    ? all.find((a) => normStation(a.station) === target && a.khaiGrade > 0)
    : undefined;
  if (hit) return hit;

  // 폴백: 유효 등급의 평균(반올림)
  const valid = all.filter((a) => a.khaiGrade > 0).map((a) => a.khaiGrade);
  if (valid.length === 0) return { grade: gradeLabel(0), khaiGrade: 0 };
  const avg = Math.round(valid.reduce((s, g) => s + g, 0) / valid.length);
  return { grade: gradeLabel(avg), khaiGrade: avg, station: undefined, scope: "province" };
}
