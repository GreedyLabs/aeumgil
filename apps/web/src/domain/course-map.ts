import type { CourseItem, Eat, Spot, Stay } from "./types";
export interface CourseMapStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  time: string;
  kind: CourseItem["kind"];
}
export interface CourseRouteLeg {
  day: number;
  fromId: string;
  toId: string;
  minutes: number;
  distanceKm: number;
  source: "approx" | "api";
  path?: { lat: number; lon: number }[];
}
export function courseMapStops(
  items: CourseItem[],
  spots: Record<string, Spot>,
  eats: Record<string, Eat>,
  stays: Record<string, Stay>,
): CourseMapStop[] {
  return items.flatMap((item) => {
    const place =
      item.kind === "spot"
        ? spots[item.refId]
        : item.kind === "eat"
          ? eats[item.refId]
          : stays[item.refId];
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return [];
    return [
      {
        id: item.refId,
        name: place.name.ko,
        lat: place.lat!,
        lon: place.lon!,
        time: item.time,
        kind: item.kind,
      },
    ];
  });
}
