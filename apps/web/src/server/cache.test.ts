// 영속 캐시 단위 테스트 — TTL 신선도·만료·영속(인스턴스 간)·prune.
// 파일 대신 주입식 메모리 store 로 검증한다.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createCache, type CacheEntry, type CacheStore } from "./cache";

function memStore() {
  let data: Record<string, CacheEntry> = {};
  const store: CacheStore = {
    async load() {
      return JSON.parse(JSON.stringify(data));
    },
    async save(entries) {
      data = JSON.parse(JSON.stringify(entries));
    },
  };
  return { store, saved: () => data };
}

afterEach(() => vi.useRealTimers());

describe("PersistentCache", () => {
  it("TTL 내에는 캐시값을 주고 fn 을 재실행하지 않는다", async () => {
    const { store } = memStore();
    const c = createCache(store);
    let calls = 0;
    const fn = async () => ++calls;

    expect(await c.cached("k", 1000, fn)).toBe(1);
    expect(await c.cached("k", 1000, fn)).toBe(1);
    expect(calls).toBe(1);
  });

  it("같은 key 의 동시 MISS 는 하나의 fetch Promise 를 공유한다", async () => {
    const { store } = memStore();
    const c = createCache(store);
    let calls = 0;
    const fn = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "ok";
    };

    const [a, b, c3] = await Promise.all([
      c.cached("k", 1000, fn),
      c.cached("k", 1000, fn),
      c.cached("k", 1000, fn),
    ]);

    expect([a, b, c3]).toEqual(["ok", "ok", "ok"]);
    expect(calls).toBe(1);
  });

  it("TTL 초과 후에는 fn 을 다시 실행한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { store } = memStore();
    const c = createCache(store);
    let calls = 0;
    const fn = async () => ++calls;

    await c.cached("k", 1000, fn);
    vi.setSystemTime(1500); // ttl 초과
    await c.cached("k", 1000, fn);
    expect(calls).toBe(2);
  });

  it("flush 후 같은 store 의 새 인스턴스가 캐시를 이어받는다(영속)", async () => {
    const { store } = memStore();
    const c1 = createCache(store);
    await c1.cached("k", 100_000, async () => "v1");
    await c1.flush();

    const c2 = createCache(store);
    let called = false;
    const got = await c2.cached("k", 100_000, async () => {
      called = true;
      return "v2";
    });
    expect(got).toBe("v1"); // 파일 스냅샷에서 로드 → fn 미실행
    expect(called).toBe(false);
  });

  it("flush 시 maxAge 초과 엔트리를 제거한다(prune)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { store, saved } = memStore();
    const c = createCache(store, { maxAgeMs: 1000 });

    await c.cached("old", 100_000, async () => "x"); // at=0
    vi.setSystemTime(2000); // old 는 maxAge 초과
    await c.cached("new", 100_000, async () => "y"); // at=2000
    await c.flush();

    const data = saved();
    expect(data["old"]).toBeUndefined();
    expect(data["new"]).toBeDefined();
  });

  it("store.load 실패는 캐시 미스로만 처리한다(회복력)", async () => {
    const store: CacheStore = {
      async load() {
        throw new Error("disk error");
      },
      async save() {},
    };
    const c = createCache(store);
    const got = await c.cached("k", 1000, async () => "ok");
    expect(got).toBe("ok");
  });
});
