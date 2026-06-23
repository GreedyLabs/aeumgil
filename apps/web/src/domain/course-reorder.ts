// ─────────────────────────────────────────────
// 혼잡 기반 코스 재정렬 (Phase 3) — 순수 함수.
//
// 하루의 관광지(스팟)들을, 각자의 시간대별 혼잡 곡선(estimateCongestion().hourly)을 보고
// 같은 날의 방문 시간 슬롯에 재배정한다. 목표: "그 시각에 가장 한산하도록" 장소를 분산.
//   - 슬롯(방문 시각)의 집합은 그대로 두고, 어느 슬롯에 어느 스팟을 둘지만 바꾼다.
//   - 식사/숙박 항목은 손대지 않는다(별도 고정 시각).
//   - 총 혼잡 지수 합을 최소화하는 배정을 찾는다(동률이면 원래 순서 유지).
//
// 하루 스팟 수가 작으므로(보통 2~4) 완전탐색, 많으면 그리디로 폴백.
// ─────────────────────────────────────────────

import type { HourLoad } from "./congestion";

export interface ScheduledSpot {
  refId: string;
  /** 방문 시각 "HH:MM" */
  time: string;
  /** 이 스팟의 시간대별 혼잡 지수(estimateCongestion().hourly) */
  hourly: HourLoad[];
}

export interface ReorderResult {
  /** 슬롯(time) 은 입력 순서 유지, 각 슬롯에 배정된 refId 가 재배치된 결과 */
  order: { time: string; refId: string }[];
  /** 배치가 바뀌었는지 */
  changed: boolean;
  /** 재배치로 줄인 총 혼잡 지수 합 (원래 - 최적) */
  saved: number;
  /** 위치가 바뀐 refId 들 */
  movedRefIds: string[];
}

const BRUTE_LIMIT = 7; // n! 완전탐색 상한(7!=5040)

function hourOf(time: string): number {
  const h = Number(time.split(":")[0]);
  return Number.isFinite(h) ? h : 12;
}

/** 곡선에서 해당 시각의 혼잡 지수(가장 가까운 시각으로 클램프). */
function loadAt(hourly: HourLoad[], hour: number): number {
  if (hourly.length === 0) return 0;
  let best = hourly[0]!;
  let bestDist = Math.abs(best.hour - hour);
  for (const h of hourly) {
    const d = Math.abs(h.hour - hour);
    if (d < bestDist) {
      best = h;
      bestDist = d;
    }
  }
  return best.index;
}

function* permutations(arr: number[]): Generator<number[]> {
  if (arr.length <= 1) {
    yield arr.slice();
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) yield [arr[i]!, ...p];
  }
}

/** 그리디 폴백: 슬롯 순서대로 남은 스팟 중 그 슬롯에서 가장 한산한 것을 배정. */
function greedyAssign(cost: number[][], n: number): number[] {
  const used = new Array<boolean>(n).fill(false);
  const perm: number[] = [];
  for (let slot = 0; slot < n; slot++) {
    let pick = -1;
    let pickCost = Infinity;
    for (let s = 0; s < n; s++) {
      if (used[s]) continue;
      if (cost[s]![slot]! < pickCost) {
        pickCost = cost[s]![slot]!;
        pick = s;
      }
    }
    used[pick] = true;
    perm.push(pick);
  }
  return perm;
}

/**
 * 하루 스팟들을 혼잡 최소가 되도록 시간 슬롯에 재배정.
 * perm[slotIdx] = 해당 슬롯에 배정할 입력 스팟 인덱스.
 */
export function reorderSpotsByCongestion(spots: ScheduledSpot[]): ReorderResult {
  const slots = spots.map((s) => s.time);
  const baseRefIds = spots.map((s) => s.refId);
  const n = spots.length;

  if (n <= 1) {
    return { order: slots.map((t, i) => ({ time: t, refId: baseRefIds[i]! })), changed: false, saved: 0, movedRefIds: [] };
  }

  const slotHours = slots.map(hourOf);
  // cost[spotIdx][slotIdx] = 스팟을 그 슬롯 시각에 두었을 때 혼잡 지수
  const cost = spots.map((sp) => slotHours.map((h) => loadAt(sp.hourly, h)));

  const identity = spots.map((_, i) => i);
  const costOf = (perm: number[]): number => perm.reduce((sum, spotIdx, slotIdx) => sum + cost[spotIdx]![slotIdx]!, 0);
  const baseCost = costOf(identity);

  let bestPerm = identity;
  let bestCost = baseCost;
  if (n <= BRUTE_LIMIT) {
    for (const perm of permutations(identity)) {
      const c = costOf(perm);
      if (c < bestCost - 1e-9) {
        bestCost = c;
        bestPerm = perm;
      }
    }
  } else {
    const g = greedyAssign(cost, n);
    const gc = costOf(g);
    if (gc < bestCost - 1e-9) {
      bestCost = gc;
      bestPerm = g;
    }
  }

  const order = slots.map((t, slotIdx) => ({ time: t, refId: spots[bestPerm[slotIdx]!]!.refId }));
  const movedRefIds = order.filter((o, i) => o.refId !== baseRefIds[i]).map((o) => o.refId);
  return { order, changed: movedRefIds.length > 0, saved: Math.round(baseCost - bestCost), movedRefIds };
}
