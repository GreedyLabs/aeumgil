// ─────────────────────────────────────────────
// 도로 이동시간 근사 유틸.
//
// 실제 길찾기 API 전 단계에서 쓰는 순수 함수다. 좌표 직선거리만 비교하면 "원래 장소와
// 가까운지"는 알 수 있지만, 하루 동선의 전후 방문지 사이에서 얼마나 돌아가는지는 놓친다.
// 여기서는 haversine 거리 → 강원 권역 특성 보정 → 분 단위 이동시간으로 근사해 composer
// 랭킹에 넣는다. 외부 API가 붙으면 이 파일의 포트만 교체하고 composeCourse 계약은 유지한다.
// ─────────────────────────────────────────────

export interface Coord {
  lat: number;
  lon: number;
  region?: string;
}

export type TravelMode = "car" | "transit" | "walk";

export interface RouteContext {
  prev?: Coord;
  next?: Coord;
  mode?: TravelMode;
  lookup?: TravelTimeLookup;
}

export interface TravelEstimate {
  path?: { lat: number; lon: number }[];
  distanceKm: number;
  driveMinutes: number;
  mode: TravelMode;
  source?: "approx" | "api";
}

export interface TravelTimeLookup {
  estimate(a: Coord, b: Coord, mode?: TravelMode): TravelEstimate | null;
}

function hasCoord(v: unknown): v is Coord {
  const c = v as Partial<Coord>;
  return (
    typeof c?.lat === "number" &&
    Number.isFinite(c.lat) &&
    typeof c.lon === "number" &&
    Number.isFinite(c.lon)
  );
}

export function haversineKm(a: Coord, b: Coord): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function regionFactor(a: Coord, b: Coord): number {
  if (!a.region || !b.region) return 1.18;
  if (a.region === b.region) return 1.14;
  if ([a.region, b.region].some((r) => /평창|정선|인제|설악|오대산/.test(r))) return 1.34;
  return 1.24;
}

function averageSpeedKmh(distanceKm: number, a: Coord, b: Coord, mode: TravelMode): number {
  if (mode === "walk") return 4.2;
  if (mode === "transit") {
    if (distanceKm < 4) return 13;
    if (distanceKm < 18) return 24;
    return 36;
  }

  const mountain = [a.region, b.region].some((r) => r && /평창|정선|인제|설악|오대산/.test(r));
  if (distanceKm < 4) return mountain ? 24 : 28;
  if (distanceKm < 18) return mountain ? 36 : 42;
  return mountain ? 48 : 58;
}

function modeOverhead(distanceKm: number, mode: TravelMode): number {
  if (mode === "walk") return 1;
  if (mode === "transit") return distanceKm < 6 ? 10 : 16;
  return distanceKm < 6 ? 4 : 7;
}

function estimateApproxDrive(a: Coord, b: Coord, mode: TravelMode = "car"): TravelEstimate | null {
  if (!hasCoord(a) || !hasCoord(b)) return null;
  const straight = haversineKm(a, b);
  const distanceKm = straight * regionFactor(a, b);
  const minutes = (distanceKm / averageSpeedKmh(distanceKm, a, b, mode)) * 60;
  return {
    distanceKm,
    driveMinutes: Math.round(minutes + modeOverhead(distanceKm, mode)),
    mode,
    source: "approx",
  };
}

export const approxTravelTimeLookup: TravelTimeLookup = {
  estimate: estimateApproxDrive,
};

export function estimateDrive(
  a: Coord,
  b: Coord,
  mode: TravelMode = "car",
  lookup: TravelTimeLookup = approxTravelTimeLookup,
): TravelEstimate | null {
  return lookup.estimate(a, b, mode);
}

export function estimateRouteMinutes(
  points: Coord[],
  mode: TravelMode = "car",
  lookup: TravelTimeLookup = approxTravelTimeLookup,
): number | null {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const leg = estimateDrive(points[i - 1]!, points[i]!, mode, lookup);
    if (!leg) return null;
    total += leg.driveMinutes;
  }
  return total;
}

export function extraRouteMinutes(
  original: Coord,
  candidate: Coord,
  context: RouteContext,
): number | null {
  const mode = context.mode ?? "car";
  const lookup = context.lookup ?? approxTravelTimeLookup;
  const before = [context.prev, original, context.next].filter(hasCoord);
  const after = [context.prev, candidate, context.next].filter(hasCoord);

  // 전후 방문지가 없으면 원래 장소→후보 거리만 보조 패널티로 쓴다.
  if (before.length < 2 || after.length < 2) {
    const direct = estimateDrive(original, candidate, mode, lookup);
    return direct ? Math.max(0, direct.driveMinutes - 12) : null;
  }

  const beforeMinutes = estimateRouteMinutes(before, mode, lookup);
  const afterMinutes = estimateRouteMinutes(after, mode, lookup);
  if (beforeMinutes === null || afterMinutes === null) return null;
  return Math.max(0, afterMinutes - beforeMinutes);
}

export function routePenaltyPoints(
  original: Coord,
  candidate: Coord,
  context: RouteContext,
): number {
  const extra = extraRouteMinutes(original, candidate, context);
  if (extra === null) return 0;
  if (extra <= 8) return 0;
  return Math.min(42, (extra - 8) * 0.55);
}
