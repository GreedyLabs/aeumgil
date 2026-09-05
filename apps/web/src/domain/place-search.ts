import regions from "./gangwon-regions.json";
import type { Spot } from "./types";

export const GANGWON_REGIONS = regions;
export const PLACE_CATEGORIES = [
  { id: "sea", label: "바다·항구" },
  { id: "forest", label: "숲·정원" },
  { id: "nature", label: "산·계곡·호수" },
  { id: "culture", label: "전시·예술" },
  { id: "heritage", label: "역사·사찰" },
  { id: "family", label: "체험·나들이" },
  { id: "activity", label: "레포츠" },
  { id: "wellness", label: "온천·휴식" },
  { id: "market", label: "시장·쇼핑" },
  { id: "other", label: "기타 명소" },
] as const;
export interface PlaceSearchQuery {
  q?: string;
  region?: string;
  category?: string;
  accessibility?: string;
  page?: number;
}
export interface PlaceSearchResult {
  items: Spot[];
  total: number;
  page: number;
  pageSize: number;
  query: Required<PlaceSearchQuery>;
}
export const PLACE_PAGE_SIZE = 24;
export function normalizePlaceQuery(query: PlaceSearchQuery): Required<PlaceSearchQuery> {
  return {
    q: (query.q ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
    region: regions.some((r) => r.ko === query.region) ? query.region! : "",
    category: PLACE_CATEGORIES.some((c) => c.id === query.category) ? query.category! : "",
    accessibility: query.accessibility === "info" ? "info" : "",
    page: Number.isFinite(query.page) ? Math.max(1, Math.min(500, Math.floor(query.page!))) : 1,
  };
}
export function placeSearchParams(query: PlaceSearchQuery): URLSearchParams {
  const clean = normalizePlaceQuery(query);
  const params = new URLSearchParams();
  if (clean.q) params.set("q", clean.q);
  if (clean.region) params.set("region", clean.region);
  if (clean.category) params.set("category", clean.category);
  if (clean.accessibility) params.set("accessibility", clean.accessibility);
  if (clean.page > 1) params.set("page", String(clean.page));
  return params;
}
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
