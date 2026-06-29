// /course/[id] 서버 페이지 배선 테스트.
// query string 조건이 Repository.getCourse(themeId, options) 로 전달되는지 얇게 확인한다.

import { describe, expect, it, vi } from "vitest";
import React from "react";
import { L } from "@/lib/i18n";
import type { Course, Theme } from "@/domain/types";

const mocks = vi.hoisted(() => ({
  getRepository: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/data", () => ({
  getRepository: mocks.getRepository,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/app/actions/saved", () => ({
  setThemeSavedAction: vi.fn(),
}));

vi.mock("@/components/screens/course", () => ({
  CourseView: () => null,
}));

const theme: Theme = {
  id: "east-sea-sunrise",
  title: L("동해 일출"),
  subtitle: L(""),
  tag: L("해변"),
  region: L("강릉"),
  hue: 200,
  duration: L("당일"),
  pace: L("여유"),
  spotCount: 1,
  mood: [L("바다")],
  blurb: L(""),
};

const course: Course = {
  themeId: "east-sea-sunrise",
  title: L("테스트 코스"),
  dayCount: 1,
  items: [],
};

describe("/course/[id] page", () => {
  it("days/pace/companion/startRegion 쿼리를 Repository 옵션으로 전달한다", async () => {
    vi.stubGlobal("React", React);
    const { default: CoursePage } = await import("./page");
    const repo = {
      getTheme: vi.fn().mockResolvedValue(theme),
      getCourse: vi.fn().mockResolvedValue(course),
      listSavedThemeIds: vi.fn().mockResolvedValue([]),
      getSpot: vi.fn(),
      getEat: vi.fn(),
      getStay: vi.fn(),
    };
    mocks.getRepository.mockReturnValue(repo);

    await CoursePage({
      params: Promise.resolve({ id: "east-sea-sunrise" }),
      searchParams: Promise.resolve({
        days: "1",
        pace: "calm",
        companion: "family",
        startRegion: "강릉",
      }),
    });

    expect(repo.getCourse).toHaveBeenCalledWith("east-sea-sunrise", {
      days: 1,
      pace: "calm",
      companion: "family",
      startRegion: "강릉",
    });
  });
});
