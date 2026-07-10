// ─────────────────────────────────────────────
// Next.js instrumentation — 서버 프로세스 기동 시 1회 실행된다.
// 운영 런타임에서 필수 환경변수(인증 시크릿 등)가 빠진 채
// 개발용 폴백으로 서비스가 뜨는 사고를 부팅 시점에 차단한다. (운영-준비-플랜 §1.1)
// ─────────────────────────────────────────────

export async function register(): Promise<void> {
  // edge 런타임에서는 서버 전용 env 모듈을 로드하지 않는다.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionEnv } = await import("@/lib/env");
    assertProductionEnv();
  }
}
