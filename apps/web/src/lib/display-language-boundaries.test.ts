import { describe, expect, it } from "vitest";
import { L, localized } from "./i18n";
import { originalText } from "./original-text";
import { localizedSearchText } from "./localized-search-text";
import { mergePlaceLabels } from "./place-labels";

describe("표시 언어와 사용자 원문·검색 상태 경계", () => {
  it("번역 사전에 있는 사용자 이름·소개·리뷰도 편집과 표시에는 원문을 쓴다", () => {
    for (const value of ["바다", "가족", "홈", "  숲  "]) {
      expect(originalText(L(value))).toBe(value);
    }
    expect(localized(L("홈"), "fr")).toBe("Accueil");
    expect(originalText(L("홈"))).toBe("홈");
    expect(originalText({ ko: "", en: "My own words" })).toBe("My own words");
  });

  it("한글 원문과 공식 외국어 값·UI 번역 모두 검색 인덱스에 남긴다", () => {
    const text = localizedSearchText([{ ko: "홈", en: "Home", ja: "公式ホーム" }]);
    for (const term of ["홈", "home", "公式ホーム", "accueil", "startseite"]) {
      expect(text).toContain(term);
    }
  });

  it("초안에 추가한 장소와 좌표를 유지하고 새로운 언어 표기만 병합한다", () => {
    const previous = {
      saved: {
        name: { ko: "강릉 명소", en: "Gangneung place" },
        region: L("강릉", "Gangneung"),
        lat: 37.7,
      },
      unsaved: { name: L("새로 담은 장소"), region: L("원주"), lat: 37.3 },
    };
    const incoming = {
      saved: {
        name: { ko: "강릉 명소", en: "강릉 명소", ja: "江陵の名所" },
        region: L("강릉", "Gangneung"),
        lat: 0,
      },
    };
    const merged = mergePlaceLabels(previous, incoming);
    expect(merged.unsaved).toBe(previous.unsaved);
    expect(merged.saved!.lat).toBe(37.7);
    expect(merged.saved!.name).toEqual({
      ko: "강릉 명소",
      en: "Gangneung place",
      ja: "江陵の名所",
    });
    expect(previous.saved.name).toEqual({ ko: "강릉 명소", en: "Gangneung place" });
    expect(incoming.saved.name.en).toBe("강릉 명소");
  });
});
