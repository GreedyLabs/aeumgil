"use server";

import { z } from "zod";
import { getRepository } from "@/data";
import { normalizePlaceQuery, type PlaceSearchResult } from "@/domain/place-search";

const inputSchema = z.object({
  q: z.string().max(100).optional(),
  region: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  accessibility: z.string().max(20).optional(),
  page: z.number().int().min(1).max(500),
});

/** 공개 DB 검색만 실행한다. 카드별 공공 API 보강이나 사용자 데이터 조회는 하지 않는다. */
export async function searchPlacesAction(
  input: unknown,
): Promise<{ ok: true; result: PlaceSearchResult } | { ok: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "검색 조건을 다시 확인해 주세요." };
  try {
    const result = await getRepository().searchSpots(normalizePlaceQuery(parsed.data));
    return { ok: true, result };
  } catch {
    return { ok: false, error: "여행지를 더 불러오지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
}
