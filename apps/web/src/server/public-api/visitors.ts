// 광역/기초 통계는 합산하지 않는다. 현지인과 외지인·외국인도 분리한다.
import { env } from "@/lib/env";
import { apiCache } from "@/server/cache";
import type { RegionalVisitors } from "@/domain/types";
import { callDataGoKr } from "./http";
import { DISTRICT_CODES, REGIONS } from "./regions";
export interface VisitorRow {
  signguCode?: string;
  baseYmd?: string;
  touDivCd?: string;
  touNum?: string;
}
export function normalizeVisitors(rows: VisitorRow[], date: string): RegionalVisitors {
  const regions = Object.values(REGIONS).flatMap((region) => {
    const values = new Map<string, number>();
    for (const r of rows) {
      if (r.signguCode !== DISTRICT_CODES[region.key] || r.baseYmd !== date || !r.touNum?.trim())
        continue;
      const n = Number(r.touNum);
      if (Number.isFinite(n) && n >= 0 && r.touDivCd) values.set(r.touDivCd, n);
    }
    const domestic = values.get("2"),
      foreign = values.get("3");
    return domestic === undefined || foreign === undefined
      ? []
      : [{ key: region.key, name: { ko: region.ko, en: region.en }, domestic, foreign }];
  });
  return { date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`, regions };
}
export async function getRegionalVisitors(): Promise<RegionalVisitors | null> {
  const serviceKey = env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) return null;
  const today = new Date(Date.now() + 9 * 3600_000);
  return apiCache.cached(
    `visitors:v1:${today.toISOString().slice(0, 10)}`,
    24 * 3600_000,
    async () => {
      // 발표 지연이 있어 제한된 과거 표본일만 탐색한다. 최신일이라고 표시하지 않는다.
      for (const lag of [1, 14, 35, 63]) {
        const date = new Date(today.getTime() - lag * 86400_000)
          .toISOString()
          .slice(0, 10)
          .replaceAll("-", "");
        const d = await callDataGoKr<{
          response?: { body?: { items?: { item?: VisitorRow | VisitorRow[] } | "" } };
        }>(
          "https://apis.data.go.kr/B551011/DataLabService/locgoRegnVisitrDDList",
          {
            MobileOS: "ETC",
            MobileApp: "eumgil",
            _type: "json",
            startYmd: date,
            endYmd: date,
            numOfRows: 1000,
            pageNo: 1,
          },
          { serviceKey },
        );
        const items = d.response?.body?.items;
        const raw = items && items.item;
        const snapshot = normalizeVisitors(Array.isArray(raw) ? raw : raw ? [raw] : [], date);
        if (snapshot.regions.length) return snapshot;
      }
      return null;
    },
  );
}
