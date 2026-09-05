// ─────────────────────────────────────────────
// 방문 적합성 스코어 (Phase 3 스타터) — 순수 함수.
//
// 혼잡도 + 날씨(강수/바람) + 대기질을 0~100 점수로 결합하고 사유를 만든다.
// 테마/장소 성격별 민감도가 달라(해변=바람·자외선, 산악=강수·강풍) 가중치를 분리.
// 입력은 도메인/공공API 무관한 원시 수치라 단위 테스트가 쉽다.
// ─────────────────────────────────────────────

import { L, type LocalizedText } from "@/lib/i18n";
import type { Congestion } from "./types";

/** 장소 성격 — 날씨 민감도 가중치 선택 */
export type EnvKind = "beach" | "mountain" | "inland";

export interface ScoreInput {
  congestion: Congestion;
  /** 강수확률 % */
  pop: number;
  /** 풍속 m/s */
  windMs: number;
  /** 강수형태 코드 (0 없음) */
  pty: number;
  /** 통합대기 등급 1~4 (0 정보없음) */
  khaiGrade: number;
  kind: EnvKind;
  /** 현재 3시간 구간의 자외선 예측, 누락이면 감점에 사용하지 않는다. */
  uvIndex?: number;
}

export interface ScoreResult {
  /** 0~100 적합성 */
  suitability: number;
  /** 사유 (한국어/영문) */
  reason: LocalizedText;
}

const CONGESTION_PENALTY: Record<Congestion, number> = {
  calm: 0,
  moderate: 12,
  busy: 28,
};

// 장소별 (바람, 강수) 민감 계수
const WIND_WEIGHT: Record<EnvKind, number> = { beach: 1.6, mountain: 1.4, inland: 0.8 };
const RAIN_WEIGHT: Record<EnvKind, number> = { beach: 1.0, mountain: 1.6, inland: 1.1 };

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 적합성 점수 + 사유 산출. 100 에서 각 악조건만큼 감점.
 */
export function scoreSuitability(input: ScoreInput): ScoreResult {
  const { congestion, pop, windMs, pty, khaiGrade, kind } = input;
  let score = 100;
  const ko: string[] = [];
  const en: string[] = [];

  // 혼잡
  score -= CONGESTION_PENALTY[congestion];
  if (congestion === "busy") {
    ko.push("혼잡");
    en.push("crowded");
  }

  // 강수확률 (40% 초과부터 감점)
  if (pop > 40) {
    const pen = Math.round(((pop - 40) / 60) * 25 * RAIN_WEIGHT[kind]);
    score -= pen;
    ko.push(`강수확률 ${pop}%`);
    en.push(`${pop}% rain chance`);
  }
  // 실제 강수형태가 있으면 추가 감점
  if (pty > 0) {
    score -= Math.round(10 * RAIN_WEIGHT[kind]);
    ko.push("강수 중");
    en.push("precipitation");
  }

  // 강풍 (7m/s 초과부터)
  if (windMs > 7) {
    const pen = Math.round((windMs - 7) * 4 * WIND_WEIGHT[kind]);
    score -= pen;
    ko.push(`강풍 ${windMs}m/s`);
    en.push(`${windMs}m/s wind`);
  }

  // 대기질 (나쁨 이상 감점)
  if (khaiGrade >= 3) {
    score -= khaiGrade === 4 ? 25 : 14;
    ko.push(khaiGrade === 4 ? "대기 매우나쁨" : "대기 나쁨");
    en.push(khaiGrade === 4 ? "very unhealthy air" : "unhealthy air");
  }

  if (input.uvIndex !== undefined && input.uvIndex >= 6) {
    // 야외 노출이 큰 해변/산악은 더 민감하게 반영한다(서비스 자체 가중치).
    score -=
      (input.uvIndex >= 11 ? 15 : input.uvIndex >= 8 ? 10 : 5) * (kind === "inland" ? 0.5 : 1);
    ko.push(`자외선지수 ${input.uvIndex}`);
    en.push(`UV index ${input.uvIndex}`);
  }
  const suitability = clamp(Math.round(score));
  const reason =
    ko.length === 0
      ? L("쾌적 — 방문하기 좋은 조건", "Pleasant — good conditions to visit")
      : L(`${ko.join(" · ")} 영향`, `Affected by ${en.join(", ")}`);

  return { suitability, reason };
}
