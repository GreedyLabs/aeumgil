// ─────────────────────────────────────────────
// 동적 혼잡 산출 (Phase 3) — 순수 함수.
//
// 방문자수/집중률 공공 API(2·3번)가 아직 미연동이라, 큐레이션 인기도(prior)를
// 시간대·요일·계절·날씨로 변조해 "지금 이 스팟이 얼마나 붐비는가"를 추정한다.
// 동시에 하루 혼잡 곡선을 산출해 "가장 한산한 방문 시간대"(혼잡 분산)를 제안한다.
//
// 산출식(곱셈 모델):
//   demand = prior × f_hour × f_dow × f_season × f_weather
//   index  = round( demand / RAW_MAX × 100 )   // 0~100 로 정규화
// 각 계수는 1.0 을 중립으로 두고 1보다 크면 혼잡 가중, 작으면 완화.
// 입력이 도메인/공공API 무관한 원시값이라 단위 테스트가 쉽다.
// ─────────────────────────────────────────────

import { L, type LocalizedText } from "@/lib/i18n";
import type { EnvKind } from "./scoring";
import type { Congestion } from "./types";

export interface CongestionInput {
  /** 큐레이션 인기 tier — 정적 prior(이 스팟의 기본 수요) */
  baseline: Congestion;
  /** 장소 성격 — 시간대 곡선·날씨 민감도 선택 */
  kind: EnvKind;
  /** 평가 시각 (KST 기준 Date) */
  at: Date;
  /** 강수확률 % (없으면 0) */
  pop?: number;
  /** 강수형태 코드 (0 없음) */
  pty?: number;
}

export interface HourLoad {
  hour: number;
  index: number;
}

export interface CongestionEstimate {
  /** 동적 혼잡 등급 */
  level: Congestion;
  /** 0~100 연속 혼잡 지수 */
  index: number;
  /** 개장시간(8~20시) 시간대별 혼잡 지수 — 분산 추천 근거 */
  hourly: HourLoad[];
  /** 가장 한산한 추천 방문 시각(시작 hour, 최대 2개, 시간순) */
  bestHours: number[];
  /** 혼잡 분산 안내 문구 */
  tip: LocalizedText;
  /** 혼잡 가중 사유 */
  reason: LocalizedText;
}

// ── 계수 테이블 ──────────────────────────────

/** 큐레이션 인기 tier → 기본 수요(중립 시각 기준). busy 스팟은 비수기에도 어느 정도 붐빔. */
const BASE_PRIOR: Record<Congestion, number> = { calm: 0.35, moderate: 0.55, busy: 0.78 };

/** 장소별 일중 피크 시각·폭(가우시안). 해변=오후, 산악=오전, 도심/시장=점심 전후. */
const PEAK: Record<EnvKind, { peak: number; width: number }> = {
  beach: { peak: 15, width: 4.5 },
  mountain: { peak: 11, width: 3.5 },
  inland: { peak: 13, width: 4.0 },
};

/** 요일 계수 — getDay(): 0=일 … 6=토. 주말·금요일 가중. */
const DOW_FACTOR: readonly number[] = [1.2, 0.85, 0.85, 0.85, 0.9, 1.05, 1.35];

/** 개장시간 범위(분산 곡선 산출 구간) */
const OPEN_FROM = 8;
const OPEN_TO = 20;

/**
 * 정규화 상수 — 이론상 최대 수요(busy·피크·토·성수기·맑음).
 * 0.78 × 1.35(피크) × 1.35(토) × 1.4(최대 성수기) ≈ 1.99 → index 100 에 대응.
 */
const RAW_MAX = 0.78 * 1.35 * 1.35 * 1.4;

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 일중 시간대 계수 0.15~1.35 (피크에서 1.35, 야간 바닥 0.15). */
function hourFactor(hour: number, kind: EnvKind): number {
  const { peak, width } = PEAK[kind];
  const g = Math.exp(-((hour - peak) ** 2) / (2 * width ** 2));
  return 0.15 + 1.2 * g;
}

/** 월별 계절 계수 — 장소 성격별 성수기 반영. */
function seasonFactor(month: number, kind: EnvKind): number {
  if (kind === "beach") {
    if (month === 7 || month === 8) return 1.4; // 한여름 피서
    if (month === 6 || month === 9) return 1.1; // 초여름·초가을
    if (month >= 11 || month <= 2) return 0.7; // 겨울 비수기
    return 0.9;
  }
  if (kind === "mountain") {
    if (month === 10) return 1.4; // 단풍 절정
    if (month === 9 || month === 11) return 1.15;
    if (month === 4 || month === 5) return 1.15; // 봄꽃·신록
    if (month === 1 || month === 2) return 0.85; // 한겨울
    return 1.0;
  }
  // inland(시장/도심) — 비교적 평탄. 주말·연휴 효과는 요일 계수가 흡수.
  if (month === 7 || month === 8 || month === 10) return 1.1;
  return 0.95;
}

/** 날씨 계수 — 강수는 야외(해변·산악) 수요를 크게 낮추고 실내(시장)는 덜 낮춘다. */
function weatherFactor(pop: number, pty: number, kind: EnvKind): number {
  const outdoor = kind !== "inland";
  if (pty > 0) return outdoor ? 0.5 : 0.8; // 실제 강수
  if (pop > 60) return outdoor ? 0.7 : 0.9;
  if (pop > 40) return outdoor ? 0.85 : 0.95;
  return 1.0;
}

function toLevel(index: number): Congestion {
  if (index < 34) return "calm";
  if (index < 67) return "moderate";
  return "busy";
}

const fmtHours = (hours: number[]): string =>
  hours.length === 2 && hours[1] === hours[0]! + 1
    ? `${hours[0]}–${hours[1]}시`
    : hours.map((h) => `${h}시`).join("·");

/**
 * 동적 혼잡 추정 + 하루 분산 곡선 + 추천 방문 시간대.
 */
export function estimateCongestion(input: CongestionInput): CongestionEstimate {
  const { baseline, kind, at } = input;
  const pop = input.pop ?? 0;
  const pty = input.pty ?? 0;

  const month = at.getMonth() + 1;
  const dow = at.getDay();
  const hourNow = at.getHours();

  // 시간 외(요일·계절·날씨) 공통 계수 — 곡선 산출 시 고정
  const fDow = DOW_FACTOR[dow] ?? 1;
  const fSeason = seasonFactor(month, kind);
  const fWeather = weatherFactor(pop, pty, kind);
  const ctx = BASE_PRIOR[baseline] * fDow * fSeason * fWeather;

  const idxAt = (hour: number): number => clamp(Math.round((ctx * hourFactor(hour, kind)) / RAW_MAX * 100));

  // 현재 지수·등급
  const index = idxAt(hourNow);
  const level = toLevel(index);

  // 하루 분산 곡선(개장시간)
  const hourly: HourLoad[] = [];
  for (let h = OPEN_FROM; h <= OPEN_TO; h++) hourly.push({ hour: h, index: idxAt(h) });

  // 가장 한산한 시간대 2개(시간순). 동률은 이른 시각 우선.
  const bestHours = [...hourly]
    .sort((a, b) => a.index - b.index || a.hour - b.hour)
    .slice(0, 2)
    .map((h) => h.hour)
    .sort((a, b) => a - b);

  // 분산 안내 — 지금이 붐비면 한산 시간대 제안, 아니면 현 상태 안내
  const bestTxt = fmtHours(bestHours);
  const tip =
    level === "busy"
      ? L(`지금 붐빔 — ${bestTxt}에 방문하면 비교적 한산`, `Busy now — visiting around ${bestTxt} is quieter`)
      : level === "moderate"
        ? L(`보통 — ${bestTxt}에 가장 한산`, `Moderate — ${bestTxt} is the quietest`)
        : L("지금도 한산 — 방문하기 좋은 때", "Quiet now — a good time to visit");

  // 혼잡 가중 사유
  const drivers: { ko: string; en: string }[] = [];
  if (fDow >= 1.2) drivers.push({ ko: "주말", en: "weekend" });
  if (fSeason >= 1.15) drivers.push({ ko: "성수기", en: "peak season" });
  if (hourFactor(hourNow, kind) >= 1.1) drivers.push({ ko: "피크 시간대", en: "peak hours" });
  const lull = fWeather < 0.8 ? { ko: "강수로 한산", en: "quiet due to rain" } : null;

  const reason =
    drivers.length > 0
      ? L(`${drivers.map((d) => d.ko).join("·")} 혼잡 가중`, `Busier: ${drivers.map((d) => d.en).join(", ")}`)
      : lull
        ? L(lull.ko, lull.en)
        : L("평상 수준", "Typical level");

  return { level, index, hourly, bestHours, tip, reason };
}
