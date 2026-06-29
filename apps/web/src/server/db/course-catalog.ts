// ─────────────────────────────────────────────
// 코스 생성 후보/템플릿 DB 접근 계층 — 서버 전용.
//
// [학습 메모] 이 계층은 LLM 과 무관하다. DB 에 저장된 코스 템플릿을 도메인 Course 로
// 정규화해 `composeCourse`의 입력으로 넘기기 위한 어댑터다. DB 에 데이터가 없거나
// 접속이 실패하면 호출자(LiveRepository)가 기존 시드 코스로 폴백한다.
// ─────────────────────────────────────────────

import { and, asc, desc, eq } from "drizzle-orm";
import { L } from "@/lib/i18n";
import type { Congestion, Course, CourseItem, CourseItemKind, Spot } from "@/domain/types";
import type { Database } from "./index";
import { courseTemplateItems, courseTemplates, spotProfiles } from "./schema";

function isCourseItemKind(v: string): v is CourseItemKind {
  return v === "spot" || v === "eat" || v === "stay";
}

function congestion(v: string): Congestion {
  return v === "calm" || v === "busy" ? v : "moderate";
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function durationText(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}시간`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  return `${minutes}분`;
}

function mapSpotProfile(row: typeof spotProfiles.$inferSelect): Spot {
  return {
    id: row.spotId,
    name: L(row.nameKo, row.nameEn ?? undefined),
    type: L(row.typeKo, row.typeEn ?? undefined),
    region: L(row.regionKo, row.regionEn ?? undefined),
    congestion: congestion(row.baselineCongestion),
    suitability: row.suitability,
    weather: { tempC: 0, desc: L("실시간 확인 전", "Pending live weather"), icon: "sun" },
    air: L("실시간 확인 전", "Pending live air quality"),
    durationText: L(durationText(row.defaultDurationMin)),
    rating: row.rating,
    reviewCount: row.reviewCount,
    tags: arr(row.tagsKo).map((tag) => L(tag)),
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
  };
}

/** themeId 의 기본 코스 템플릿을 Course 로 정규화한다. 없으면 null. */
export async function fetchDefaultCourseTemplate(db: Database, themeId: string): Promise<Course | null> {
  const [template] = await db
    .select()
    .from(courseTemplates)
    .where(and(eq(courseTemplates.themeId, themeId), eq(courseTemplates.isDefault, true)))
    .orderBy(desc(courseTemplates.updatedAt))
    .limit(1);

  if (!template) return null;

  const rows = await db
    .select()
    .from(courseTemplateItems)
    .where(eq(courseTemplateItems.templateId, template.id))
    .orderBy(asc(courseTemplateItems.day), asc(courseTemplateItems.seq));

  const items: CourseItem[] = rows
    .filter((row) => isCourseItemKind(row.kind))
    .map((row) => ({
      kind: row.kind as CourseItemKind,
      day: row.day,
      time: row.time,
      refId: row.refId,
      durationMin: row.durationMin ?? undefined,
    }));

  return {
    themeId: template.themeId,
    title: L(template.titleKo, template.titleEn ?? undefined),
    dayCount: template.dayCount,
    altNote: template.altNoteKo ? L(template.altNoteKo, template.altNoteEn ?? undefined) : undefined,
    items,
  };
}

/** 코스 생성 후보 POI. DB 가 비어 있거나 해당 테마 후보가 없으면 빈 배열을 반환한다. */
export async function fetchSpotProfilesForTheme(db: Database, themeId: string): Promise<Spot[]> {
  const rows = await db.select().from(spotProfiles).orderBy(desc(spotProfiles.updatedAt));
  return rows.filter((row) => arr(row.themeIds).includes(themeId)).map(mapSpotProfile);
}

/** 단일 DB POI 후보 조회. 화면이 DB 전용 spot_id 를 렌더해야 할 때 사용한다. */
export async function fetchSpotProfile(db: Database, spotId: string): Promise<Spot | null> {
  const [row] = await db.select().from(spotProfiles).where(eq(spotProfiles.spotId, spotId)).limit(1);
  return row ? mapSpotProfile(row) : null;
}
