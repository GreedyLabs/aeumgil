// ─────────────────────────────────────────────
// "지금" 혼잡 산출 (서버 전용) — 외부 API 없이 Phase 3 혼잡 모델만 사용.
//
// 목록성 화면(지도·saved)은 §2.3 결정대로 enrich:false 로 조회하므로 날씨 입력이
// 없다. 여기서는 estimateCongestion 을 시각·요일·계절 계수만으로 돌려(pop/pty 생략)
// 정적 큐레이션 prior 를 동적 등급으로 변환한다. 날씨까지 반영한 spot 상세의 등급과는
// 강수 시 한 단계 어긋날 수 있다(트레이드오프 — 운영-준비-플랜 §4.2 메모).
// ─────────────────────────────────────────────

import { estimateCongestion } from "@/domain/congestion";
import type { Congestion, Spot } from "@/domain/types";
import { getSpotMapping } from "./spot-mapping";

/** 서버 TZ 무관하게 KST 벽시계를 로컬 필드로 갖는 Date. */
export function nowKst(): Date {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), k.getUTCHours(), k.getUTCMinutes());
}

/** 스팟의 현재(KST) 혼잡 등급 — 매핑이 없으면 큐레이션 baseline 그대로. */
export function congestionNow(spot: Spot, at: Date = nowKst()): Congestion {
  const m = getSpotMapping(spot.id);
  if (!m) return spot.congestion;
  return estimateCongestion({ baseline: spot.congestion, kind: m.env, at }).level;
}
