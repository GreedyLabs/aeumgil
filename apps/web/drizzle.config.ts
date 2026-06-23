// Drizzle Kit 설정 — 마이그레이션 생성/적용/스튜디오.
// 사용: pnpm --filter @eumgil/web db:push   (개발 빠른 동기화)
//       pnpm --filter @eumgil/web db:generate && db:migrate  (마이그레이션 파일 기반)
//
// .env 는 모노레포 루트에 있으므로 dotenv 로 명시 로드한다.
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../.env" });

const schemaName = (process.env.DATABASE_SCHEMA || "public").trim();

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // public 이 아니면 해당 스키마만 introspect/diff 대상으로 한정.
  schemaFilter: [schemaName],
});
