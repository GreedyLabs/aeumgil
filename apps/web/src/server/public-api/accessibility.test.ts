import { afterEach, expect, it, vi } from "vitest";
import { getAccessibility, normalizeAccessibility } from "./accessibility";
afterEach(() => vi.unstubAllGlobals());
it("없음과 조건부 이용을 보존하고 미제공 값과 HTML 태그만 제거한다", () => {
  expect(
    normalizeAccessibility({
      wheelchair: "없음",
      exit: "주출입구 계단<br/>보조출입구 경사로",
      restroom: "",
      elevator: "-",
      stroller: null,
    }),
  ).toEqual([
    { key: "exit", label: "출입구", value: "주출입구 계단\n보조출입구 경사로" },
    { key: "wheelchair", label: "휠체어 대여", value: "없음" },
  ]);
});
it("같은 장소의 상세 요청은 캐시를 공유한다", async () => {
  const fetcher = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        response: {
          header: { resultCode: "0000" },
          body: { items: { item: [{ contentid: "access-test-1", parking: "장애인주차장 있음" }] } },
        },
      }),
  }));
  vi.stubGlobal("fetch", fetcher);
  const [a, b] = await Promise.all([
    getAccessibility("access-test-1"),
    getAccessibility("access-test-1"),
  ]);
  expect(a?.items[0]?.value).toBe("장애인주차장 있음");
  expect(b).toEqual(a);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("잘못된 장소 응답은 안내로 표시하지 않는다", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          response: {
            header: { resultCode: "0000" },
            body: { items: { item: { contentid: "wrong", parking: "있음" } } },
          },
        }),
    })),
  );
  await expect(getAccessibility("access-test-2")).rejects.toThrow("장소 ID 불일치");
});
