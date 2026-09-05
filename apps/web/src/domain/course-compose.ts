// ─────────────────────────────────────────────
// 시드/DB 후보 기반 코스 생성 MVP.
//
// [학습 메모] LLM 없이도 코스 생성의 핵심은 결정형 엔진으로 먼저 세울 수 있다.
// 이 함수는 "테마/POI/식당/숙소 후보 풀"을 받아 코스를 조합한다. 지금은 mock 시드가
// 후보 풀이지만, 나중에 DB 테이블에서 읽어온 데이터로 바뀌어도 함수 계약은 유지된다.
//
// MVP 범위:
//   - 기존 큐레이션 코스는 시간 슬롯 템플릿으로 사용한다.
//   - 혼잡한 스팟은 같은 테마/권역 대체 후보 중 점수가 높은 곳으로 교체한다.
//   - 식당/숙소는 같은 날 스팟 권역에 맞춰 다시 고른다.
//   - baseCourse 가 없으면 후보 스팟 상위 N개로 간단한 당일/1박 코스를 생성한다.
// ─────────────────────────────────────────────

import type { Course, CourseItem, Eat, Spot, Stay, Theme } from "./types";
import { L, localized } from "@/lib/i18n";
import {
  approxTravelTimeLookup,
  estimateDrive,
  routePenaltyPoints,
  type RouteContext,
  type TravelMode,
  type TravelTimeLookup,
} from "./travel-time";

export interface ComposeCourseInput {
  theme: Theme;
  baseCourse?: Course | null;
  spots: Spot[];
  eats: Eat[];
  stays: Stay[];
  /** 원본 spotId → 같은 테마/인근 대체 후보 */
  alternativesBySpot?: Record<string, Spot[]>;
  /** baseCourse 가 없을 때 생성할 일수. 기본은 테마 duration 에서 추정. */
  dayCount?: number;
}

export interface ComposeCourseOptions {
  /** 혼잡 회피 우선. 기본 true. */
  avoidBusy?: boolean;
  /** 원하는 여행 일수. base 템플릿이 없을 때 우선 적용. */
  days?: number;
  /** 여행 페이스. calm=적게/여유롭게, active=더 많이 배치. */
  pace?: string;
  /** 동행 유형. family 는 체험/실내/안전 후보를 약간 우선한다. */
  companion?: string;
  /** 시작 권역. 후보 점수에서 해당 권역을 우선한다. */
  startRegion?: string;
  /** 이동수단. car=자가용/렌터카, transit=대중교통, walk=도보 중심. */
  transport?: TravelMode;
  /** 서버 길찾기 API 또는 근사 계산으로 구성한 이동시간 조회 포트. */
  travelTimeLookup?: TravelTimeLookup;
  /** 하루에 배치할 최대 스팟 수. 기본 3. */
  maxSpotsPerDay?: number;
}

interface NormalizedComposeOptions {
  avoidBusy: boolean;
  days?: number;
  pace?: string;
  companion?: string;
  startRegion?: string;
  transport: TravelMode;
  travelTimeLookup: TravelTimeLookup;
  maxSpotsPerDay: number;
}

const DEFAULT_TIMES = ["09:00", "11:00", "14:00", "16:30"];

function congestionScore(spot: Spot): number {
  if (spot.congestion === "calm") return 24;
  if (spot.congestion === "moderate") return 8;
  return -28;
}

function textBag(...parts: string[]): string {
  return parts.join(" ").toLowerCase();
}

function themeText(theme: Theme): string {
  return textBag(
    localized(theme.title, "ko"),
    localized(theme.tag, "ko"),
    localized(theme.region, "ko"),
    ...theme.mood.map((m) => localized(m, "ko")),
  );
}

function spotText(spot: Spot): string {
  return textBag(
    localized(spot.name, "ko"),
    localized(spot.type, "ko"),
    localized(spot.region, "ko"),
    ...spot.tags.map((t) => localized(t, "ko")),
  );
}

function keywordOverlapScore(theme: Theme, spot: Spot): number {
  const src = themeText(theme);
  const target = spotText(spot);
  const tokens = src.split(/\s+|·|,|\//).map((t) => t.trim()).filter((t) => t.length >= 2);
  const unique = [...new Set(tokens)];
  return unique.reduce((sum, token) => sum + (target.includes(token) ? 14 : 0), 0);
}

function regionOfSpot(spotsById: Map<string, Spot>, id: string): string | undefined {
  const spot = spotsById.get(id);
  return spot ? localized(spot.region, "ko") : undefined;
}

function scoreSpot(
  theme: Theme,
  spot: Spot,
  original: Spot | undefined,
  options: NormalizedComposeOptions,
  routeContext: RouteContext = {},
): number {
  const sameRegion = original && localized(original.region, "ko") === localized(spot.region, "ko") ? 10 : 0;
  const originalBias = original?.id === spot.id ? 4 : 0;
  const crowd = options.avoidBusy ? congestionScore(spot) : 0;
  const distance = original ? distancePenalty(original, spot) : 0;
  const route = original ? routePenalty(original, spot, routeContext) : 0;
  return (
    spot.suitability +
    crowd +
    keywordOverlapScore(theme, spot) +
    sameRegion +
    originalBias +
    spot.rating +
    preferenceScore(spot, options) -
    distance -
    route
  );
}

function hasCoords(spot: Spot): spot is Spot & { lat: number; lon: number } {
  return typeof spot.lat === "number" && typeof spot.lon === "number";
}

function distanceKm(a: Spot, b: Spot): number | null {
  if (!hasCoords(a) || !hasCoords(b)) return null;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * 대체지는 "좋지만 너무 먼 곳"보다 "조금 덜 좋아도 같은 동선 안의 곳"이 낫다.
 * 실제 길찾기 API 전 단계에서는 직선거리로 1차 근사한다.
 */
function distancePenalty(original: Spot, candidate: Spot): number {
  if (original.id === candidate.id) return 0;
  const km = distanceKm(original, candidate);
  if (km === null) return 0;
  if (km <= 8) return 0;
  return Math.min(34, (km - 8) * 0.9);
}

function toRouteCoord(spot: Spot | undefined) {
  if (!spot || !hasCoords(spot)) return undefined;
  return { lat: spot.lat, lon: spot.lon, region: localized(spot.region, "ko") };
}

function routePenalty(original: Spot, candidate: Spot, context: RouteContext): number {
  const originalCoord = toRouteCoord(original);
  const candidateCoord = toRouteCoord(candidate);
  if (!originalCoord || !candidateCoord) return 0;
  return routePenaltyPoints(originalCoord, candidateCoord, context);
}

function routeLegPenalty(
  prev: Spot | undefined,
  candidate: Spot,
  mode: TravelMode,
  lookup: TravelTimeLookup,
): number {
  const prevCoord = toRouteCoord(prev);
  const candidateCoord = toRouteCoord(candidate);
  if (!prevCoord || !candidateCoord) return 0;
  const drive = estimateDrive(prevCoord, candidateCoord, mode, lookup);
  if (!drive || drive.driveMinutes <= 45) return 0;
  return Math.min(30, (drive.driveMinutes - 45) * 0.35);
}

function preferenceScore(spot: Spot, options: NormalizedComposeOptions): number {
  let score = 0;
  const region = localized(spot.region, "ko");
  const tags = spot.tags.map((tag) => localized(tag, "ko")).join(" ");
  const type = localized(spot.type, "ko");

  if (options.startRegion && region.includes(options.startRegion)) score += 18;

  if (options.companion === "family") {
    if (/가족|체험|실내|안전|목장|박물관/.test(`${tags} ${type}`)) score += 14;
    if (/트레킹|등산|체력/.test(`${tags} ${type}`)) score -= 8;
  }

  if (options.pace === "calm") {
    if (spot.congestion === "busy") score -= 12;
    if (/한적|숲|산책|명상/.test(`${tags} ${type}`)) score += 8;
  } else if (options.pace === "active") {
    if (/트레킹|전망|시장|체험/.test(`${tags} ${type}`)) score += 8;
  }

  return score;
}

function uniqueById(spots: Spot[]): Spot[] {
  const seen = new Set<string>();
  const out: Spot[] = [];
  for (const s of spots) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

function pickSpotForSlot(
  theme: Theme,
  original: Spot | undefined,
  alternatives: Spot[],
  used: Set<string>,
  options: NormalizedComposeOptions,
  routeContext: RouteContext = {},
): Spot | undefined {
  const candidates = uniqueById([...(original ? [original] : []), ...alternatives]).filter(
    (s) => !used.has(s.id),
  );
  if (candidates.length === 0) return undefined;
  return candidates.sort((a, b) => scoreSpot(theme, b, original, options, routeContext) - scoreSpot(theme, a, original, options, routeContext))[0];
}

function pickByRegion<T extends Eat | Stay>(items: T[], region: string | undefined, used: Set<string>): T | undefined {
  if (items.length === 0) return undefined;
  const available = items.filter((it) => !used.has(it.id));
  const pool = available.length > 0 ? available : items;
  return [...pool].sort((a, b) => {
    const aRegion = localized(a.region, "ko") === region ? 1 : 0;
    const bRegion = localized(b.region, "ko") === region ? 1 : 0;
    return bRegion - aRegion || b.rating - a.rating;
  })[0];
}

function inferDayCount(theme: Theme): number {
  const duration = localized(theme.duration, "ko");
  if (duration.includes("2일")) return 2;
  if (duration.includes("3일")) return 3;
  return 1;
}

function spotsPerDayForPace(pace: string | undefined): number {
  if (pace === "calm") return 2;
  if (pace === "active") return 4;
  return 3;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return Number.isFinite(h) ? (h as number) * 60 + (Number.isFinite(m) ? (m as number) : 0) : 720;
}

function sortItems(items: CourseItem[]): CourseItem[] {
  return [...items].sort((a, b) => a.day - b.day || minutesOf(a.time) - minutesOf(b.time));
}

function pickScratchSpots(input: ComposeCourseInput, dayCount: number, options: NormalizedComposeOptions): Spot[] {
  const maxSpots = dayCount * options.maxSpotsPerDay;
  const remaining = uniqueById(input.spots);
  const picked: Spot[] = [];

  for (let i = 0; i < maxSpots && remaining.length > 0; i++) {
    const slot = i % options.maxSpotsPerDay;
    const prev = slot === 0 ? undefined : picked[picked.length - 1];
    const bestIndex = remaining
      .map((spot, index) => ({
        index,
        score:
          scoreSpot(input.theme, spot, undefined, options) -
          routeLegPenalty(prev, spot, options.transport, options.travelTimeLookup),
      }))
      .sort((a, b) => b.score - a.score)[0]?.index;
    if (bestIndex === undefined) break;
    const [next] = remaining.splice(bestIndex, 1);
    if (next) picked.push(next);
  }

  return picked;
}

function note(changedSpotIds: string[], changedCommerce: boolean): Course["altNote"] {
  if (changedSpotIds.length === 0 && !changedCommerce) return undefined;
  const koParts: string[] = [];
  const enParts: string[] = [];
  if (changedSpotIds.length > 0) {
    koParts.push(`${changedSpotIds.length}개 장소를 여행 조건에 맞는 같은 테마 후보로 조정`);
    enParts.push(`swapped ${changedSpotIds.length} crowded stop(s) for same-theme alternatives`);
  }
  if (changedCommerce) {
    koParts.push("식사·숙박을 이동 권역에 맞춰 재배치");
    enParts.push("reselected meals/stays by route region");
  }
  return L(`${koParts.join(", ")}했어요.`, `Course composer ${enParts.join(" and ")}.`);
}

function composeFromTemplate(input: ComposeCourseInput, options: NormalizedComposeOptions): Course {
  const base = input.baseCourse as Course;
  const targetDayCount = options.days ?? base.dayCount;
  // 연장 일정은 템플릿에 없는 날짜를 만들지 않고 후보 풀에서 다시 배치한다.
  if (targetDayCount > base.dayCount) return composeFromScratch(input, { ...options, days: targetDayCount });
  const daySpotCounts = new Map<number, number>();
  const templateItems = sortItems(base.items).filter((it) => {
    if (it.day > targetDayCount) return false;
    if (it.kind === "stay" && it.day >= targetDayCount) return false;
    if (it.kind !== "spot") return true;
    const count = (daySpotCounts.get(it.day) ?? 0) + 1;
    daySpotCounts.set(it.day, count);
    return count <= options.maxSpotsPerDay;
  });
  const spotsById = new Map(input.spots.map((s) => [s.id, s]));
  const baseSpotItemsByDay = new Map<number, CourseItem[]>();
  for (const it of templateItems) {
    if (it.kind !== "spot") continue;
    baseSpotItemsByDay.set(it.day, [...(baseSpotItemsByDay.get(it.day) ?? []), it]);
  }
  const usedSpots = new Set<string>();
  const usedEats = new Set<string>();
  const usedStays = new Set<string>();
  const changedSpotIds: string[] = [];
  let changedCommerce = false;

  const spotRegionByDay = new Map<number, string>();
  const firstPass: CourseItem[] = templateItems.map((it) => {
    if (it.kind !== "spot") return { ...it };
    const original = spotsById.get(it.refId);
    const daySpotItems = baseSpotItemsByDay.get(it.day) ?? [];
    const slotIndex = daySpotItems.findIndex((slot) => slot.refId === it.refId && slot.time === it.time);
    const prev = toRouteCoord(spotsById.get(daySpotItems[slotIndex - 1]?.refId ?? ""));
    const next = toRouteCoord(spotsById.get(daySpotItems[slotIndex + 1]?.refId ?? ""));
    const picked = pickSpotForSlot(
      input.theme,
      original,
      input.alternativesBySpot?.[it.refId] ?? [],
      usedSpots,
      options,
      { prev, next, mode: options.transport, lookup: options.travelTimeLookup },
    );
    if (!picked) return { ...it, refId: "" };
    usedSpots.add(picked.id);
    if (!spotRegionByDay.has(it.day)) spotRegionByDay.set(it.day, localized(picked.region, "ko"));
    if (picked.id !== it.refId) changedSpotIds.push(it.refId);
    return { ...it, refId: picked.id };
  });

  const items = firstPass.map((it) => {
    if (it.kind === "eat") {
      const region = spotRegionByDay.get(it.day) ?? regionOfSpot(spotsById, firstPass.find((x) => x.day === it.day && x.kind === "spot")?.refId ?? "");
      const picked = pickByRegion(input.eats, region, usedEats);
      if (!picked) return it;
      usedEats.add(picked.id);
      if (picked.id !== it.refId) changedCommerce = true;
      return { ...it, refId: picked.id };
    }
    if (it.kind === "stay") {
      const region = spotRegionByDay.get(it.day);
      const picked = pickByRegion(input.stays, region, usedStays);
      if (!picked) return it;
      usedStays.add(picked.id);
      if (picked.id !== it.refId) changedCommerce = true;
      return { ...it, refId: picked.id };
    }
    return it;
  });

  return {
    ...base,
    dayCount: targetDayCount,
    altNote: note(changedSpotIds, changedCommerce) ?? base.altNote,
    items: sortItems(items.filter((it) => {
      if (it.kind === "spot") return Boolean(it.refId);
      if (it.kind === "eat") return input.eats.some((e) => e.id === it.refId);
      return input.stays.some((st) => st.id === it.refId);
    })),
  };
}

function composeFromScratch(input: ComposeCourseInput, options: NormalizedComposeOptions): Course {
  const dayCount = options.days ?? input.dayCount ?? inferDayCount(input.theme);
  // 각 날짜에 적어도 한 장소를 배치한다. 부족한 후보로 빈 Day를 만들지 않는다.
  const actualDays = Math.min(dayCount, uniqueById(input.spots).length);
  const perDay = Math.min(options.maxSpotsPerDay, Math.max(1, Math.ceil(input.spots.length / actualDays)));
  const pickedSpots = pickScratchSpots(input, actualDays, { ...options, maxSpotsPerDay: perDay });

  const usedEats = new Set<string>();
  const usedStays = new Set<string>();
  const items: CourseItem[] = [];

  const slotsUsed = new Map<number, number>();
  for (let i = 0; i < pickedSpots.length; i++) {
    const day = Math.floor(i * actualDays / pickedSpots.length) + 1;
    const slot = slotsUsed.get(day) ?? 0;
    slotsUsed.set(day, slot + 1);
    const spot = pickedSpots[i]!;
    items.push({ kind: "spot", day, time: DEFAULT_TIMES[slot] ?? "16:30", refId: spot.id, durationMin: slot === 0 ? 90 : 60 });
    if (slot === 0) {
      const eat = pickByRegion(input.eats, localized(spot.region, "ko"), usedEats);
      if (eat) {
        usedEats.add(eat.id);
        items.push({ kind: "eat", day, time: "12:30", refId: eat.id });
      }
    }
    if (day < actualDays && Math.floor((i + 1) * actualDays / pickedSpots.length) + 1 > day) {
      const stay = pickByRegion(input.stays, localized(spot.region, "ko"), usedStays);
      if (stay) {
        usedStays.add(stay.id);
        items.push({ kind: "stay", day, time: "18:30", refId: stay.id });
      }
    }
  }

  return {
    themeId: input.theme.id,
    title: L(`${localized(input.theme.title, "ko")} 맞춤 코스`, `${localized(input.theme.title, "en")} custom itinerary`),
    dayCount: Math.max(1, ...items.map((it) => it.day)),
    altNote: L("관광지·식사·숙박을 테마와 권역에 맞춰 연결했어요.", "Course composer assembled stops, meals, and stays by theme and region."),
    items: sortItems(items),
  };
}

export function composeCourse(input: ComposeCourseInput, options: ComposeCourseOptions = {}): Course | null {
  const normalized: NormalizedComposeOptions = {
    avoidBusy: options.avoidBusy ?? true,
    days: options.days,
    pace: options.pace,
    companion: options.companion,
    startRegion: options.startRegion,
    transport: options.transport ?? "car",
    travelTimeLookup: options.travelTimeLookup ?? approxTravelTimeLookup,
    maxSpotsPerDay: options.maxSpotsPerDay ?? spotsPerDayForPace(options.pace),
  };

  if (input.spots.length === 0) return null;
  if (input.baseCourse) {
    const course = composeFromTemplate(input, normalized);
    if (course.items.some((it) => it.kind === "spot")) return course;
  }
  return composeFromScratch(input, normalized);
}
