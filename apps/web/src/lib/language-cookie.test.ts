import { describe, expect, it } from "vitest";
import { LANGUAGE_OPTIONS } from "./i18n";
import { languageFromCookie } from "./language-cookie";

describe("다른 탭의 언어 쿠키 확인", () => {
  it("다른 쿠키 사이에서도 정확한 키의 7개 지원 언어만 읽는다", () => {
    for (const { value } of LANGUAGE_OPTIONS) {
      expect(
        languageFromCookie(`other=value; eumgil.lang=${encodeURIComponent(value)}; end=1`),
      ).toBe(value);
    }
    expect(languageFromCookie("eumgil.lang=zh%2DCN")).toBe("zh-CN");
  });
  it("누락·미지원·손상된 값과 비슷한 쿠키명은 현재 선택을 덮어쓰지 않는다", () => {
    for (const header of [
      "",
      "eumgil.lang=",
      "eumgil.lang=ar",
      "eumgil.lang=%ZZ",
      "eumgil.lang=zh_CN",
      "other.eumgil.lang=ja",
      "other=eumgil.lang=ja",
    ]) {
      expect(languageFromCookie(header)).toBeUndefined();
    }
  });
});
