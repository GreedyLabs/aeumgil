// ─────────────────────────────────────────────
// Repository 팩토리
//
// 화면·로직은 getRepository() 만 호출한다.
// 제출/운영 경로는 항상 DB+실데이터 Repository 를 사용한다.
// ─────────────────────────────────────────────

import type { Repository } from "@/domain/repository";
import { createLogger } from "@/server/log";
import { LiveRepository } from "./live/repository";

const log = createLogger("repo");
let instance: Repository | null = null;

export function getRepository(): Repository {
  if (instance) return instance;
  log.log("active repository = live");
  instance = new LiveRepository();
  return instance;
}
