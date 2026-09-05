// 기상청 생활기상지수 V5: 발표시각부터 3시간 간격의 자외선 예측.
import { env } from "@/lib/env";
import { apiCache } from "@/server/cache";
import type { Spot } from "@/domain/types";
import { callDataGoKr } from "./http";
import { type RegionKey, DISTRICT_CODES } from "./regions";

export type UvRow = { date?: string; areaNo?: string; [key: string]: string | undefined };
export function uvIssueTime(now: Date): string {
  // 정시 직후 미발표 구간을 피한다. 이전 발표에도 최대 75시간 예측이 포함된다.
  const kst = new Date(now.getTime() + 9 * 3600_000 - 30 * 60_000);
  return (
    kst.toISOString().slice(0, 10).replaceAll("-", "") +
    String(Math.floor(kst.getUTCHours() / 3) * 3).padStart(2, "0")
  );
}
export function normalizeUv(row: UvRow, now: Date): Spot["uv"] {
  const d = row.date;
  if (!d || !/^\d{10}$/.test(d)) return undefined;
  const base = Date.parse(
    `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(8, 10)}:00:00+09:00`,
  );
  const hours = Math.floor((now.getTime() - base) / 3600_000 / 3) * 3;
  if (!Number.isFinite(base) || hours < 0 || hours > 75) return undefined;
  const raw = row[`h${hours}`];
  if (!raw?.trim()) return undefined;
  const index = Number(raw);
  if (!Number.isFinite(index) || index < 0 || index > 30) return undefined;
  return {
    index,
    forecastAt: new Date(base + hours * 3600_000).toISOString(),
    issuedAt: new Date(base).toISOString(),
  };
}
export async function getUvForRegion(region: RegionKey): Promise<Spot["uv"]> {
  if (!env.DATA_GO_KR_SERVICE_KEY) return undefined;
  const now = new Date();
  const time = uvIssueTime(now);
  const areaNo = DISTRICT_CODES[region] + "00000";
  const row = await apiCache.cached(`uv:v1:${areaNo}:${time}`, 3600_000, async () => {
    const d = await callDataGoKr<{ response?: { body?: { items?: { item?: UvRow | UvRow[] } } } }>(
      "https://apis.data.go.kr/1360000/LivingWthrIdxServiceV5/getUVIdxV5",
      { dataType: "JSON", areaNo, time, numOfRows: 10, pageNo: 1 },
      { serviceKey: env.DATA_GO_KR_SERVICE_KEY! },
    );
    const raw = d.response?.body?.items?.item;
    return (Array.isArray(raw) ? raw : raw ? [raw] : []).find((x) => x.areaNo === areaNo) ?? null;
  });
  return row ? normalizeUv(row, now) : undefined;
}
