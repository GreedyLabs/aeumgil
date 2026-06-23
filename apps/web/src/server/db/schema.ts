// ─────────────────────────────────────────────
// Drizzle 스키마 (PostgreSQL) — Phase 4.
//
// 두 묶음:
//   1) Auth.js(NextAuth v5) 표준 테이블 — @auth/drizzle-adapter 가 요구하는 컬럼 형태.
//      user / account / session / verificationToken (명칭·컬럼명을 어댑터 규약에 맞춤)
//   2) 앱 도메인 테이블 — saved_theme / review / visit (현재 mock 상태를 영속화할 대상)
//
// 이번 슬라이스는 "스키마 정의 + 마이그레이션 가능" 까지. 실제 읽기/쓰기(Repository
// 연결)는 다음 슬라이스. 도메인 타입(domain/types.ts)과 1:1 대응되도록 컬럼을 잡았다.
// ─────────────────────────────────────────────

import { integer, pgSchema, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// 대상 스키마: DATABASE_SCHEMA(없거나 "public" 이면 기본 public).
// public 이 아니면 pgSchema(name).table 로 해당 스키마에 정의한다.
const SCHEMA_NAME = process.env.DATABASE_SCHEMA?.trim();
const appSchema = SCHEMA_NAME && SCHEMA_NAME !== "public" ? pgSchema(SCHEMA_NAME) : undefined;
/** public 이면 pgTable, 그 외엔 해당 스키마의 table 빌더(시그니처 동일). */
const table: typeof pgTable = appSchema ? (appSchema.table.bind(appSchema) as typeof pgTable) : pgTable;

// ── 1) Auth.js 표준 테이블 ─────────────────────
export const users = table("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = table(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = table("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = table(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ── 2) 앱 도메인 테이블 ────────────────────────
/** 저장한 테마 (themeId 는 큐레이션 코드값, FK 아님) */
export const savedThemes = table(
  "saved_theme",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  spotId: text("spot_id").notNull(),
  visitedAt: timestamp("visited_at", { mode: "date" }).notNull().defaultNow(),
  /** 방문 시점 혼잡 등급 스냅샷(calm/moderate/busy) */
  congestionThen: text("congestion_then"),
});

export const schema = { users, accounts, sessions, verificationTokens, savedThemes, reviews, visits };
