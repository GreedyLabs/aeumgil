import { describe, expect, it } from "vitest";
import { isLang, keycloakUiLocales, L, LANGUAGE_OPTIONS, localized, uiText } from "./i18n";

describe("요청 언어와 UI 번역 경계", () => {
  it("지원하는 7개 언어 코드만 허용한다", () => {
    expect(LANGUAGE_OPTIONS.map((option) => option.value)).toEqual([
      "ko",
      "en",
      "zh-CN",
      "zh-TW",
      "ja",
      "de",
      "fr",
    ]);
    expect(LANGUAGE_OPTIONS.every((option) => isLang(option.value))).toBe(true);
    for (const invalid of [undefined, null, "zh_CN", "zh", "EN", "ar", ""])
      expect(isLang(invalid)).toBe(false);
  });

  it("선택 언어의 공식 데이터가 있으면 공통 번역보다 우선한다", () => {
    expect(localized({ ko: "강릉", en: "Gangneung", ja: "江陵（公式名称）" }, "ja")).toBe(
      "江陵（公式名称）",
    );
    expect(localized(L("한국어 원문", "Official English"), "fr")).toBe("Official English");
    expect(localized({ ko: "한국어 원문", en: "" }, "de")).toBe("한국어 원문");
  });

  it("선택 언어 데이터가 없으면 이미 번역한 공통 라벨을 활용한다", () => {
    expect(localized(L("홈", "Home"), "fr")).toBe("Accueil");
    expect(localized(L("3일", "3 days"), "ja")).toBe("3日");
  });

  it("공통 메뉴는 모든 언어에 제공하고 미등록 원문은 변경하지 않는다", () => {
    for (const { value } of LANGUAGE_OPTIONS.filter((option) => option.value !== "ko")) {
      expect(uiText("홈", value)).not.toBe("홈");
      expect(uiText("언어 설정", value)).not.toBe("언어 설정");
      expect(uiText("미등록 사용자 작성 여행 제목", value)).toBe("미등록 사용자 작성 여행 제목");
    }
    expect(uiText("홈", "ko")).toBe("홈");
  });

  it("로그인 요청도 선택 언어를 먼저 전달하고 영어·한국어 대체 순서를 유지한다", () => {
    expect(keycloakUiLocales("zh-TW")).toBe("zh-TW en ko");
    expect(keycloakUiLocales("de")).toBe("de en ko");
    expect(keycloakUiLocales("en")).toBe("en ko");
    expect(keycloakUiLocales("ko")).toBe("ko en");
  });
});
