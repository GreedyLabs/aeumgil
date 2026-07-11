// ─────────────────────────────────────────────
// 헬스체크 (운영-준비-플랜 §5.2)
//
//   GET /api/health          → 프로세스 생존만 확인. 항상 200 {ok:true}.
//   GET /api/health?deep=1   → DB `select 1` + 캐시 상태 포함. DB 실패 시 503.
//
// 공공 API 는 의도적으로 검사하지 않는다 — 외부 장애가 헬스 실패로 번지면
// 배포 시스템이 멀쩡한 컨테이너를 재시작하는 오탐이 되기 때문.
// ─────────────────────────────────────────────

import { sql } from "drizzle-orm";
import { apiCache } from "@/server/cache";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  if (!deep) return Response.json({ ok: true });

  let dbOk = false;
  let dbError: string | undefined;
  try {
    const db = getDb();
    if (!db) throw new Error("DATABASE_URL 미설정");
    await db.execute(sql`select 1`); // connect_timeout 5s(db/index.ts)가 대기 상한
    dbOk = true;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return Response.json(
    { ok: dbOk, db: dbOk ? "ok" : { error: dbError }, cache: apiCache.stats() },
    { status: dbOk ? 200 : 503 },
  );
}
