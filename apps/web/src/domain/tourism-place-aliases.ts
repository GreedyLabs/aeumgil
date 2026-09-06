import { haversineKm } from "./travel-time";

export interface TourismPlaceIdentity {
  id: string;
  nameKo: string;
  regionKo: string;
  lat?: number;
  lon?: number;
}

const REVIEWED_ALIASES = [
  {
    id: "ojukheon",
    names: ["강릉 오죽헌·시립박물관", "오죽헌·시립박물관"],
    region: "강릉",
    lat: 37.7791388748,
    lon: 128.8796621017,
    aliases: ["오죽헌"],
  },
] as const;

function compact(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

/** 공식 자료와 대조한 별칭만 반환한다. ID 재사용·동명 시설·주소 변경 시 자동 연결하지 않는다. */
export function checkedTourismPlaceAliases(place: TourismPlaceIdentity): readonly string[] {
  if (
    place.lat === undefined ||
    place.lon === undefined ||
    !Number.isFinite(place.lat) ||
    !Number.isFinite(place.lon) ||
    place.lat < 33 ||
    place.lat > 39.5 ||
    place.lon < 124 ||
    place.lon > 132
  )
    return [];
  const region = place.regionKo.trim().replace(/[시군]$/, "");
  const record = REVIEWED_ALIASES.find(
    (entry) =>
      entry.id === place.id &&
      entry.region === region &&
      entry.names.some((name) => compact(name) === compact(place.nameKo)) &&
      haversineKm(entry, { lat: place.lat!, lon: place.lon! }) <= 0.5,
  );
  return record?.aliases ?? [];
}
