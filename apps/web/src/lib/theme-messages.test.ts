import { describe, expect, it } from "vitest";
import curatedCourses from "@/domain/curated-courses.json";
import { LANGUAGE_OPTIONS } from "./i18n";
import { THEME_MESSAGES, themeMessage } from "./theme-messages";

describe("편집 테마 번역", () => {
  it("현재 큐레이션의 제목·소개·계획 유의사항·태그·분위기를 6개 외국어로 제공한다", () => {
    for (const course of curatedCourses) {
      const texts = [
        course.title,
        course.subtitle,
        course.blurb,
        course.planningNote,
        course.tag,
        ...course.mood,
      ];
      for (const text of texts) {
        for (const { value } of LANGUAGE_OPTIONS.filter((language) => language.value !== "ko")) {
          const translated = themeMessage(text, value);
          expect(translated, `${course.id}/${value}: ${text}`).toBeTruthy();
          expect(translated).not.toMatch(/[가-힣]/u);
        }
      }
    }
  });

  it("등록된 번역값에 빠진 언어나 빈 값을 허용하지 않는다", () => {
    for (const translated of Object.values(THEME_MESSAGES)) {
      expect(translated).toHaveLength(6);
      expect(translated.every((text) => text.trim().length > 0)).toBe(true);
    }
  });

  it("한국어와 등록되지 않은 원문은 대체하지 않는다", () => {
    expect(themeMessage(curatedCourses[0]!.title, "ko")).toBeUndefined();
    expect(themeMessage("우리 가족만의 여행", "en")).toBeUndefined();
    expect(themeMessage("  가족  ", "en")).toBe("  Family  ");
  });
});
