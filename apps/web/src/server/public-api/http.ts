// ─────────────────────────────────────────────
// 공공데이터포털(data.go.kr) 공통 fetch 헬퍼 — 서버 전용.
//
// 클라이언트에서 import 금지 (서비스키 노출 방지). Route Handler / Server Component /
// 서버 액션에서만 호출한다.
//
// 키 주의: 포털 발급 키는 Encoding/Decoding 2종. .env 에는 Decoding(원본) 키를 넣고,
// 여기서 URLSearchParams 로 한 번만 인코딩한다. (Encoding 키를 넣으면 이중 인코딩되어 실패)
// ─────────────────────────────────────────────

export class PublicApiError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

export interface CallOptions {
  serviceKey: string;
  /** 타임아웃(ms). 기본 8초 */
  timeoutMs?: number;
}

/**
 * data.go.kr 계열 OpenAPI 를 호출하고 JSON 으로 파싱한다.
 *
 * @param endpoint  오퍼레이션까지 포함한 전체 URL (예: `${BASE}/areaBasedList2`)
 * @param params    serviceKey 를 제외한 쿼리 파라미터 (포맷 파라미터는 각 클라이언트가 지정)
 */
export async function callDataGoKr<T = unknown>(
  endpoint: string,
  params: Record<string, string | number>,
  opts: CallOptions,
): Promise<T> {
  const url = new URL(endpoint);
  // serviceKey 는 Decoding(원본) 기준 — URLSearchParams 가 한 번 인코딩.
  url.searchParams.set("serviceKey", opts.serviceKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
  } catch (e) {
    const reason = e instanceof Error && e.name === "AbortError" ? "타임아웃" : "네트워크 오류";
    throw new PublicApiError(`공공API 요청 실패 (${reason})`, endpoint);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new PublicApiError(`공공API HTTP ${res.status}`, text.slice(0, 300));
  }

  // 키 오류 등은 JSON 을 요청해도 XML 에러 봉투로 오는 경우가 있다.
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<")) {
    const msg = /<returnAuthMsg>(.*?)<\/returnAuthMsg>/.exec(trimmed)?.[1];
    const code = /<returnReasonCode>(.*?)<\/returnReasonCode>/.exec(trimmed)?.[1];
    throw new PublicApiError(
      `공공API 오류 응답${msg ? ` (${msg}${code ? ` / ${code}` : ""})` : ""}`,
      trimmed.slice(0, 300),
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PublicApiError("공공API 응답 파싱 실패(JSON 아님)", text.slice(0, 300));
  }
}
