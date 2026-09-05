// 관광공사 집중률: 현장 실측 인원이 아닌 이동통신 데이터 기반 일별 방문 예측.
// 명세: https://www.data.go.kr/data/15128555/openapi.do
import { env } from "@/lib/env";
import { apiCache } from "@/server/cache";
import type { Spot } from "@/domain/types";
import { callDataGoKr } from "./http";

// 2026-09-05 실제 API 목록과 동일 관광지 여부를 대조한 명칭만 사용한다.
const MATCHES: Record<string, { district: string; name: string }> = {
  "anmok-beach": { district: "51150", name: "안목해변" },
  "sacheon-beach": { district: "51150", name: "사천진해변(사천뒷불해수욕장)" },
  ojukheon: { district: "51150", name: "강릉 오죽헌" },
  "daegwallyeong-sheep": { district: "51760", name: "대관령양떼목장" },
  "sokcho-market": { district: "51210", name: "속초관광수산시장(구 중앙시장)" },
  "dongmyeong-port": { district: "51210", name: "동명항" },
};

export interface DemandRow {
  baseYmd?: string;
  tAtsNm?: string;
  signguCd?: string;
  cnctrRate?: string;
}
type Forecast = NonNullable<Spot["crowdForecast"]>;

export function normalizeDemand(
  rows: DemandRow[],
  name: string,
  district: string,
  today: string,
  fetchedAt: string,
): Forecast | undefined {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    if (
      r.tAtsNm !== name ||
      r.signguCd !== district ||
      !r.baseYmd ||
      !/^\d{8}$/.test(r.baseYmd) ||
      r.baseYmd < today ||
      !r.cnctrRate?.trim()
    )
      continue;
    const date = `${r.baseYmd.slice(0, 4)}-${r.baseYmd.slice(4, 6)}-${r.baseYmd.slice(6, 8)}`;
    const time = Date.parse(date);
    const rate = Number(r.cnctrRate);
    if (
      !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== date ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100
    )
      continue;
    byDate.set(date, rate);
  }
  const days = [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 30)
    .map(([date, rate]) => ({ date, rate }));
  return days.length ? { place: name, fetchedAt, days } : undefined;
}

export async function getCrowdForecast(spotId: string): Promise<Forecast | undefined> {
  const match = MATCHES[spotId];
  const serviceKey = env.DATA_GO_KR_SERVICE_KEY;
  if (!match || !serviceKey) return undefined;
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replaceAll("-", "");
  // 같은 장소의 전 화면·동시 요청 공유. 날짜별 키로 전날 예측이 오늘에 섞이지 않는다.
  return apiCache
    .cached(`demand:v1:${today}:${match.district}:${match.name}`, 6 * 3600_000, async () => {
      const data = await callDataGoKr<{
        response?: { body?: { items?: { item?: DemandRow | DemandRow[] } | "" } };
      }>(
        "https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList",
        {
          MobileOS: "ETC",
          MobileApp: "eumgil",
          _type: "json",
          areaCd: "51",
          signguCd: match.district,
          tAtsNm: match.name,
          numOfRows: 100,
          pageNo: 1,
        },
        { serviceKey },
      );
      const items = data.response?.body?.items;
      const rows =
        items && items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : [];
      // 정상 빈 응답도 캐시한다. 미등록 장소를 매 페이지마다 다시 조회하지 않는다.
      return (
        normalizeDemand(rows, match.name, match.district, today, new Date().toISOString()) ?? null
      );
    })
    .then((value) => value ?? undefined);
}
