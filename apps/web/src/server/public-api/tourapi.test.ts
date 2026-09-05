// TourAPI 정규화 테스트 — fetch 목.
// 실응답(searchKeyword2/areaBasedList2) 모양: 소문자 필드, mapx/mapy 는 문자열.

import { afterEach, describe, expect, it, vi } from "vitest";
import { listGangwonItems, searchGangwonKeyword } from "./tourapi";

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

describe("searchGangwonKeyword", () => {
  it("searchKeyword2 를 keyword·법정동 지역코드 파라미터로 호출하고 결과를 정규화한다", async () => {
    mockFetchJson({
      response: {
        header: { resultCode: "0000" },
        body: {
          totalCount: 1,
          items: { item: [{ contentid: "77", title: "속초관광수산시장", areacode: "32" }] },
        },
      },
    });
    const items = await searchGangwonKeyword("시장");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ contentId: "77", title: "속초관광수산시장" });

    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).toContain("searchKeyword2");
    expect(calledUrl).toContain(`keyword=${encodeURIComponent("시장")}`);
    expect(calledUrl).toContain("lDongRegnCd=51");
  });

  it("검색 결과가 없으면 빈 배열을 반환한다", async () => {
    mockFetchJson({ response: { body: { items: "" } } });
    expect(await searchGangwonKeyword("없는키워드")).toEqual([]);
  });
});

describe("상세 사진과 이용 안내", () => {
  it("공통 상세에 미지원 파라미터를 보내지 않고 사진 API에서 대표사진을 보강한다", async () => {
    const fetcher = vi.fn(async (input: URL) => {
      const url = new URL(input);
      if (url.pathname.endsWith("/detailCommon2")) {
        expect([...url.searchParams.keys()].sort()).toEqual(
          [
            "MobileApp",
            "MobileOS",
            "_type",
            "contentId",
            "numOfRows",
            "pageNo",
            "serviceKey",
          ].sort(),
        );
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              response: {
                body: {
                  items: {
                    item: [
                      {
                        contentid: "129263",
                        contenttypeid: "12",
                        title: "대관령양떼목장",
                        firstimage: "",
                        addr1: "평창",
                      },
                    ],
                  },
                },
              },
            }),
        };
      }
      const item = url.pathname.endsWith("/detailImage2")
        ? [
            { originimgurl: "https://example.test/original.jpg", cpyrhtDivCd: "Type3" },
            { originimgurl: "https://example.test/cover.jpg", cpyrhtDivCd: "Type1" },
          ]
        : [
            {
              usetime: "09:00~18:00<br>입장 마감 17:00",
              parking: "있음",
              expguide: "먹이주기 체험",
            },
          ];
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ response: { body: { items: { item } } } }),
      };
    });
    vi.stubGlobal("fetch", fetcher);
    const { getItemDetail } = await import("./tourapi");
    const detail = await getItemDetail("129263");
    expect(detail?.image).toBe("https://example.test/cover.jpg");
    expect(detail?.photos?.[0]?.license).toBe("Type3");
    expect(detail?.visitInfo).toMatchObject({
      hours: "09:00~18:00\n입장 마감 17:00",
      parking: "있음",
    });
    expect(detail?.visitInfo?.fees).toBeUndefined();
  });
});
