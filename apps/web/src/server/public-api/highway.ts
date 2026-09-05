import { env } from "@/lib/env";
import { apiCache } from "@/server/cache";
import type { HighwaySegment, HighwayStatus } from "@/domain/types";
import {
  HIGHWAY_MAX_AGE_MS,
  HIGHWAY_ROUTES,
  emptyHighwayStatus,
  highwaySpeedLevel,
} from "@/domain/highway";

export interface RoadRow {
  routeNo?: string;
  routeName?: string;
  conzoneId?: string;
  conzoneName?: string;
  speed?: string;
  stdDate?: string;
  stdHour?: string;
  updownTypeCode?: string;
  vdsId?: string;
}

function observationTime(row: RoadRow): number | null {
  const d = row.stdDate || "";
  const h = row.stdHour || "";
  if (!/^\d{8}$/.test(d) || !/^\d{4}$/.test(h)) return null;
  const local = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${h.slice(0, 2)}:${h.slice(2)}:00`;
  const time = Date.parse(`${local}+09:00`);
  // Date.parse가 2월 30일 등을 다음 달로 보정해 관측일을 바꾸는 것을 막는다.
  if (
    !Number.isFinite(time) ||
    new Date(time + 9 * 60 * 60_000).toISOString().slice(0, 19) !== local
  )
    return null;
  return time;
}

export function normalizeHighways(rows: RoadRow[], now: number): HighwayStatus[] {
  return HIGHWAY_ROUTES.map((route) => {
    const result = emptyHighwayStatus(route);
    const zones = new Map<string, RoadRow[]>();
    for (const row of rows) {
      if (row.routeNo !== route.code || !row.conzoneId) continue;
      const key = `${row.conzoneId}:${row.updownTypeCode || ""}`;
      const group = zones.get(key);
      if (group) group.push(row);
      else zones.set(key, [row]);
    }
    const staleTimes: number[] = [];
    for (const [id, observations] of zones) {
      const timed = observations.flatMap((row) => {
        const time = observationTime(row);
        return time !== null && time <= now ? [{ row, time }] : [];
      });
      if (!timed.length) {
        result.unavailableSegments++;
        continue;
      }
      const latest = Math.max(...timed.map(({ time }) => time));
      // 이전 관측의 저속을 새 관측에 섞거나 최신 미측정을 과거 값으로 채우지 않는다.
      const measured = timed
        .filter(({ time }) => time === latest)
        .flatMap(({ row }) => {
          const speed = row.speed?.trim() ? Number(row.speed) : NaN;
          return Number.isFinite(speed) && speed >= 0 && speed <= 200 ? [{ row, speed }] : [];
        })
        .sort((a, b) => a.speed - b.speed);
      const lowest = measured[0];
      if (!lowest) {
        result.unavailableSegments++;
        continue;
      }
      if (now - latest > HIGHWAY_MAX_AGE_MS) {
        result.staleSegments++;
        staleTimes.push(latest);
        continue;
      }
      const segment: HighwaySegment = {
        id,
        name: lowest.row.conzoneName?.trim() || "구간명 미제공",
        directionCode: lowest.row.updownTypeCode,
        speed: lowest.speed,
        observedAt: new Date(latest).toISOString(),
      };
      result.details.push(segment);
      const level = highwaySpeedLevel(segment.speed);
      if (level === "slow") result.slowSegments++;
      else if (level === "delayed") result.delayedSegments++;
    }
    result.details.sort((a, b) => a.speed - b.speed || a.name.localeCompare(b.name, "ko"));
    result.segments = result.details.length;
    if (result.segments) {
      result.status = "current";
      result.observedAt = result.details.reduce(
        (oldest, segment) => (segment.observedAt < oldest ? segment.observedAt : oldest),
        result.details[0]!.observedAt,
      );
    } else if (staleTimes.length) {
      result.status = "stale";
      result.observedAt = new Date(Math.max(...staleTimes)).toISOString();
    }
    return result;
  });
}

export async function getHighways(): Promise<HighwayStatus[]> {
  if (!env.EX_ROAD_SERVICE_KEY) return normalizeHighways([], Date.now());
  const rows = await apiCache.cached("highways:v1", 5 * 60_000, async () => {
    const url = new URL("https://data.ex.co.kr/openapi/odtraffic/trafficAmountByRealtime");
    url.searchParams.set("key", env.EX_ROAD_SERVICE_KEY!);
    url.searchParams.set("type", "json");
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`도로공사 HTTP ${response.status}`);
    const d = (await response.json()) as { code?: string; list?: RoadRow[] };
    if (d.code !== "SUCCESS" || !Array.isArray(d.list)) throw new Error("도로공사 응답 확인 필요");
    return d.list.filter((row) => HIGHWAY_ROUTES.some((route) => row.routeNo === route.code));
  });
  return normalizeHighways(rows, Date.now());
}
