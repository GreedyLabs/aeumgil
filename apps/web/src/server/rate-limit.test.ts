// 토큰버킷 레이트리미터 테스트 — 운영-준비-플랜 §3.1
// 시간은 now 주입으로 고정해 결정적으로 검증한다.

import { describe, expect, it } from "vitest";
import { createTokenBucket } from "./rate-limit";

function fixedClock(startMs = 0) {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("createTokenBucket", () => {
  it("용량만큼 버스트를 허용하고 그 다음은 거부한다", () => {
    const clock = fixedClock();
    const limiter = createTokenBucket({ capacity: 3, refillPerMinute: 3, now: clock.now });

    expect(limiter.take("ip-a")).toBe(true);
    expect(limiter.take("ip-a")).toBe(true);
    expect(limiter.take("ip-a")).toBe(true);
    expect(limiter.take("ip-a")).toBe(false);
  });

  it("키가 다르면 버킷이 분리된다", () => {
    const clock = fixedClock();
    const limiter = createTokenBucket({ capacity: 1, refillPerMinute: 1, now: clock.now });

    expect(limiter.take("ip-a")).toBe(true);
    expect(limiter.take("ip-a")).toBe(false);
    expect(limiter.take("ip-b")).toBe(true);
  });

  it("시간이 지나면 분당 재충전율만큼 다시 허용한다", () => {
    const clock = fixedClock();
    const limiter = createTokenBucket({ capacity: 2, refillPerMinute: 2, now: clock.now });

    expect(limiter.take("ip-a")).toBe(true);
    expect(limiter.take("ip-a")).toBe(true);
    expect(limiter.take("ip-a")).toBe(false);

    clock.advance(30_000); // 30s → 토큰 1개 재충전
    expect(limiter.take("ip-a")).toBe(true);
    expect(limiter.take("ip-a")).toBe(false);
  });

  it("재충전은 용량을 넘지 않는다", () => {
    const clock = fixedClock();
    const limiter = createTokenBucket({ capacity: 2, refillPerMinute: 60, now: clock.now });

    expect(limiter.take("ip-a")).toBe(true);
    clock.advance(10 * 60_000); // 충분히 오래 대기해도 상한은 capacity
    expect(limiter.take("ip-a")).toBe(true);
    expect(limiter.take("ip-a")).toBe(true);
    expect(limiter.take("ip-a")).toBe(false);
  });
});
