// ─────────────────────────────────────────────
// 디버그 로거 (서버 전용) — 데이터 출처 추적용.
//
// 데이터가 어디서 왔는지(DB / 실 API 호출 / 캐시 히트 / DB 기본값 유지)를 콘솔에 남겨
// 라이브 연동을 눈으로 디버깅한다. log 는 기본 침묵 — 환경변수로 켠다.
// warn/error 는 항상 출력한다(운영 폴백 관측용, 운영-준비-플랜 §5.3).
//
//   EUMGIL_DEBUG=1            모든 네임스페이스 출력
//   EUMGIL_DEBUG=http,cache   특정 네임스페이스만 (쉼표 구분)
//
// 네임스페이스: http(공공 API 호출) · cache(캐시 히트/미스) · repo(보강 출처)
// 출력 예:
//   [eumgil:http]  ⤳ getVilageFcst {nx:92, ny:131}
//   [eumgil:http]  ✓ getVilageFcst 200 (142ms)
//   [eumgil:cache] HIT  air:sokcho (age 12s)
//   [eumgil:cache] MISS wx:dongmyeong-port → SET (ttl 600s)
//   [eumgil:repo]  enrich dongmyeong-port → live (wx✓ air✓ tour✓) congestion=calm suit=100
//   [eumgil:repo]  enrich xyz → mock (no mapping)
// ─────────────────────────────────────────────

const RAW = (process.env.EUMGIL_DEBUG ?? "").trim();
const ALL = ["1", "true", "all", "*", "on"].includes(RAW.toLowerCase());
const ALLOW = RAW.split(",").map((s) => s.trim()).filter(Boolean);

function nsEnabled(ns: string): boolean {
  if (!RAW) return false;
  if (ALL) return true;
  return ALLOW.includes(ns);
}

export interface Logger {
  /** 이 네임스페이스가 켜져 있는지 (비싼 로그 문자열 생성을 건너뛸 때 사용) */
  readonly on: boolean;
  log(message: string, ...rest: unknown[]): void;
  warn(message: string, ...rest: unknown[]): void;
  error(message: string, ...rest: unknown[]): void;
  /** 경과시간 측정 시작 → 호출 시 경과 ms 반환 */
  timer(): () => number;
}

export function createLogger(ns: string): Logger {
  const on = nsEnabled(ns);
  const tag = `[eumgil:${ns}]`;
  return {
    on,
    log: on ? (m, ...r) => console.log(tag, m, ...r) : () => {},
    // warn/error 는 EUMGIL_DEBUG 와 무관하게 항상 출력(§5.3) — 운영에서 조용한 폴백
    // (enrich 실패→DB 기본값, 에이전트→결정형)이 로그 없이 지속되는 것을 막는다.
    warn: (m, ...r) => console.warn(tag, m, ...r),
    error: (m, ...r) => console.error(tag, m, ...r),
    timer: () => {
      const start = Date.now();
      return () => Date.now() - start;
    },
  };
}
