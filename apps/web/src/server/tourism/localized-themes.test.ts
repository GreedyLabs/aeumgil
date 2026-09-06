import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Spot, Theme } from "@/domain/types";
import type { Lang } from "@/lib/i18n";
import { localizeRegionalThemes } from "./localized-themes";
const mocks = vi.hoisted(() => ({ localize: vi.fn() }));
vi.mock("./international", () => ({ localizePlaces: mocks.localize }));

const automatic = {
  id: "gangwon-yanggu-culture",
  title: { ko: "양구 · 문화 여행", en: "Yanggu culture" },
  subtitle: {
    ko: "박수근미술관 · 양구백자박물관 · 한반도섬",
    en: "박수근미술관 · 양구백자박물관 · 한반도섬",
  },
  blurb: {
    ko: "박수근미술관, 양구백자박물관, 한반도섬을 연결해요.",
    en: "박수근미술관, 양구백자박물관, 한반도섬을 연결해요.",
  },
  region: { ko: "양구", en: "Yanggu" },
  spotCount: 3,
} as Theme;
const spots = ["한반도섬", "박수근미술관", "양구백자박물관"].map((name, i) => ({
  id: `canonical-${i}`,
  name: { ko: name, en: name },
  themeIds: [automatic.id],
  region: automatic.region,
})) as Spot[];
beforeEach(() => {
  mocks.localize.mockReset();
  mocks.localize.mockImplementation(async (places: Spot[], lang: Lang) =>
    places.map((place) =>
      place.name.ko === "박수근미술관"
        ? {
            ...place,
            name: { ...place.name, [lang]: `${lang} Park Soo Keun Museum (박수근미술관)` },
          }
        : place,
    ),
  );
});

describe("자동 지역 테마의 외국어 대표 장소", () => {
  it("외국어 이름과 미제공 원문을 원래 세 장소 순서대로 보여준다", async () => {
    const [theme] = await localizeRegionalThemes([automatic], spots, "fr");
    expect(theme?.subtitle.fr).toBe(
      "fr Park Soo Keun Museum (박수근미술관) · 양구백자박물관 · 한반도섬",
    );
    expect(theme?.blurb.fr).toContain(
      "Reliez fr Park Soo Keun Museum (박수근미술관), 양구백자박물관 et 한반도섬.",
    );
    expect(theme?.id).toBe(automatic.id);
    expect(theme?.title).toBe(automatic.title);
    expect(theme?.region).toBe(automatic.region);
    expect(theme?.subtitle.ko).toBe(automatic.subtitle.ko);
    expect(automatic.subtitle.fr).toBeUndefined();
    expect(spots.every((spot) => spot.name.fr === undefined)).toBe(true);
  });
  it("목록 전체에서 필요한 명소를 중복 없이 한 번만 보강한다", async () => {
    const other = { ...automatic, id: "gangwon-yanggu-museum" };
    const members = spots.map((spot) => ({ ...spot, themeIds: [automatic.id, other.id] }));
    await localizeRegionalThemes([automatic, other], members, "en");
    expect(mocks.localize).toHaveBeenCalledTimes(1);
    expect(mocks.localize.mock.calls[0]?.[0]).toHaveLength(3);
  });
  it("다른 언어를 동시에 요청해도 제목과 원문·다른 언어 값을 덮어쓰지 않는다", async () => {
    const [[en], [ja]] = await Promise.all([
      localizeRegionalThemes([automatic], spots, "en"),
      localizeRegionalThemes([automatic], spots, "ja"),
    ]);
    expect(en?.subtitle.en).toContain("en Park");
    expect(en?.subtitle.ja).toBeUndefined();
    expect(ja?.subtitle.ja).toContain("ja Park");
    expect(ja?.subtitle.en).toBe(automatic.subtitle.en);
  });
  it("편집 테마·한국어·동명 중복·불완전한 소속은 원본 그대로 보존한다", async () => {
    const curated = {
      ...automatic,
      id: "journey-yanggu-two-days",
      sources: [{ title: "공식 자료", url: "https://example.org" }],
    };
    expect((await localizeRegionalThemes([curated], spots, "de"))[0]).toBe(curated);
    expect((await localizeRegionalThemes([automatic], spots, "ko"))[0]).toBe(automatic);
    expect(
      (
        await localizeRegionalThemes(
          [automatic],
          [...spots, { ...spots[1]!, id: "duplicate" }],
          "de",
        )
      )[0],
    ).toBe(automatic);
    expect((await localizeRegionalThemes([automatic], spots.slice(1), "de"))[0]).toBe(automatic);
    expect(mocks.localize).not.toHaveBeenCalled();
  });
});
