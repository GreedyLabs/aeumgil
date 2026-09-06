import { z } from "zod";
import type { LocalizedText } from "@/lib/i18n";
import {
  GANGWON_REGIONS,
  PLACE_CATEGORIES,
  PLACE_PAGE_SIZE,
  type PlaceSearchQuery,
  type PlaceSearchResult,
} from "./place-search";
import type { Eat, Stay } from "./types";

export type CourseSearchKind = "spot" | "eat" | "stay";
export interface CourseSearchPlace {
  kind: CourseSearchKind;
  id: string;
  name: LocalizedText;
  region: LocalizedText;
  type: LocalizedText;
  lat?: number;
  lon?: number;
  imageUrl?: string;
  hasAccessibilityInfo?: boolean;
}
export interface CoursePlaceSearchResult {
  kind: CourseSearchKind;
  items: CourseSearchPlace[];
  page: number;
  pageSize: number;
  total: number;
  query: Required<PlaceSearchQuery>;
}

const querySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(100)
      .transform((q) => q.normalize("NFKC").replace(/\s+/g, " "))
      .default(""),
    region: z
      .string()
      .refine((r) => r === "" || GANGWON_REGIONS.some((item) => item.ko === r))
      .default(""),
    category: z
      .string()
      .refine((c) => c === "" || PLACE_CATEGORIES.some((item) => item.id === c))
      .default(""),
    accessibility: z.enum(["", "info"]).default(""),
    page: z.number().int().min(1).max(500).default(1),
  })
  .strict();

/** Server Action 입력은 타입 선언과 별개로 런타임에서도 검사한다. */
export function parseCoursePlaceSearch(
  query: unknown,
  kind: unknown = "spot",
): { kind: CourseSearchKind; query: Required<PlaceSearchQuery> } {
  const parsedKind = z.enum(["spot", "eat", "stay"]).safeParse(kind);
  const parsedQuery = querySchema.safeParse(query);
  if (!parsedKind.success || !parsedQuery.success)
    throw new Error("검색 종류와 조건을 확인해 주세요.");
  if (parsedKind.data !== "spot" && (parsedQuery.data.category || parsedQuery.data.accessibility))
    throw new Error(
      "음식점·숙소는 지역과 검색어로 찾아 주세요. 무장애 조건은 여행지에서 제공해요.",
    );
  return { kind: parsedKind.data, query: parsedQuery.data };
}

export function courseSpotSearchResult(result: PlaceSearchResult): CoursePlaceSearchResult {
  return {
    ...result,
    kind: "spot",
    items: result.items.map((place) => ({ ...place, kind: "spot" })),
  };
}

/** 공개 DB 카탈로그만 검색한다. 검색 문자를 정규식·SQL로 실행하지 않는다. */
export function filterCourseCommerce(
  places: readonly (Eat | Stay)[],
  rawQuery: PlaceSearchQuery,
  kind: "eat" | "stay",
): CoursePlaceSearchResult {
  const { query } = parseCoursePlaceSearch(rawQuery, kind);
  const words = query.q.toLowerCase().split(/\s+/).filter(Boolean);
  const matching = places
    .filter((place) => {
      if (query.region && place.region.ko !== query.region) return false;
      const text = [
        ...Object.values(place.name),
        place.type.ko,
        place.type.en,
        place.region.ko,
        place.region.en,
        place.address ?? "",
      ]
        .join(" ")
        .normalize("NFKC")
        .toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => a.name.ko.localeCompare(b.name.ko, "ko") || a.id.localeCompare(b.id));
  return {
    kind,
    query,
    page: query.page,
    pageSize: PLACE_PAGE_SIZE,
    total: matching.length,
    items: matching
      .slice((query.page - 1) * PLACE_PAGE_SIZE, query.page * PLACE_PAGE_SIZE)
      .map((place) => ({
        kind,
        id: place.id,
        name: place.name,
        region: place.region,
        type: place.type,
        ...(Number.isFinite(place.lat) ? { lat: place.lat } : {}),
        ...(Number.isFinite(place.lon) ? { lon: place.lon } : {}),
        ...(place.imageUrl ? { imageUrl: place.imageUrl } : {}),
      })),
  };
}
