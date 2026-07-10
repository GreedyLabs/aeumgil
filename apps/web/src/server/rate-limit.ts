// ─────────────────────────────────────────────
// 인메모리 토큰버킷 레이트리미터 (서버 전용) — 운영-준비-플랜 §3.1
//
// 목적: LLM/에이전트·공공 API 같은 고비용 경로의 IP당 호출량 제한.
// 초과 시 요청을 거부(429)하는 게 아니라, 호출부가 저비용(결정형) 경로로
// 내려가게 한다 — 서비스 응답은 항상 200 을 유지한다.
//
// 단일 인스턴스 전제(현 배포 구조). 다중 인스턴스로 확장하면 인스턴스 수만큼
// 상한이 늘어나므로 Redis 등 공유 스토어로 교체할 것.
// ─────────────────────────────────────────────

export interface TokenBucketOptions {
  /** 버킷 최대 토큰 = 순간 버스트 허용량 */
  capacity: number;
  /** 분당 재충전 토큰 수 = 지속 허용률 */
  refillPerMinute: number;
  /** 시간 주입(테스트용). 기본 Date.now */
  now?: () => number;
}

export interface RateLimiter {
  /** key 버킷에서 토큰 1개 소모 시도. 성공 true / 소진 false. */
  take(key: string): boolean;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** 항목이 이 이상 커지면 가득 찬(=유휴) 버킷부터 정리한다. */
const SWEEP_THRESHOLD = 10_000;

export function createTokenBucket(opts: TokenBucketOptions): RateLimiter {
  const now = opts.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  function refill(bucket: Bucket, at: number): void {
    const elapsedMin = (at - bucket.updatedAt) / 60_000;
    if (elapsedMin <= 0) return;
    bucket.tokens = Math.min(opts.capacity, bucket.tokens + elapsedMin * opts.refillPerMinute);
    bucket.updatedAt = at;
  }

  function sweep(at: number): void {
    if (buckets.size < SWEEP_THRESHOLD) return;
    for (const [key, bucket] of buckets) {
      refill(bucket, at);
      if (bucket.tokens >= opts.capacity) buckets.delete(key);
    }
  }

  return {
    take(key: string): boolean {
      const at = now();
      sweep(at);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { tokens: opts.capacity, updatedAt: at };
        buckets.set(key, bucket);
      } else {
        refill(bucket, at);
      }
      if (bucket.tokens < 1) return false;
      bucket.tokens -= 1;
      return true;
    },
  };
}

/**
 * 현재 요청의 클라이언트 식별 키(IP). 리버스 프록시 뒤이므로 x-forwarded-for 우선.
 * 요청 컨텍스트 밖(테스트·스크립트)에서는 "local" 로 묶인다.
 */
export async function requestClientKey(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
    return h.get("x-real-ip") ?? "local";
  } catch {
    return "local";
  }
}

/** 에이전트(LLM) 매칭 경로 공용 리미터 — IP당 분당 10회, 버스트 10회. */
export const agentMatchLimiter = createTokenBucket({ capacity: 10, refillPerMinute: 10 });
