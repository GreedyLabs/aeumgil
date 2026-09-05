import { afterEach, describe, expect, it, vi } from "vitest";
import { callDataGoKr } from "./http";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const call = (timeoutMs = 100) => callDataGoKr("https://apis.data.go.kr/test", {}, { serviceKey: "test", timeoutMs });
describe("공공 API 오류와 타임아웃", () => {
  it("HTTP 200의 업무 오류도 실패로 처리한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ response: { header: { resultCode: "30" } } }))));
    await expect(call()).rejects.toThrow("응답 오류 (30)");
  });
  it("XML 인증 오류를 감지한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<OpenAPI_ServiceResponse><returnAuthMsg>DENIED</returnAuthMsg></OpenAPI_ServiceResponse>")));
    await expect(call()).rejects.toThrow("DENIED");
  });
  it("헤더 수신 후 본문이 멈춰도 제한 시간에 종료한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => ({ ok: true, status: 200, text: () => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }) })));
    await expect(call(15)).rejects.toThrow("타임아웃");
  });
  it("서비스 키는 한 번만 인코딩한다", async () => {
    const fetcher = vi.fn(async (_input: URL | string) => new Response('{"response":{"header":{"resultCode":"0000"}}}'));
    vi.stubGlobal("fetch", fetcher);
    await callDataGoKr("https://apis.data.go.kr/test", { keyword: "해변" }, { serviceKey: "a+b/c=" });
    expect(new URL(String(fetcher.mock.calls[0]?.[0])).searchParams.get("serviceKey")).toBe("a+b/c=");
  });
});
