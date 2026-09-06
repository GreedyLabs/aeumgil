// ─────────────────────────────────────────────
// 코스 생성 후보/템플릿 DB 접근 계층 — 서버 전용.
//
// [학습 메모] 이 계층은 LLM 과 무관하다. DB 에 저장된 코스 템플릿을 도메인 Course 로
// 정규화해 `composeCourse`의 입력으로 넘기기 위한 어댑터다.
// ─────────────────────────────────────────────

import { and, or, inArray, asc, avg, count, desc, eq, sql } from "drizzle-orm";
import { CURATED_THEME_ORDER, THEME_COPY, THEME_COVER_PRIORITY } from "@/domain/theme-catalog";
import {
  normalizePlaceQuery,
  escapeLike,
  PLACE_PAGE_SIZE,
  type PlaceSearchQuery,
  type PlaceSearchResult,
} from "@/domain/place-search";
import { L } from "@/lib/i18n";
import type { Congestion, Course, CourseItem, CourseItemKind, Spot, Theme } from "@/domain/types";
import type { Database } from "./index";
import { courseTemplateItems, courseTemplates, reviews, spotProfiles } from "./schema";

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

export function mapSpotProfile(row: typeof spotProfiles.$inferSelect): Spot {
  return {
    id: row.spotId,
    sourceContentId: row.sourceContentId ?? undefined,
    address: row.address ?? undefined,
    hasAccessibilityInfo: row.hasAccessibilityInfo ?? false,
    category: row.category ?? "other",
    name: L(row.nameKo, row.nameEn ?? undefined),
    type: L(row.typeKo, row.typeEn ?? undefined),
    region: L(row.regionKo, row.regionEn ?? undefined),
    congestion: congestion(row.baselineCongestion),
    baselineCongestion: congestion(row.baselineCongestion),
    themeIds: arr(row.themeIds),
    environment: row.env === "beach" || row.env === "mountain" ? row.env : "inland",
    suitability: row.suitability,
    weather: { tempC: 0, desc: L("실시간 확인 전", "Pending live weather"), icon: "sun" },
    air: L("실시간 확인 전", "Pending live air quality"),
    durationText: L(durationText(row.defaultDurationMin)),
    rating: row.rating,
    reviewCount: row.reviewCount,
    tags: arr(row.tagsKo).map((tag) => L(tag)),
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    // 큐레이션 개요. contentId 가 있으면 런타임에 TourAPI 개요가 이 값을 덮는다(repository).
    description: row.descriptionKo
      ? L(row.descriptionKo, row.descriptionEn ?? undefined)
      : undefined,
  };
}

function themeFromTemplate(
  template: typeof courseTemplates.$inferSelect,
  spots: (typeof spotProfiles.$inferSelect)[],
): Theme {
  const title = L(template.titleKo, template.titleEn ?? undefined);
  const priority = THEME_COVER_PRIORITY[template.themeId] ?? [];
  const cover =
    priority.map((id) => spots.find((spot) => spot.spotId === id && spot.imageUrl)).find(Boolean) ??
    spots.filter((spot) => spot.imageUrl).sort((a, b) => a.spotId.localeCompare(b.spotId))[0];
  return {
    id: template.themeId,
    title,
    subtitle: L(`${template.dayCount}일 코스`, `${template.dayCount} day course`),
    tag: title,
    region: L([...new Set(spots.map((s) => s.regionKo))].join(" · ") || "강원특별자치도"),
    hue: hueFromId(template.themeId),
    duration: L(`${template.dayCount}일`, `${template.dayCount} days`),
    pace: L("맞춤", "Personalized"),
    spotCount: spots.length,
    mood: [],
    blurb: L("강원의 관광지를 연결하고, 방문 여건에 맞춰 동선을 추천해요."),
    ...(template.themeId.startsWith("gangwon-")
      ? {
          subtitle: L(
            spots
              .slice(0, 3)
              .map((s) => s.nameKo)
              .join(" · "),
          ),
          tag: L(template.titleKo.split(" · ")[1] ?? "지역 여행"),
          mood: [L(template.titleKo.split(" · ")[1] ?? "지역 여행")],
          blurb: L(
            `${spots
              .slice(0, 3)
              .map((s) => s.nameKo)
              .join(", ")}을 연결해요. 이동 시간과 방문 여건에 맞춰 하루 일정을 조정해 보세요.`,
          ),
        }
      : {}),
    ...THEME_COPY[template.themeId],
    imageUrl: cover?.imageUrl ?? undefined,
    imageLabel: cover ? L(cover.nameKo, cover.nameEn ?? undefined) : undefined,
  };
}

function hueFromId(id: string): number {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

async function spotsByTheme(db: Database, themeId: string) {
  return db
    .select()
    .from(spotProfiles)
    .where(sql`${spotProfiles.themeIds} @> ${JSON.stringify([themeId])}::jsonb`);
}

/** DB 코스 템플릿을 테마 카드 모델로 정규화한다. */
export async function fetchThemes(db: Database): Promise<Theme[]> {
  const templates = await db
    .select()
    .from(courseTemplates)
    .where(eq(courseTemplates.isDefault, true))
    .orderBy(desc(courseTemplates.updatedAt));

  const unique = new Map<string, typeof courseTemplates.$inferSelect>();
  for (const template of templates) {
    if (!unique.has(template.themeId)) unique.set(template.themeId, template);
  }

  // 테마마다 스팟 전건을 다시 읽던 N+1 쿼리를 1회 집계로 줄인다.
  const spots = await db.select().from(spotProfiles);
  const priority = new Map(CURATED_THEME_ORDER.map((id, index) => [id, index]));
  return [...unique.values()]
    .map((template) =>
      themeFromTemplate(
        template,
        spots.filter((row) => arr(row.themeIds).includes(template.themeId)),
      ),
    )
    .filter((theme) => theme.spotCount > 0)
    .sort(
      (a, b) =>
        (priority.get(a.id) ?? CURATED_THEME_ORDER.length) -
        (priority.get(b.id) ?? CURATED_THEME_ORDER.length),
    );
}

/** 단일 테마 조회. 테마 메타는 기본 코스 템플릿에서 만든다. */
export async function fetchTheme(db: Database, themeId: string): Promise<Theme | null> {
  const [template] = await db
    .select()
    .from(courseTemplates)
    .where(and(eq(courseTemplates.themeId, themeId), eq(courseTemplates.isDefault, true)))
    .orderBy(desc(courseTemplates.updatedAt))
    .limit(1);

  return template ? themeFromTemplate(template, await spotsByTheme(db, themeId)) : null;
}

/** themeId 의 기본 코스 템플릿을 Course 로 정규화한다. 없으면 null. */
export async function fetchDefaultCourseTemplate(
  db: Database,
  themeId: string,
): Promise<Course | null> {
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
    preserveStopOrder: CURATED_THEME_ORDER.includes(template.themeId) || undefined,
    altNote: template.altNoteKo
      ? L(template.altNoteKo, template.altNoteEn ?? undefined)
      : undefined,
    items,
  };
}

/** 코스 생성 후보 POI. DB 가 비어 있거나 해당 테마 후보가 없으면 빈 배열을 반환한다. */
export async function fetchSpotProfilesForTheme(db: Database, themeId: string): Promise<Spot[]> {
  const rows = await spotsByTheme(db, themeId);
  return rows.map(mapSpotProfile);
}

/** 전체 DB POI 후보 조회. */
export async function fetchSpotProfiles(db: Database): Promise<Spot[]> {
  const rows = await db.select().from(spotProfiles).orderBy(desc(spotProfiles.updatedAt));
  return rows.map(mapSpotProfile);
}

/** 단일 DB POI 후보 조회. 화면이 DB 전용 spot_id 를 렌더해야 할 때 사용한다. */
export async function fetchSpotProfile(db: Database, spotId: string): Promise<Spot | null> {
  const [row] = await db
    .select()
    .from(spotProfiles)
    .where(eq(spotProfiles.spotId, spotId))
    .limit(1);
  if (!row) return null;
  // 사용자에게 표시하는 별점·리뷰 수는 프로토타입 시드가 아닌 실제 앱 리뷰를 집계한다.
  const [feedback] = await db
    .select({ rating: avg(reviews.rating), reviewCount: count() })
    .from(reviews)
    .where(eq(reviews.spotId, spotId));
  return {
    ...mapSpotProfile(row),
    rating: Math.round(Number(feedback?.rating ?? 0) * 10) / 10,
    reviewCount: feedback?.reviewCount ?? 0,
  };
}

/** TourAPI 등에서 검증한 실제 대표 이미지를 DB 카탈로그에 저장한다. */
export async function saveSpotProfileImageUrl(
  db: Database,
  spotId: string,
  imageUrl: string,
): Promise<void> {
  await db
    .update(spotProfiles)
    .set({ imageUrl, updatedAt: new Date() })
    .where(eq(spotProfiles.spotId, spotId));
}

/** 관광지 검색은 DB에서 페이지 단위로 끝낸다. 외부 API 보강은 상세 조회에서만 수행한다. */
export async function searchSpotProfiles(
  db: Database,
  input: PlaceSearchQuery = {},
  localizedIds: string[] = [],
): Promise<PlaceSearchResult> {
  const query = normalizePlaceQuery(input);
  const text = sql`lower(replace(concat_ws(' ', ${spotProfiles.nameKo}, ${spotProfiles.nameEn}, ${spotProfiles.regionKo}, ${spotProfiles.typeKo}, ${spotProfiles.address}, ${spotProfiles.tagsKo}::text), ' ', ''))`;
  const terms = query.q.toLowerCase().split(/\s+/).filter(Boolean);
  const where = and(
    terms.length
      ? or(
          and(...terms.map((term) => sql`${text} like ${`%${escapeLike(term)}%`} escape '\\'`)),
          localizedIds.length ? inArray(spotProfiles.spotId, localizedIds) : undefined,
        )
      : undefined,
    query.region ? eq(spotProfiles.regionKo, query.region) : undefined,
    query.category ? eq(spotProfiles.category, query.category) : undefined,
    query.accessibility === "info" ? eq(spotProfiles.hasAccessibilityInfo, true) : undefined,
  );
  const [counts] = await db.select({ total: count() }).from(spotProfiles).where(where);
  const total = counts?.total ?? 0;
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / PLACE_PAGE_SIZE)));
  const phrase = query.q.toLowerCase().replace(/\s+/g, "");
  const title = sql`lower(replace(${spotProfiles.nameKo}, ' ', ''))`;
  const relevance = sql`case when ${title} = ${phrase} then 0 when ${title} like ${`%${escapeLike(phrase)}%`} escape '\\' then 1 else 2 end`;
  const rows = await db
    .select()
    .from(spotProfiles)
    .where(where)
    .orderBy(
      relevance,
      sql`case when ${spotProfiles.source} = 'seed' then 0 else 1 end`,
      sql`case when ${spotProfiles.imageUrl} is null then 1 else 0 end`,
      asc(spotProfiles.nameKo),
      asc(spotProfiles.spotId),
    )
    .limit(PLACE_PAGE_SIZE)
    .offset((page - 1) * PLACE_PAGE_SIZE);
  return {
    items: rows.map(mapSpotProfile),
    total,
    page,
    pageSize: PLACE_PAGE_SIZE,
    query: { ...query, page },
  };
}
