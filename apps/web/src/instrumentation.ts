// ─────────────────────────────────────────────
// Next.js instrumentation — 서버 프로세스 기동 시 1회 실행된다.
// ① 운영 런타임에서 필수 환경변수(인증 시크릿 등)가 빠진 채
//    개발용 폴백으로 서비스가 뜨는 사고를 부팅 시점에 차단한다. (운영-준비-플랜 §1.1)
// ② 실시간 캐시(wx:*/air:*) 백그라운드 워밍 — 재배포 직후 콜드 캐시 완화. (§2.3)
// ─────────────────────────────────────────────

export async function register(): Promise<void> {
  // edge 런타임에서는 서버 전용 env 모듈을 로드하지 않는다.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionEnv, isProductionRuntime, env } = await import("@/lib/env");
    assertProductionEnv();

    // 워밍은 운영 런타임에서만 기본 실행(dev 재시작마다 공공 API 쿼터를 쓰지 않게).
    // 로컬 검증은 EUMGIL_WARMUP=1 로 켠다. await 하지 않아 기동을 막지 않는다.
    if (isProductionRuntime || env.EUMGIL_WARMUP === "1") {
      const { warmupRealtimeCaches } = await import("@/server/warmup");
      void warmupRealtimeCaches();
    }
  }
}
