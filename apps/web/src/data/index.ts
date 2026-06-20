// ─────────────────────────────────────────────
// Repository 팩토리
//
// 화면·로직은 getRepository() 만 호출한다.
// DATA_SOURCE 환경변수로 구현을 전환한다.
//   "mock" (기본) → MockRepository
//   "live"        → 실데이터 구현 (Phase 2+ 추가 예정)
// ─────────────────────────────────────────────

import { env } from "@/lib/env";
import type { Repository } from "@/domain/repository";
import { MockRepository } from "./mock/repository";

let instance: Repository | null = null;

export function getRepository(): Repository {
  if (instance) return instance;

  switch (env.DATA_SOURCE) {
    case "live":
      // TODO(Phase 2): 공공 API + DB 기반 LiveRepository 로 교체.
      // 아직 미구현이므로 안전하게 mock 으로 폴백한다.
      instance = new MockRepository();
      break;
    case "mock":
    default:
      instance = new MockRepository();
      break;
  }

  return instance;
}
