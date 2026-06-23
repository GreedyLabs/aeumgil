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
import { createLogger } from "@/server/log";
import { MockRepository } from "./mock/repository";
import { LiveRepository } from "./live/repository";

const log = createLogger("repo");
let instance: Repository | null = null;

export function getRepository(): Repository {
  if (instance) return instance;

  log.log(`active DATA_SOURCE = ${env.DATA_SOURCE}`);
  switch (env.DATA_SOURCE) {
    case "live":
      // 정적 큐레이션은 mock 상속, 관광지는 공공 API(기상청/에어코리아/TourAPI)로 보강.
      // 외부 호출 실패 시 스팟 단위로 mock 폴백하므로 화면은 무중단.
      instance = new LiveRepository();
      break;
    case "mock":
    default:
      instance = new MockRepository();
      break;
  }

  return instance;
}
