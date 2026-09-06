import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCache } from "../cache";
import {
  getInternationalCatalog,
  getInternationalTourInfo,
  INTERNATIONAL_TOUR_SERVICES,
  matchInternationalSpot,
  normalizeInternationalTourItem,
  type InternationalLanguage,
  type InternationalSpotIdentity,
  type InternationalTourItem,
} from "./international-tourapi";

const mocks = vi.hoisted(() => ({ call: vi.fn(), cached: vi.fn() }));
vi.mock("./http", () => ({ callDataGoKr: mocks.call }));
vi.mock("../cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../cache")>()),
  apiCache: { cached: mocks.cached },
}));

const identity: InternationalSpotIdentity = {
  id: "tour-130493",
  sourceContentId: "130493",
  name: { ko: "박수근미술관", en: "Park Soo Keun Museum" },
  lat: 38.0962972045,
  lon: 127.9815974137,
  region: "양구",
};
function raw(overrides: Record<string, unknown> = {}) {
  return {
    contentid: "1540697",
    contenttypeid: "78",
    title: "Park Soo Keun Museum (박수근미술관)",
    addr1: "265-15, Parksookeun-ro, Yanggu-gun, Gangwon-do",
    addr2: "",
    mapx: "127.9814863192",
    mapy: "38.0960833383",
    lDongRegnCd: "51",
    lDongSignguCd: "800",
    areacode: "32",
    modifiedtime: "20221223150220",
    ...overrides,
  };
}
function item(
  overrides: Record<string, unknown> = {},
  language: InternationalLanguage = "en",
): InternationalTourItem {
  return normalizeInternationalTourItem(raw(overrides), language)!;
}
function envelope(rows: Record<string, unknown>[], total = rows.length) {
  return {
    response: {
      header: { resultCode: "0000", resultMsg: "OK" },
      body: { totalCount: total, items: { item: rows } },
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  const cache = createCache(
    { load: async () => ({}), save: async () => {} },
    { failureCooldownMs: 30_000 },
  );
  mocks.cached.mockImplementation(cache.cached.bind(cache));
});

describe("외국어 관광지 연결", () => {
  it("독립된 외국어 ID를 같은 이름과 가까운 좌표로 연결한다", () => {
    expect(matchInternationalSpot(identity, [item()])).toMatchObject({
      status: "matched",
      item: { contentId: "1540697" },
      distanceMeters: 26,
      method: "coordinates-and-name",
    });
  });
  it("부분 이름이 같은 옆 시설을 원래 장소에 연결하지 않는다", () => {
    const beach: InternationalSpotIdentity = {
      id: "tour-125707",
      name: { ko: "속초해수욕장" },
      lat: 38.1905487347,
      lon: 128.6019333307,
    };
    const eye = item({
      title: "Sokcho Beach Ferris Wheel (속초해수욕장 대관람차(속초아이))",
      mapx: 128.6019,
      mapy: 38.1905,
    });
    expect(matchInternationalSpot(beach, [eye]).status).toBe("unmatched");
  });
  it("같은 이름이어도 멀리 있거나 좌표가 없으면 연결하지 않는다", () => {
    expect(matchInternationalSpot(identity, [item({ mapy: 38.106 })]).status).toBe("unmatched");
    expect(matchInternationalSpot({ ...identity, lat: undefined }, [item()]).status).toBe(
      "unmatched",
    );
    expect(matchInternationalSpot({ ...identity, lon: NaN }, [item()]).status).toBe("unmatched");
  });
  it("가까운 같은 이름의 ID가 둘이면 더 가까운 후보로 임의 확정하지 않는다", () => {
    expect(matchInternationalSpot(identity, [item(), item({ contentid: "999999" })]).status).toBe(
      "ambiguous",
    );
  });
  it("국문 접두어·전각 괄호를 처리하고 지역의 독립 접두어만 줄인다", () => {
    expect(
      matchInternationalSpot({ ...identity, name: { ko: "양구 박수근미술관" } }, [
        item({ title: "박수근미술관（Park Soo Keun Museum）" }),
      ]).status,
    ).toBe("matched");
    expect(
      matchInternationalSpot(identity, [item({ title: "朴壽根美術館（박수근미술관）" }, "zh-TW")])
        .status,
    ).toBe("matched");
  });
  it("같은 국문 ID라도 이름이 다르면 연결하지 않는다", () => {
    expect(
      matchInternationalSpot(identity, [
        item({ contentid: "130493", title: "Other museum (다른미술관)" }),
      ]).status,
    ).toBe("unmatched");
  });
  it("외국어가 없는 제목·없는 좌표·다른 도의 항목은 외국어 목록에서 제외한다", () => {
    expect(normalizeInternationalTourItem(raw({ title: "박수근미술관" }), "en")).toBeNull();
    expect(normalizeInternationalTourItem(raw({ mapx: "" }), "en")).toBeNull();
    expect(normalizeInternationalTourItem(raw({ lDongRegnCd: "41" }), "en")).toBeNull();
    expect(
      normalizeInternationalTourItem(raw({ lDongRegnCd: "", areacode: "32" }), "en")?.regionCode,
    ).toBe("51");
  });
});

describe("외국어 카탈로그 캐시와 완전성", () => {
  it("승인된 6종 서비스와 강원 법정동 필터를 사용한다", async () => {
    mocks.call.mockResolvedValue(envelope([]));
    for (const language of Object.keys(INTERNATIONAL_TOUR_SERVICES) as InternationalLanguage[]) {
      const catalog = await getInternationalCatalog(language);
      expect(catalog).toMatchObject({ status: "available", complete: true, total: 0 });
      expect(mocks.call).toHaveBeenLastCalledWith(
        `https://apis.data.go.kr/B551011/${INTERNATIONAL_TOUR_SERVICES[language]}/areaBasedList2`,
        expect.objectContaining({ lDongRegnCd: 51, numOfRows: 500, pageNo: 1 }),
        expect.any(Object),
      );
    }
  });
  it("500건 다음 페이지까지 조회하고 동시 검색 24건이 한 번의 목록을 공유한다", async () => {
    const first = Array.from({ length: 500 }, (_, index) =>
      raw({ contentid: String(1_000_000 + index) }),
    );
    mocks.call
      .mockResolvedValueOnce(envelope(first, 501))
      .mockResolvedValueOnce(envelope([raw()], 501));
    const catalogs = await Promise.all(
      Array.from({ length: 24 }, () => getInternationalCatalog("en")),
    );
    expect(
      catalogs.every(
        (catalog) =>
          catalog.status === "available" && catalog.items.length === 501 && catalog.complete,
      ),
    ).toBe(true);
    expect(mocks.call).toHaveBeenCalledTimes(2);
    expect(mocks.call.mock.calls[1]?.[1]).toMatchObject({ pageNo: 2, numOfRows: 500 });
    await getInternationalCatalog("en");
    expect(mocks.call).toHaveBeenCalledTimes(2);
    expect(mocks.cached.mock.calls[0]?.[1]).toBe(24 * 60 * 60 * 1000);
  });
  it("잘린 목록이나 중복 페이지를 정상적인 빈 목록으로 캐시하지 않는다", async () => {
    mocks.call.mockResolvedValue(envelope([raw()], 501));
    expect(await getInternationalCatalog("en")).toMatchObject({
      status: "unavailable",
      reason: "incomplete",
      complete: false,
      items: [],
    });
    await getInternationalCatalog("en");
    expect(mocks.call).toHaveBeenCalledTimes(1);
    mocks.call.mockResolvedValue(envelope([raw(), raw()], 2));
    expect(await getInternationalCatalog("de")).toMatchObject({
      status: "unavailable",
      reason: "incomplete",
      items: [],
    });
  });
  it("HTTP 200 최상위 resultCode 오류와 과도한 전체 건수를 거절한다", async () => {
    mocks.call.mockResolvedValueOnce({
      resultCode: "10",
      resultMsg: "INVALID_REQUEST_PARAMETER_ERROR(contentTypeId)",
    });
    expect(await getInternationalCatalog("en")).toMatchObject({
      status: "unavailable",
      reason: "api-error",
    });
    mocks.call.mockResolvedValueOnce(envelope([raw()], 10001));
    expect(await getInternationalCatalog("de")).toMatchObject({
      status: "unavailable",
      reason: "incomplete",
    });
  });
});

describe("외국어 상세 정보", () => {
  it("선택한 단건에만 외국어 ID로 common과 intro를 추가 요청한다", async () => {
    mocks.call.mockImplementation(async (endpoint: string) => {
      if (endpoint.endsWith("areaBasedList2")) return envelope([raw()]);
      if (endpoint.endsWith("detailCommon2"))
        return envelope([
          raw({
            overview: "A museum &amp; park.<br>Visit &ldquo;Yanggu&rdquo;.",
            homepage: '<a href="https://example.org/">Museum</a>',
          }),
        ]);
      return envelope([
        {
          contentid: "1540697",
          usetimeculture: "09:00–18:00",
          restdateculture: "Mondays",
          usefee: "Adults: 6,000 won",
          infocenterculture: "+82-33-480-2655",
        },
      ]);
    });
    const info = await getInternationalTourInfo(identity, "en");
    expect(info).toMatchObject({
      status: "available",
      officialLanguage: "en",
      title: "Park Soo Keun Museum (박수근미술관)",
      overview: "A museum & park.\nVisit “Yanggu”.",
      homepage: "https://example.org/",
      visitInfo: { hours: "09:00–18:00", closed: "Mondays", fees: "Adults: 6,000 won" },
      unavailableSections: [],
      provenance: { originalContentId: "130493", foreignContentId: "1540697", distanceMeters: 26 },
    });
    const common = mocks.call.mock.calls.find(([endpoint]) => endpoint.endsWith("detailCommon2"));
    const intro = mocks.call.mock.calls.find(([endpoint]) => endpoint.endsWith("detailIntro2"));
    expect(common?.[1]).toMatchObject({ contentId: "1540697" });
    expect(common?.[1]).not.toHaveProperty("contentTypeId");
    expect(intro?.[1]).toMatchObject({ contentId: "1540697", contentTypeId: "78" });
    await getInternationalTourInfo(identity, "en");
    expect(mocks.call).toHaveBeenCalledTimes(3);
  });
  it("연결할 수 없으면 상세 API를 요청하지 않고 한국어를 외국어로 꾸미지 않는다", async () => {
    mocks.call.mockResolvedValue(envelope([]));
    expect(await getInternationalTourInfo(identity, "de")).toEqual({
      status: "unavailable",
      language: "de",
      reason: "not-provided",
    });
    expect(mocks.call).toHaveBeenCalledTimes(1);
  });
  it("이용 안내 실패 시 공식 제목/소개는 제공하되 누락된 안내를 표시한다", async () => {
    mocks.call.mockImplementation(async (endpoint: string) => {
      if (endpoint.endsWith("detailIntro2")) throw new Error("연결 실패");
      return envelope([raw({ overview: "Park Soo Keun Museum opened in 2002." })]);
    });
    const info = await getInternationalTourInfo(identity, "en");
    expect(info).toMatchObject({ status: "available", unavailableSections: ["visitInfo"] });
    await getInternationalTourInfo(identity, "en");
    expect(mocks.call).toHaveBeenCalledTimes(3);
  });
  it("소개 원문이 한국어뿐이면 외국어 소개로 표시하지 않고 위험한 홈페이지 URL도 제외한다", async () => {
    mocks.call.mockResolvedValue(
      envelope([
        raw({
          overview: "박수근미술관입니다.",
          homepage: '<a href="javascript:alert(1)">링크</a>',
        }),
      ]),
    );
    const info = await getInternationalTourInfo(identity, "en");
    expect(info).toMatchObject({
      status: "available",
      unavailableSections: ["overview", "visitInfo"],
    });
    if (info.status === "available") {
      expect(info.overview).toBeUndefined();
      expect(info.homepage).toBeUndefined();
    }
  });
  it("목록 조회 후 다른 장소로 변한 상세 응답을 표시하지 않는다", async () => {
    mocks.call
      .mockResolvedValueOnce(envelope([raw()]))
      .mockResolvedValue(envelope([raw({ title: "Other museum (다른미술관)" })]));
    expect(await getInternationalTourInfo(identity, "en")).toEqual({
      status: "unavailable",
      language: "en",
      reason: "not-provided",
    });
  });
});
