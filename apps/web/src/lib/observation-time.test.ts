import { describe, expect, it } from "vitest";
import { formatObservationTime } from "./detail-screen-messages";
import type { Lang } from "./i18n";

describe("관측 시각의 서버·브라우저 공통 표시", () => {
  it.each<[Lang, string]>([
    ["ko", "9. 6. 14:55"],
    ["en", "9/6, 14:55"],
    ["zh-CN", "9/6 14:55"],
    ["zh-TW", "9/6 14:55"],
    ["ja", "9/6 14:55"],
    ["de", "6.9., 14:55"],
    ["fr", "06/09 14:55"],
  ])("%s는 실행 환경의 ICU 구분 문자에 의존하지 않는다", (lang, expected) => {
    expect(formatObservationTime("2026-09-06T14:55:00+09:00", lang)).toBe(expected);
  });
  it("UTC 연말과 윤년 경계도 한국 날짜·24시제로 표시한다", () => {
    expect(formatObservationTime("2026-12-31T15:01:00Z", "ko")).toBe("1. 1. 00:01");
    expect(formatObservationTime("2028-02-28T15:00:00Z", "fr")).toBe("29/02 00:00");
  });
  it("잘못된 관측 시각을 현재 시간으로 꾸미지 않는다", () => {
    expect(formatObservationTime("invalid", "zh-TW")).toBe("—");
  });
});
