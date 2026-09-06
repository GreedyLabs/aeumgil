import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Spot } from "@/domain/types";
import { localizePlaces, localizeSpotDetail, matchingLocalizedPlaceIds } from "./international";
const mocks = vi.hoisted(() => ({ catalog: vi.fn(), detail: vi.fn() }));
vi.mock("@/server/public-api/international-tourapi", async (original) => ({
  ...(await original<typeof import("@/server/public-api/international-tourapi")>()),
  getInternationalCatalog: mocks.catalog,
  getInternationalTourInfo: mocks.detail,
}));
const place = {
  id: "canonical",
  sourceContentId: "100",
  name: { ko: "오죽헌", en: "오죽헌" },
  region: { ko: "강릉", en: "Gangneung" },
  type: { ko: "유적지", en: "Heritage" },
  tags: [],
  lat: 37.779,
  lon: 128.879,
  description: { ko: "한국어 소개", en: "한국어 소개" },
} as unknown as Spot;
beforeEach(() => vi.clearAllMocks());
describe("외국어 표시와 정본 데이터 경계", () => {
  it("동시에 다른 언어를 조회해도 공유 입력과 정본 ID·지역을 바꾸지 않는다", async () => {
    mocks.catalog.mockImplementation(async (language) => ({
      status: "available",
      items: [
        {
          language,
          contentId: `foreign-${language}`,
          contentTypeId: "76",
          title: `${language} Ojukheon (오죽헌)`,
          address: `Address ${language}`,
          lat: 37.779,
          lon: 128.879,
          regionCode: "51",
          sigunguCode: "150",
        },
      ],
    }));
    const [en, fr] = await Promise.all([
      localizePlaces([place], "en"),
      localizePlaces([place], "fr"),
    ]);
    expect(en[0]?.name.en).toContain("en Ojukheon");
    expect(fr[0]?.name.fr).toContain("fr Ojukheon");
    expect(place.name.en).toBe("오죽헌");
    expect(en[0]?.id).toBe("canonical");
    expect(fr[0]?.region.ko).toBe("강릉");
    expect(matchingLocalizedPlaceIds(fr, "fr Ojukheon", "fr")).toEqual(["canonical"]);
    expect(mocks.catalog).toHaveBeenCalledTimes(2);
  });
  it("한국어는 외국어 API를 호출하지 않고 미제공 외국어 상세는 원문 상태로 표시한다", async () => {
    expect(await localizePlaces([place], "ko")).toEqual([place]);
    expect(mocks.catalog).not.toHaveBeenCalled();
    mocks.detail.mockResolvedValue({
      status: "unavailable",
      language: "de",
      reason: "not-provided",
    });
    const original = await localizeSpotDetail(place, "de");
    expect(original.description?.ko).toBe("한국어 소개");
    expect(original.translation).toEqual({ language: "de", status: "original" });
  });
});
