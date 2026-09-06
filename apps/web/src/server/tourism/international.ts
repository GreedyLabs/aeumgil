import type { Eat, Spot, Stay } from "@/domain/types";
import { checkedTourismPlaceAliases } from "@/domain/tourism-place-aliases";
import { localized, type Lang } from "@/lib/i18n";
import {
  getInternationalCatalog,
  getInternationalTourInfo,
  matchInternationalSpot,
} from "@/server/public-api/international-tourapi";

type Place = Spot | Eat | Stay;

function identity(place: Place) {
  return {
    ...place,
    region: place.region.ko,
    nameAliases: checkedTourismPlaceAliases({
      ...place,
      nameKo: place.name.ko,
      regionKo: place.region.ko,
    }),
  };
}

/** 국문 정본 ID·좌표·지역 필터를 유지하고, 검증된 같은 장소의 표시 정보만 덧붙인다. */
export async function localizePlaces<T extends Place>(places: T[], lang: Lang): Promise<T[]> {
  if (lang === "ko" || !places.length) return places;
  const catalog = await getInternationalCatalog(lang);
  return places.map((place) => {
    const match = matchInternationalSpot(identity(place), catalog.items);
    if (match.status !== "matched") return place;
    return {
      ...place,
      name: { ...place.name, [lang]: match.item.title },
      address: match.item.address || place.address,
    };
  });
}

export async function localizeSpotDetail(spot: Spot, lang: Lang): Promise<Spot> {
  if (lang === "ko") return spot;
  const info = await getInternationalTourInfo(identity(spot), lang);
  if (info.status !== "available")
    return { ...spot, translation: { language: lang, status: "original" } };
  return {
    ...spot,
    name: { ...spot.name, [lang]: info.title },
    address: info.address || spot.address,
    description: info.overview
      ? {
          ko: spot.description?.ko ?? "",
          en: spot.description?.en ?? "",
          ...spot.description,
          [lang]: info.overview,
        }
      : spot.description,
    visitInfo: {
      ...spot.visitInfo,
      ...Object.fromEntries(Object.entries(info.visitInfo).filter(([, value]) => Boolean(value))),
    },
    translation: {
      language: lang,
      status: info.overview && info.unavailableSections.length === 0 ? "official" : "partial",
      source: info.provenance.service,
      contentId: info.contentId,
    },
  };
}

/** 검색어는 사용자별로 보관하지 않으며 공개 목록의 다국어 표시 값만 비교한다. */
export function matchingLocalizedPlaceIds(
  places: readonly Place[],
  query: string,
  lang: Lang,
): string[] {
  const terms = query.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return places
    .filter((place) => {
      const values = [
        ...Object.values(place.name),
        ...Object.values(place.region),
        ...Object.values(place.type),
        localized(place.region, lang),
        localized(place.type, lang),
        place.address ?? "",
        ...("tags" in place
          ? place.tags.flatMap((tag) => [...Object.values(tag), localized(tag, lang)])
          : []),
      ]
        .join(" ")
        .normalize("NFKC")
        .toLowerCase();
      return terms.every((term) => values.includes(term));
    })
    .map((place) => place.id);
}
