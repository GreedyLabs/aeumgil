import { env } from "@/lib/env";
import { apiCache } from "@/server/cache";
import type { HighwayStatus } from "@/domain/types";

export interface RoadRow {
  routeNo?: string;
  routeName?: string;
  conzoneId?: string;
  conzoneName?: string;
  speed?: string;
  stdDate?: string;
  stdHour?: string;
  updownTypeCode?: string;
}
const ROUTES: Record<string, string> = {
  "0500": "영동고속도로",
  "0600": "서울양양고속도로",
  "0650": "동해고속도로(삼척–속초)",
};
export function normalizeHighways(rows: RoadRow[], now: number): HighwayStatus[] {
  return Object.entries(ROUTES).flatMap(([code, name]) => {
    const zones = new Map<string, { name: string; speed: number; time: number }>();
    for (const row of rows) {
      if (
        row.routeNo !== code ||
        !row.conzoneId ||
        !row.speed?.trim() ||
        !/^\d{8}$/.test(row.stdDate || "") ||
        !/^\d{4}$/.test(row.stdHour || "")
      )
        continue;
      const d = row.stdDate!,
        h = row.stdHour!;
      const time = Date.parse(
        `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${h.slice(0, 2)}:${h.slice(2)}:00+09:00`,
      );
      const speed = Number(row.speed);
      if (
        !Number.isFinite(time) ||
        time > now ||
        now - time > 20 * 60_000 ||
        !Number.isFinite(speed) ||
        speed < 0 ||
        speed > 200
      )
        continue;
      const key = row.conzoneId + ":" + row.updownTypeCode;
      const previous = zones.get(key);
      // 같은 구간·방향에 여러 검지기가 있으면 가장 낮은 관측속도를 남긴다.
      if (!previous || speed < previous.speed)
        zones.set(key, { name: row.conzoneName || row.conzoneId, speed, time });
    }
    const values = [...zones.values()];
    if (!values.length) return [];
    const slow = values.filter((x) => x.speed < 40).sort((a, b) => a.speed - b.speed);
    return [
      {
        route: name,
        segments: values.length,
        slowSegments: slow.length,
        observedAt: new Date(Math.min(...values.map((x) => x.time))).toISOString(),
        slow: slow.slice(0, 3).map((x) => ({ name: x.name, speed: x.speed })),
      },
    ];
  });
}
export async function getHighways(): Promise<HighwayStatus[]> {
  if (!env.EX_ROAD_SERVICE_KEY) return [];
  const rows = await apiCache.cached("highways:v1", 5 * 60_000, async () => {
    const url = new URL("https://data.ex.co.kr/openapi/odtraffic/trafficAmountByRealtime");
    url.searchParams.set("key", env.EX_ROAD_SERVICE_KEY!);
    url.searchParams.set("type", "json");
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`도로공사 HTTP ${response.status}`);
    const d = (await response.json()) as { code?: string; list?: RoadRow[] };
    if (d.code !== "SUCCESS" || !Array.isArray(d.list)) throw new Error("도로공사 응답 확인 필요");
    return d.list.filter((row) => row.routeNo && ROUTES[row.routeNo]);
  });
  return normalizeHighways(rows, Date.now());
}
