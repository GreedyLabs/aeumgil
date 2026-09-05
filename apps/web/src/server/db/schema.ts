// ─────────────────────────────────────────────
// Drizzle 스키마 (PostgreSQL) — Phase 4.
//
// Keycloak 전환 후 앱 DB 는 인증 원장을 갖지 않는다.
// - 사용자/세션/소셜 계정/권한: Keycloak DB 의 책임.
// - 에움길 서비스 데이터: 이 스키마의 saved_theme / review / visit / onboarding_preference / user_profile 에 저장.
// - user_id 는 Keycloak 토큰의 `sub` 클레임(문자열)이다. 외부 IdP 사용자라 FK 를 걸지 않는다.
//
// [학습 메모] 중앙 SSO 를 쓰면 각 서비스 DB 는 인증 테이블을 중복하지 않고, IdP 가 발급한
// 안정적인 subject 를 외래 사용자 식별자로 보관한다. 이 방식이 여러 서비스 운영에 유리하다.
// ─────────────────────────────────────────────

import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// 대상 스키마: DATABASE_SCHEMA(없거나 "public" 이면 기본 public).
// public 이 아니면 pgSchema(name).table 로 해당 스키마에 정의한다.
const SCHEMA_NAME = process.env.DATABASE_SCHEMA?.trim();
const appSchema = SCHEMA_NAME && SCHEMA_NAME !== "public" ? pgSchema(SCHEMA_NAME) : undefined;
/** public 이면 pgTable, 그 외엔 해당 스키마의 table 빌더(시그니처 동일). */
const table: typeof pgTable = appSchema
  ? (appSchema.table.bind(appSchema) as unknown as typeof pgTable)
  : pgTable;

/** 저장한 테마 (themeId 는 큐레이션 코드값, FK 아님) */
export const savedThemes = table(
  "saved_theme",
  {
    /** Keycloak user subject(sub) */
    userId: text("user_id").notNull(),
    themeId: text("theme_id").notNull(),
    savedAt: timestamp("saved_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.themeId] })],
);

/** 리뷰 — domain Review 대응(text/helpful/rating/date) */
export const reviews = table("review", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /** Keycloak user subject(sub) */
  userId: text("user_id").notNull(),
  spotId: text("spot_id").notNull(),
  rating: integer("rating").notNull(),
  text: text("text").notNull(),
  helpful: integer("helpful").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/** 방문 기록 — domain Visit 대응(spotId/date/congestionThen) */
export const visits = table("visit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /** Keycloak user subject(sub) */
  userId: text("user_id").notNull(),
  spotId: text("spot_id").notNull(),
  visitedAt: timestamp("visited_at", { mode: "date" }).notNull().defaultNow(),
  /** 방문 시점 혼잡 등급 스냅샷(calm/moderate/busy) */
  congestionThen: text("congestion_then"),
});

/** 온보딩 선호 — 사용자별 최신 선호 1행. 추천 개인화 입력으로 사용한다. */
export const onboardingPreferences = table("onboarding_preference", {
  /** Keycloak user subject(sub) */
  userId: text("user_id").primaryKey(),
  /** 관심 테마 id 목록. 큐레이션 코드값이라 FK 는 걸지 않는다. */
  interestThemeIds: jsonb("interest_theme_ids").$type<string[]>().notNull(),
  paceId: text("pace_id").notNull(),
  companionId: text("companion_id").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/** 앱 프로필 — Keycloak 신원 위에 얹는 서비스 표시 정보. */
export const userProfiles = table("user_profile", {
  /** Keycloak user subject(sub) */
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * 관광지 생성 후보 프로필.
 *
 * TourAPI 등 외부 원천에서 가져온 POI를 앱의 코스 생성 엔진이 쓸 수 있게 보강한 테이블이다.
 * spot_id 는 큐레이션/외부 contentId/내부 slug 중 하나로 정규화된 앱 식별자이며, FK 는 걸지 않는다.
 */
export const spotProfiles = table("spot_profile", {
  hasAccessibilityInfo: boolean("has_accessibility_info").notNull().default(false),
  address: text("address"),
  category: text("category").notNull().default("other"),
  spotId: text("spot_id").primaryKey(),
  nameKo: text("name_ko").notNull(),
  nameEn: text("name_en"),
  typeKo: text("type_ko").notNull(),
  typeEn: text("type_en"),
  regionKo: text("region_ko").notNull(),
  regionEn: text("region_en"),
  themeIds: jsonb("theme_ids").$type<string[]>().notNull().default([]),
  tagsKo: jsonb("tags_ko").$type<string[]>().notNull().default([]),
  tagsEn: jsonb("tags_en").$type<string[]>().notNull().default([]),
  baselineCongestion: text("baseline_congestion").notNull().default("moderate"),
  suitability: integer("suitability").notNull().default(70),
  rating: doublePrecision("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  defaultDurationMin: integer("default_duration_min").notNull().default(60),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  env: text("env").notNull().default("inland"),
  source: text("source").notNull().default("seed"),
  sourceContentId: text("source_content_id"),
  imageUrl: text("image_url"),
  /**
   * 큐레이션 스팟 개요(정적). contentId 가 있으면 런타임에 TourAPI 개요가 우선하고,
   * 없으면(§4.4 4건 등) 이 값이 상세 화면 설명으로 노출된다. 정본은 design/data.ts 의
   * desc_ko/desc_en → 시드가 채운다(image_url 과 달리 재시드 시 갱신).
   */
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * 식사(eat)/숙박(stay) 후보 프로필 — TourAPI(contentTypeId 39 음식점 / 32 숙박) 수집분.
 *
 * 수집: scripts/collect-commerce.mjs (`pnpm db:collect:commerce`) — 멱등 upsert 라
 * 지금은 수동 실행, 추후 별도 배치 프로세스에서 주기 실행으로 이관 가능하다.
 * id 는 `${kind}-${contentId}` 앱 식별자. region_ko 는 REGIONS 권역명("강릉" 등)과
 * 일치시켜 composeCourse.pickByRegion 의 스팟 권역 매칭 기준으로 쓴다. FK 없음.
 */
export const commerceProfiles = table("commerce_profile", {
  id: text("id").primaryKey(),
  /** "eat" | "stay" */
  kind: text("kind").notNull(),
  nameKo: text("name_ko").notNull(),
  nameEn: text("name_en"),
  typeKo: text("type_ko").notNull(),
  typeEn: text("type_en"),
  regionKo: text("region_ko").notNull(),
  regionEn: text("region_en"),
  /** 가격 표기(예: "₩₩", "₩190,000/박"). 원천에 없으면 빈 문자열 — 화면에서 생략. */
  priceKo: text("price_ko").notNull().default(""),
  priceEn: text("price_en"),
  /** 원천에 평점이 없으면 0 — 화면에서 생략, pickByRegion 정렬에서 동순위. */
  rating: doublePrecision("rating").notNull().default(0),
  addr: text("addr"),
  tel: text("tel"),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  imageUrl: text("image_url"),
  source: text("source").notNull().default("tourapi"),
  sourceContentId: text("source_content_id"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/** 코스 템플릿 헤더 — 시간 슬롯과 제목을 제공하고, 실제 후보 조합은 composeCourse 가 수행한다. */
export const courseTemplates = table("course_template", {
  id: text("id").primaryKey(),
  themeId: text("theme_id").notNull(),
  titleKo: text("title_ko").notNull(),
  titleEn: text("title_en"),
  dayCount: integer("day_count").notNull(),
  altNoteKo: text("alt_note_ko"),
  altNoteEn: text("alt_note_en"),
  isDefault: boolean("is_default").notNull().default(true),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/** 코스 템플릿 항목 — kind/ref_id 는 앱 도메인 id 이며, composer 가 필요 시 교체한다. */
export const courseTemplateItems = table(
  "course_template_item",
  {
    templateId: text("template_id").notNull(),
    seq: integer("seq").notNull(),
    kind: text("kind").notNull(),
    day: integer("day").notNull(),
    time: text("time").notNull(),
    refId: text("ref_id").notNull(),
    durationMin: integer("duration_min"),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.seq] })],
);

export const personalCourses = table("personal_course", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  note: text("note").notNull().default(""),
  transport: text("transport").$type<"car" | "transit" | "walk">().notNull().default("car"),
  startTime: text("start_time").notNull().default("09:30"),
  dayStartTimes: jsonb("day_start_times").$type<Record<string, string>>().notNull().default({}),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  items: jsonb("items").$type<import("@/domain/personal-course").PersonalCourseItem[]>().notNull(),
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  personalCourses,
  savedThemes,
  reviews,
  visits,
  onboardingPreferences,
  userProfiles,
  spotProfiles,
  commerceProfiles,
  courseTemplates,
  courseTemplateItems,
};
