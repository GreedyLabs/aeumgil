// ─────────────────────────────────────────────
// Drizzle DB 클라이언트 (PostgreSQL / postgres-js) — 서버 전용.
//
// 이 모듈을 import 하는 곳은 server/auth.ts(=/api/auth 라우트)뿐이다. mock 화면은
// db 를 import 하지 않으므로, DATABASE_URL 없이도 일반 화면/`pnpm dev`(mock)는 정상.
// 단, auth 라우트가 컴파일되는 `pnpm build` 와 `/api/auth/*` 진입에는 DATABASE_URL 이 필요.
// postgres-js 연결은 지연(첫 쿼리 시) 수립되므로 import 자체가 DB 에 붙지는 않는다.
// 클라이언트에서 import 금지.
// ─────────────────────────────────────────────

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "@/lib/env";
import { schema } from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

// serverless/풀러 대비 prepare 비활성. 연결은 첫 쿼리 때 lazy 수립.
const client = postgres(requireEnv("DATABASE_URL"), { prepare: false });

export const db: Database = drizzle(client, { schema });
