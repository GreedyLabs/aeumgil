import type { FestivalDetail, Spot } from "@/domain/types";
import { L } from "@/lib/i18n";
import { apiCache } from "@/server/cache";
import { requireDb } from "@/server/db";
import { fetchNearbyTourism } from "@/server/db/nearby";
import { getItemDetail, cleanTourText, type TourDetail } from "@/server/public-api/tourapi";
import { GANGWON_REGIONS } from "@/domain/place-search";

export function festivalDate(value: string | undefined): string {
  if (!/^\d{8}$/.test(value || "")) return "";
  const date = `${value!.slice(0, 4)}-${value!.slice(4, 6)}-${value!.slice(6, 8)}`;
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date
    ? date
    : "";
}
export function festivalFromTour(
  detail: TourDetail,
): Omit<FestivalDetail, "nearbySpots" | "nearbyEats"> | null {
  if (detail.contentTypeId !== "15" || detail.areaCode !== "51") return null;
  const info = detail.festivalInfo ?? {};
  const region = GANGWON_REGIONS.find((r) => r.code === detail.sigunguCode);
  const rawHomepage = info.eventhomepage || detail.homepage;
  const url = rawHomepage.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] || cleanTourText(rawHomepage);
  let homepage: string | undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") homepage = parsed.href;
  } catch {
    /* 잘못된 링크는 표시하지 않는다. */
  }
  const place: Spot = {
    id: `festival-${detail.contentId}`,
    sourceContentId: detail.contentId,
    name: L(detail.title),
    region: L(region?.ko || "강원특별자치도"),
    type: L("축제·행사"),
    congestion: "moderate",
    suitability: 0,
    weather: { tempC: 0, desc: L("정보 없음"), icon: "sun" },
    air: L("정보 없음"),
    rating: 0,
    reviewCount: 0,
    tags: [],
    lat: detail.mapY >= 36.9 && detail.mapY <= 38.7 ? detail.mapY : undefined,
    lon: detail.mapX >= 127 && detail.mapX <= 129.6 ? detail.mapX : undefined,
    address: detail.addr,
    imageUrl: detail.image || undefined,
    description: detail.overview ? L(detail.overview) : undefined,
    photos: detail.photos,
  };
  return {
    event: {
      id: detail.contentId,
      name: place.name,
      startsOn: festivalDate(info.eventstartdate),
      endsOn: festivalDate(info.eventenddate),
      address: detail.addr,
      imageUrl: detail.image || undefined,
    },
    place,
    venue: cleanTourText(info.eventplace),
    hours: cleanTourText(info.playtime),
    fees: cleanTourText(info.usetimefestival),
    host: cleanTourText(info.sponsor1),
    phone: cleanTourText(info.sponsor1tel || info.sponsor2tel || detail.tel),
    homepage,
  };
}
export async function fetchFestivalDetail(id: string): Promise<FestivalDetail | null> {
  const contentId = id.replace(/^festival-/, "");
  if (!/^\d{1,12}$/.test(contentId)) return null;
  const detail = await apiCache.cached(`tour:v4:${contentId}`, 24 * 60 * 60 * 1000, () =>
    getItemDetail(contentId),
  );
  const festival = detail ? festivalFromTour(detail) : null;
  if (!festival) return null;
  const { lat, lon } = festival.place;
  const nearby =
    lat !== undefined && lon !== undefined
      ? await fetchNearbyTourism(requireDb(), lat, lon)
      : { spots: [], eats: [] };
  return { ...festival, nearbySpots: nearby.spots, nearbyEats: nearby.eats };
}
