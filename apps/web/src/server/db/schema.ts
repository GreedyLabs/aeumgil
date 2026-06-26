// ─────────────────────────────────────────────
// Drizzle 스키마 (PostgreSQL) — Phase 4.
//
// Keycloak 전환 후 앱 DB 는 인증 원장을 갖지 않는다.
// - 사용자/세션/소셜 계정/권한: Keycloak DB 의 책임.
// - 에움길 서비스 데이터: 이 스키마의 saved_theme / review / visit 에 저장.
// - user_id 는 Keycloak 토큰의 `sub` 클레임(문자열)이다. 외부 IdP 사용자라 FK 를 걸지 않는다.
//
// [학습 메모] 중앙 SSO 를 쓰면 각 서비스 DB 는 인증 테이블을 중복하지 않고, IdP 가 발급한
// 안정적인 subject 를 외래 사용자 식별자로 보관한다. 이 방식이 여러 서비스 운영에 유리하다.
// ─────────────────────────────────────────────

import { integer, pgSchema, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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

export const schema = { savedThemes, reviews, visits };
