// ─────────────────────────────────────────────
// 응답 캐시 (영속) — 서버 전용.
//
// 동적 공공 API 응답(날씨/대기질/관광 상세)을 짧은 TTL 로 캐시해 호출 폭주를 막는다.
// 기존엔 모듈 스코프 Map 이라 서버 재시작/콜드스타트 때 전부 소실됐다 →
// 메모리(핫) + 파일(영속) 2층 구조로 바꿔 프로세스 재시작 후에도 살아남게 한다.
//
//   - 읽기: 메모리 우선, 미스면 1회 로드한 파일 스냅샷에서 조회.
//   - 쓰기: 메모리 즉시 반영 + 디바운스 후 파일 flush(쓰기 폭주 방지).
//   - 만료: 엔트리는 value+at(생성시각)만 저장, 신선도 판단은 호출부 ttl 로.
//   - prune: flush 시 maxAge(기본 24h) 초과 엔트리 제거(파일 비대화 방지).
//
// store 를 주입 가능하게 두어(파일/메모리) 단위 테스트가 쉽다. Phase 4 에서 DB/Redis
// 백엔드로 교체해도 cached() 호출부는 그대로다.
//
// 주의: 파일 백엔드는 **단일 인스턴스 전제**다(운영-준비-플랜 §5.1). 다중 인스턴스가
// 같은 파일을 공유하면 각자의 flush 가 서로의 엔트리를 통째로 덮어쓴다(마지막 쓰기 승리,
// 파일 잠금 없음). 수평 확장 시엔 CacheStore 를 Redis/DB 구현으로 교체할 것(§9).
// ─────────────────────────────────────────────

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLogger } from "./log";

const log = createLogger("cache");

export interface CacheEntry {
  value: unknown;
  /** 생성 시각(ms epoch) */
  at: number;
}

/** 영속 백엔드 추상화 — 파일/메모리/DB 로 교체 가능. */
export interface CacheStore {
  load(): Promise<Record<string, CacheEntry>>;
  save(entries: Record<string, CacheEntry>): Promise<void>;
}

/** JSON 파일 백엔드(베스트 에포트 — 읽기/쓰기 실패해도 캐시 미스로만 처리). */
export function fileStore(filePath: string): CacheStore {
  return {
    async load() {
      try {
        const text = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(text) as unknown;
        return parsed && typeof parsed === "object" ? (parsed as Record<string, CacheEntry>) : {};
      } catch {
        return {};
      }
    },
    async save(entries) {
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(entries), "utf8");
      } catch {
        /* 영속 실패는 무시(메모리 캐시는 계속 동작) */
      }
    },
  };
}

export interface PersistentCache {
  /** key 가 ttlMs 내 신선하면 캐시값, 아니면 fn() 실행 후 저장. */
  cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
  /** 대기 중인 변경을 즉시 파일에 기록(테스트·종료 훅용). */
  flush(): Promise<void>;
  /** 현재 상태(헬스체크·§5.1 재배포 후 캐시 생존 확인용). loaded=파일 스냅샷 병합 완료 여부. */
  stats(): { entries: number; loaded: boolean };
}

export interface CacheOptions {
  /** flush 디바운스(ms). 기본 2000 */
  flushDelayMs?: number;
  /** 영속 보관 최대 수명(ms). 초과 엔트리는 flush 시 제거. 기본 24h */
  maxAgeMs?: number;
  /** 실패한 원천에 재요청하기 전 대기 시간. 기본 0(비활성). */
  failureCooldownMs?: number;
}

export function createCache(store: CacheStore, opts: CacheOptions = {}): PersistentCache {
  const flushDelayMs = opts.flushDelayMs ?? 2000;
  const maxAgeMs = opts.maxAgeMs ?? 24 * 60 * 60 * 1000;

  const mem = new Map<string, CacheEntry>();
  const failures = new Map<string, { at: number; error: unknown }>();
  const inflight = new Map<string, Promise<unknown>>();
  let loaded = false;
  let loading: Promise<void> | null = null;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function ensureLoaded(): Promise<void> {
    if (loaded) return;
    if (!loading) {
      loading = store
        .load()
        .then((data) => {
          // 파일 스냅샷을 메모리에 병합(이미 있는 키는 최신 메모리 우선).
          let n = 0;
          for (const [k, e] of Object.entries(data)) {
            if (e && typeof e.at === "number" && Number.isFinite(e.at) && Date.now() >= e.at && Date.now() - e.at <= maxAgeMs && !mem.has(k)) {
              mem.set(k, e); n++;
            }
          }
          if (n > 0) log.log(`LOAD ${n} entries from store`);
        })
        .catch(() => {})
        .finally(() => {
          loaded = true;
        });
    }
    await loading;
  }

  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!dirty) return;
    dirty = false;
    const now = Date.now();
    const obj: Record<string, CacheEntry> = {};
    let pruned = 0;
    for (const [k, e] of mem) {
      if (now - e.at <= maxAgeMs) obj[k] = e;
      else {
        mem.delete(k); // 메모리에서도 만료 제거
        pruned++;
      }
    }
    await store.save(obj);
    log.log(`FLUSH ${Object.keys(obj).length} saved${pruned ? `, ${pruned} pruned` : ""}`);
  }

  function scheduleFlush(): void {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, flushDelayMs);
    // 타이머가 프로세스 종료를 막지 않도록.
    (timer as { unref?: () => void }).unref?.();
  }

  async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    await ensureLoaded();
    const hit = mem.get(key);
    if (hit && Date.now() >= hit.at && Date.now() - hit.at < ttlMs) {
      if (log.on) log.log(`HIT  ${key} (age ${Math.round((Date.now() - hit.at) / 1000)}s)`);
      return hit.value as T;
    }
    const failure = failures.get(key);
    if (failure && Date.now() >= failure.at && Date.now() - failure.at < (opts.failureCooldownMs ?? 0)) throw failure.error;
    failures.delete(key);
    if (log.on) log.log(`MISS ${key}${hit ? " (stale)" : ""} → fetch`);
    const pending = inflight.get(key);
    if (pending) {
      if (log.on) log.log(`WAIT ${key} (in-flight)`);
      return pending as Promise<T>;
    }

    const pendingFetch = fn()
      .then((value) => {
        mem.set(key, { value, at: Date.now() });
        if (log.on) log.log(`SET  ${key} (ttl ${Math.round(ttlMs / 1000)}s)`);
        scheduleFlush();
        return value;
      })
      .catch((error: unknown) => {
        if (opts.failureCooldownMs) {
          if (failures.size >= 1000) failures.delete(failures.keys().next().value!);
          failures.set(key, { at: Date.now(), error });
        }
        throw error;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, pendingFetch);
    return pendingFetch;
  }

  return { cached, flush, stats: () => ({ entries: mem.size, loaded }) };
}

/** 기본 파일 경로 — EUMGIL_CACHE_DIR 또는 OS 임시 디렉터리. */
export function defaultCachePath(): string {
  const dir = process.env.EUMGIL_CACHE_DIR || path.join(os.tmpdir(), "eumgil-cache");
  return path.join(dir, "api-cache.json");
}

/** 앱 공용 싱글턴 캐시(파일 백엔드). */
export const apiCache: PersistentCache = createCache(fileStore(defaultCachePath()), { failureCooldownMs: 30_000 });
