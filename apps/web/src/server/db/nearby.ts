import { and, between, eq, sql } from "drizzle-orm";
import type { Database } from "./index";
import { spotProfiles, commerceProfiles } from "./schema";
import { mapSpotProfile } from "./course-catalog";
import { mapEatRow } from "./commerce";
import { haversineKm } from "@/domain/travel-time";

export async function fetchNearbyTourism(db: Database, lat: number, lon: number) {
  // 10km 반경 후보만 SQL에서 먼저 줄인다. 목록에는 외부 API 보강을 하지 않는다.
  const [spots, eats] = await Promise.all([
    db
      .select()
      .from(spotProfiles)
      .where(
        and(
          between(spotProfiles.lat, lat - 0.1, lat + 0.1),
          between(spotProfiles.lon, lon - 0.13, lon + 0.13),
        ),
      )
      .orderBy(sql`power(${spotProfiles.lat}-${lat},2)+power((${spotProfiles.lon}-${lon})*0.8,2)`)
      .limit(30),
    db
      .select()
      .from(commerceProfiles)
      .where(
        and(
          eq(commerceProfiles.kind, "eat"),
          between(commerceProfiles.lat, lat - 0.1, lat + 0.1),
          between(commerceProfiles.lon, lon - 0.13, lon + 0.13),
        ),
      )
      .orderBy(
        sql`power(${commerceProfiles.lat}-${lat},2)+power((${commerceProfiles.lon}-${lon})*0.8,2)`,
      )
      .limit(30),
  ]);
  const nearby = <T extends { lat: number | null; lon: number | null }>(rows: T[]) =>
    rows
      .filter(
        (row) =>
          row.lat !== null &&
          row.lon !== null &&
          haversineKm({ lat, lon }, { lat: row.lat, lon: row.lon }) <= 10,
      )
      .sort(
        (a, b) =>
          haversineKm({ lat, lon }, { lat: a.lat!, lon: a.lon! }) -
          haversineKm({ lat, lon }, { lat: b.lat!, lon: b.lon! }),
      )
      .slice(0, 6);
  return { spots: nearby(spots).map(mapSpotProfile), eats: nearby(eats).map(mapEatRow) };
}
