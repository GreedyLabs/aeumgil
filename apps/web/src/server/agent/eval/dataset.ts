// ─────────────────────────────────────────────
// 평가 데이터셋 + 샘플 컨텍스트 (오프라인).
//
// [학습 메모] 평가 케이스는 적지만 "서로 다른 의도 패턴"을 덮어야 한다(한산/유명/막연 등).
// 실서비스에선 현장 피드백·실패 로그에서 케이스를 계속 추가해 데이터셋을 키운다
// (공고: "현장 피드백 기반 AI 응답 평가 파이프라인").
// 샘플 컨텍스트는 네트워크 없이 도는 in-memory 포트 — 채점이 결정적으로 재현된다.
// ─────────────────────────────────────────────

import { L } from "@/lib/i18n";
import type { Course, Theme } from "@/domain/types";
import type { SpotMeta, ToolContext } from "../types";
import type { EvalCase } from "./types";

export const DATASET: EvalCase[] = [
  { id: "quiet-beach", intent: "부모님이랑 안 붐비는 바다 보고 싶어", expectQuietHandling: true },
  { id: "famous-beach", intent: "유명한 바다 명소 위주로", expectQuietHandling: false },
  { id: "quiet-mountain", intent: "조용한 산 트레킹 코스", expectQuietHandling: true },
  { id: "vague", intent: "강원도 여행 추천", expectQuietHandling: false },
];

// ── 샘플 컨텍스트 ────────────────────────────

function theme(id: string, mood: string[]): Theme {
  return {
    id,
    title: L(id),
    subtitle: L(""),
    tag: L(id),
    region: L("강원"),
    hue: 200,
    duration: L("2박3일"),
    pace: L("느긋"),
    spotCount: 2,
    mood: mood.map((m) => L(m)),
    blurb: L(""),
  };
}

const COURSES: Record<string, Course> = {
  beach: {
    themeId: "beach",
    title: L("해변 코스"),
    dayCount: 1,
    items: [
      { kind: "spot", day: 1, time: "10:00", refId: "s1" },
      { kind: "spot", day: 1, time: "14:00", refId: "s2" },
    ],
  },
  mountain: {
    themeId: "mountain",
    title: L("산 코스"),
    dayCount: 1,
    items: [
      { kind: "spot", day: 1, time: "09:00", refId: "s3" },
      { kind: "spot", day: 1, time: "13:00", refId: "s1" },
    ],
  },
};

const SPOTS: SpotMeta[] = [
  { id: "s1", baseline: "busy", env: "beach", lat: 38, lon: 128.5, region: "sokcho" },
  { id: "s2", baseline: "moderate", env: "beach", lat: 37.8, lon: 128.9, region: "gangneung" },
  { id: "s3", baseline: "moderate", env: "mountain", lat: 37.7, lon: 128.6, region: "pyeongchang" },
];

/** 네트워크 없이 도는 평가용 ToolContext. */
export function sampleEvalContext(): ToolContext {
  return {
    themes: [theme("beach", ["바다", "힐링"]), theme("mountain", ["산", "숲"])],
    spots: SPOTS,
    async getCourse(id) {
      return COURSES[id] ?? null;
    },
    async weather() {
      return { tempC: 22, pop: 10, windMs: 3, pty: 0, desc: L("맑음") };
    },
    async air() {
      return { khaiGrade: 1, grade: L("좋음") };
    },
    async searchPois() {
      return [];
    },
    now() {
      return new Date(2026, 5, 23, 11, 0); // 고정 시각(재현)
    },
  };
}
