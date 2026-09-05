// ─────────────────────────────────────────────
// 기상청 단기예보(동네예보) 클라이언트 — 서버 전용.
// 포털: https://www.data.go.kr/data/15084084/openapi.do
// base: https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0
//
// getVilageFcst 로 격자(nx/ny) 단기예보를 받아 도메인 Weather 로 정규화한다.
// 단기예보는 매일 02/05/08/11/14/17/20/23시(KST)에 발표 → 가장 가까운 과거
// 발표시각(base_time)을 골라 호출한다.
// ─────────────────────────────────────────────

import { requireEnv } from "@/lib/env";
import { L, type LocalizedText } from "@/lib/i18n";
import type { Weather } from "@/domain/types";
import { latLonToGrid } from "./grid";
import { callDataGoKr } from "./http";

const BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
const COMMON = { dataType: "JSON", MobileOS: "ETC", MobileApp: "eumgil" } as const;

/** 정규화된 날씨 + 적합성 산출에 쓰는 원시 수치 */
export interface WeatherNow extends Weather {
  /** 강수확률(%) */
  pop: number;
  /** 풍속(m/s) */
  windMs: number;
  /** 강수형태 코드 0없음 1비 2비/눈 3눈 4소나기 */
  pty: number;
  /** 하늘상태 1맑음 3구름많음 4흐림 */
  sky: number;
  /** 예보 대상 시각(KST, ISO 8601) */
  forecastAt: string;
}

interface RawFcstResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: { item?: RawFcstItem[] | RawFcstItem } | "";
    };
  };
}

interface RawFcstItem {
  category?: string; // TMP, POP, PTY, SKY, WSD ...
  fcstDate?: string;
  fcstTime?: string;
  fcstValue?: string;
}

/** KST 기준 가장 가까운 과거 발표시각(base_date, base_time) 산출 */
export function latestBase(now = new Date()): { baseDate: string; baseTime: string } {
  // KST = UTC+9
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const slots = [2, 5, 8, 11, 14, 17, 20, 23];
  const h = kst.getUTCHours();
  // 발표 후 약 10분 뒤 제공 → 안전하게 직전 슬롯 사용
  let slot = slots.filter((s) => h > s || (h === s && kst.getUTCMinutes() >= 15)).pop();
  if (slot === undefined) {
    // 02시 이전이면 전날 23시
    kst.setUTCDate(kst.getUTCDate() - 1);
    slot = 23;
  }
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return { baseDate: `${y}${m}${d}`, baseTime: `${String(slot).padStart(2, "0")}00` };
}

function extractItems(data: RawFcstResponse): RawFcstItem[] {
  const items = data.response?.body?.items;
  if (!items) return [];
  return Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
}

/** SKY/PTY 코드 → 아이콘 키 + 설명 */
function describe(sky: number, pty: number): { icon: string; desc: LocalizedText } {
  if (pty === 1 || pty === 4) return { icon: "rain", desc: L("비", "Rain") };
  if (pty === 2) return { icon: "rain", desc: L("비/눈", "Rain/Snow") };
  if (pty === 3) return { icon: "snow", desc: L("눈", "Snow") };
  if (sky === 1) return { icon: "sun", desc: L("맑음", "Clear") };
  if (sky === 3) return { icon: "cloud", desc: L("구름많음", "Mostly Cloudy") };
  if (sky === 4) return { icon: "cloud", desc: L("흐림", "Cloudy") };
  return { icon: "sun", desc: L("대체로 맑음", "Mostly Clear") };
}

/**
 * 격자(nx/ny) 기준 현재 시점에 가장 근접한 단기예보 1건을 도메인 Weather 로 반환.
 * 현재 시간대 또는 그 이후 첫 예보시각(fcstDate+fcstTime)의 항목들을 정규화한다.
 */
export async function getVilageWeather(nx: number, ny: number, now = new Date()): Promise<WeatherNow> {
  const { baseDate, baseTime } = latestBase(now);
  const data = await callDataGoKr<RawFcstResponse>(
    `${BASE}/getVilageFcst`,
    { ...COMMON, numOfRows: 300, pageNo: 1, base_date: baseDate, base_time: baseTime, nx, ny },
    { serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY") },
  );

  const items = extractItems(data);
  if (items.length === 0) throw new Error("단기예보 응답이 비어있습니다.");

  // 발표 직후 첫 시각을 계속 보여주지 않고, 현재 KST 시각의 예보를 선택한다.
  const stamp = (it: RawFcstItem) => `${it.fcstDate ?? ""}${it.fcstTime ?? ""}`;
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const current = kst.toISOString().slice(0, 13).replace(/[-T:]/g, "") + "00";
  const times = [...new Set(items.map(stamp))].filter((t) => /^\d{12}$/.test(t)).sort();
  const target = times.find((t) => t >= current);
  if (!target) throw new Error("현재 시각 이후의 단기예보가 없습니다.");
  const slice = items.filter((it) => stamp(it) === target);
  const pick = (cat: string): number => {
    const raw = slice.find((it) => it.category === cat)?.fcstValue;
    if (raw === undefined || String(raw).trim() === "" || !Number.isFinite(Number(raw))) {
      throw new Error(`단기예보 ${cat} 값이 없습니다.`);
    }
    return Number(raw);
  };
  const tempC = pick("TMP");
  const pop = pick("POP");
  const windMs = pick("WSD");
  const pty = pick("PTY");
  const sky = pick("SKY");
  if (pop < 0 || pop > 100 || windMs < 0 || ![0, 1, 2, 3, 4].includes(pty) || ![1, 3, 4].includes(sky)) {
    throw new Error("단기예보 값이 유효 범위를 벗어났습니다.");
  }
  const forecastAt = `${target.slice(0, 4)}-${target.slice(4, 6)}-${target.slice(6, 8)}T${target.slice(8, 10)}:${target.slice(10, 12)}:00+09:00`;

  const { icon, desc } = describe(sky, pty);
  return { tempC, desc, icon, pop, windMs, pty, sky, forecastAt };
}

/** 위경도로 바로 날씨 조회 (격자 변환 포함) */
export async function getWeatherByCoords(lat: number, lon: number): Promise<WeatherNow> {
  const { nx, ny } = latLonToGrid(lat, lon);
  return getVilageWeather(nx, ny);
}

/**
 * 날씨 캐시 키 — KMA 5km 격자(nx,ny) 단위. 스팟별 키 대신 격자 키를 쓰면
 * 같은 격자에 속한 스팟들이 한 번의 실호출을 공유해 일일 쿼터 소모가
 * 스팟 수가 아니라 격자 수에 비례한다(§3.2). API 자체가 격자 입력이라 정밀도 손실 없음.
 */
export function weatherCacheKey(lat: number, lon: number): string {
  const { nx, ny } = latLonToGrid(lat, lon);
  return `wx:v2:g${nx},${ny}`;
}
