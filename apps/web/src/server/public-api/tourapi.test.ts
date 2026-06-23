// TourAPI 정규화 테스트 — fetch 목.
// 실응답(searchKeyword2/areaBasedList2) 모양: 소문자 필드, mapx/mapy 는 문자열.

import { afterEach, describe, expect, it, vi } from "vitest";
import { listGangwonItems } from "./tourapi";

function mockFetchJson(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("listGangwonItems", () => {
  it("소문자 필드를 도메인 TourItem 으로 정규화한다(mapx/mapy → number)", async () => {
    mockFetchJson({
      response: {
        header: { resultCode: "0000" },
        body: {
          totalCount: 1,
          items: {
            item: [
              {
                contentid: "125798",
                contenttypeid: "12",
                title: "설악산 권금성",
                addr1: "강원특별자치도 속초시 설악산로 1085-3",
                areacode: "32",
                firstimage: "http://img/x.jpg",
                mapx: "128.4881825695",
                mapy: "38.1641490018",
              },
            ],
          },
        },
      },
    });
    const items = await listGangwonItems({ contentTypeId: 12 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      contentId: "125798",
      title: "설악산 권금성",
      areaCode: "32",
      image: "http://img/x.jpg",
    });
    expect(items[0]!.mapX).toBeCloseTo(128.488, 2);
    expect(items[0]!.mapY).toBeCloseTo(38.164, 2);
  });

  it("item 이 단일 객체로 와도 배열로 정규화한다", async () => {
    mockFetchJson({
      response: { body: { items: { item: { contentid: "1", title: "단일" } } } },
    });
    const items = await listGangwonItems();
    expect(items).toHaveLength(1);
    expect(items[0]!.contentId).toBe("1");
  });

  it("items 가 빈 문자열이면 빈 배열을 반환한다", async () => {
    mockFetchJson({ response: { body: { items: "" } } });
    expect(await listGangwonItems()).toEqual([]);
  });
});
