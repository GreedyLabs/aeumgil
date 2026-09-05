// ─────────────────────────────────────────────
// 식사(Eat)/숙박(Stay) 후보 DB 접근 계층 — 서버 전용.
//
// commerce_profile(TourAPI 수집분)을 도메인 Eat/Stay 로 정규화한다.
// 수집은 scripts/collect-commerce.mjs 가 담당하고, 여기는 읽기만 한다.
// ─────────────────────────────────────────────

import { and, desc, eq } from "drizzle-orm";
import { L } from "@/lib/i18n";
import type { Eat, Stay } from "@/domain/types";
import type { Database } from "./index";
import { commerceProfiles } from "./schema";

type CommerceRow = typeof commerceProfiles.$inferSelect;

export function mapEatRow(row: CommerceRow): Eat {
  return {
    id: row.id,
    name: L(row.nameKo, row.nameEn ?? undefined),
    type: L(row.typeKo, row.typeEn ?? undefined),
    price: row.priceKo,
    rating: row.rating,
    region: L(row.regionKo, row.regionEn ?? undefined),
    imageUrl: row.imageUrl ?? undefined,
    address: row.addr ?? undefined,
    telephone: row.tel ?? undefined,
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
  };
}

export function mapStayRow(row: CommerceRow): Stay {
  return {
    id: row.id,
    name: L(row.nameKo, row.nameEn ?? undefined),
    type: L(row.typeKo, row.typeEn ?? undefined),
    price: L(row.priceKo, row.priceEn ?? undefined),
    rating: row.rating,
    region: L(row.regionKo, row.regionEn ?? undefined),
    imageUrl: row.imageUrl ?? undefined,
    address: row.addr ?? undefined,
    telephone: row.tel ?? undefined,
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
  };
}

export async function fetchEats(db: Database): Promise<Eat[]> {
  const rows = await db
    .select()
    .from(commerceProfiles)
    .where(eq(commerceProfiles.kind, "eat"))
    .orderBy(desc(commerceProfiles.rating), commerceProfiles.id);
  return rows.map(mapEatRow);
}

export async function fetchEat(db: Database, id: string): Promise<Eat | null> {
  const rows = await db
    .select()
    .from(commerceProfiles)
    .where(and(eq(commerceProfiles.id, id), eq(commerceProfiles.kind, "eat")))
    .limit(1);
  const row = rows[0];
  return row ? mapEatRow(row) : null;
}

export async function fetchStays(db: Database): Promise<Stay[]> {
  const rows = await db
    .select()
    .from(commerceProfiles)
    .where(eq(commerceProfiles.kind, "stay"))
    .orderBy(desc(commerceProfiles.rating), commerceProfiles.id);
  return rows.map(mapStayRow);
}

export async function fetchStay(db: Database, id: string): Promise<Stay | null> {
  const rows = await db
    .select()
    .from(commerceProfiles)
    .where(and(eq(commerceProfiles.id, id), eq(commerceProfiles.kind, "stay")))
    .limit(1);
  const row = rows[0];
  return row ? mapStayRow(row) : null;
}
