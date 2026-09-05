import type { Spot } from "@/domain/types";
import { requireEnv } from "@/lib/env";
import { apiCache } from "@/server/cache";
import { callDataGoKr } from "./http";
import { cleanTourText } from "./tourapi";

const FIELDS = [
  ["parking", "장애인 주차"],
  ["route", "접근 동선"],
  ["publictransport", "교통·접근 안내"],
  ["exit", "출입구"],
  ["wheelchair", "휠체어 대여"],
  ["elevator", "엘리베이터"],
  ["restroom", "장애인 화장실"],
  ["ticketoffice", "매표소"],
  ["auditorium", "관람석"],
  ["room", "객실"],
  ["handicapetc", "이동 편의 기타"],
  ["braileblock", "점자블록"],
  ["helpdog", "보조견 동반"],
  ["guidehuman", "안내 요원"],
  ["audioguide", "오디오 안내"],
  ["bigprint", "큰 글자 안내"],
  ["brailepromotion", "점자 안내"],
  ["guidesystem", "유도 안내"],
  ["blindhandicapetc", "시각 지원 기타"],
  ["signguide", "수어 안내"],
  ["videoguide", "영상·자막 안내"],
  ["hearingroom", "청각 지원 객실"],
  ["hearinghandicapetc", "청각 지원 기타"],
  ["stroller", "유모차 대여"],
  ["lactationroom", "수유실"],
  ["babysparechair", "유아 의자"],
  ["infantsfamilyetc", "영유아 동반 기타"],
  ["promotion", "안내 자료"],
] as const;

/** '없음'·조건부 이용도 원문 그대로 표시한다. 정보 존재를 접근 가능 판정으로 바꾸지 않는다. */
export function normalizeAccessibility(
  raw: Record<string, unknown>,
): NonNullable<Spot["accessibility"]>["items"] {
  return FIELDS.flatMap(([key, label]) => {
    const value = typeof raw[key] === "string" ? cleanTourText(raw[key]) : "";
    return value && value !== "-" ? [{ key, label, value }] : [];
  });
}

export async function getAccessibility(contentId: string): Promise<Spot["accessibility"]> {
  return apiCache.cached(`accessibility:v1:${contentId}`, 24 * 60 * 60 * 1000, async () => {
    const data = await callDataGoKr<{
      response?: {
        body?: { items?: { item?: Record<string, unknown> | Record<string, unknown>[] } | "" };
      };
    }>(
      "https://apis.data.go.kr/B551011/KorWithService2/detailWithTour2",
      { MobileOS: "ETC", MobileApp: "eumgil", _type: "json", contentId, numOfRows: 1, pageNo: 1 },
      { serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY") },
    );
    const body = data.response?.body?.items;
    const row =
      body && body.item ? (Array.isArray(body.item) ? body.item[0] : body.item) : undefined;
    if (row?.contentid && row.contentid !== contentId)
      throw new Error("무장애 상세 장소 ID 불일치");
    const items = row ? normalizeAccessibility(row) : [];
    return { items, fetchedAt: new Date().toISOString() };
  });
}
