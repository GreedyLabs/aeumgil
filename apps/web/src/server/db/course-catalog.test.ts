// 코스 템플릿 DB 어댑터 테스트 — 실제 DB 없이 체이너블 가짜 DB 주입.

import { describe, expect, it } from "vitest";
import type { Database } from "./index";
import {
  fetchDefaultCourseTemplate,
  fetchSpotProfile,
  fetchSpotProfilesForTheme,
} from "./course-catalog";

function fakeDbSequence(resultSets: unknown[][]): Database {
  let i = 0;
  const chain: Record<string, unknown> = {};
  chain.select = () => {
    const rows = resultSets[i++] ?? [];
    const scoped: Record<string, unknown> = {};
    for (const m of ["from", "where", "orderBy", "limit"]) scoped[m] = () => scoped;
    scoped.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
    return scoped;
  };
  return chain as unknown as Database;
}

describe("fetchDefaultCourseTemplate", () => {
  it("DB 템플릿 행을 도메인 Course 로 정규화한다", async () => {
    const db = fakeDbSequence([
      [
        {
          id: "tpl-east-sea",
          themeId: "east-sea-sunrise",
          titleKo: "동해 DB 템플릿",
          titleEn: "East Sea DB Template",
          dayCount: 2,
          altNoteKo: "DB에서 온 대체 메모",
          altNoteEn: "DB alternative note",
        },
      ],
      [
        {
          templateId: "tpl-east-sea",
          seq: 1,
          kind: "spot",
          day: 1,
          time: "10:00",
          refId: "sacheon-beach",
          durationMin: 60,
        },
        {
          templateId: "tpl-east-sea",
          seq: 2,
          kind: "eat",
          day: 1,
          time: "12:30",
          refId: "e3",
          durationMin: null,
        },
        {
          templateId: "tpl-east-sea",
          seq: 3,
          kind: "stay",
          day: 1,
          time: "18:00",
          refId: "s2",
          durationMin: null,
        },
      ],
    ]);

    const course = await fetchDefaultCourseTemplate(db, "east-sea-sunrise");

    expect(course).toMatchObject({
      themeId: "east-sea-sunrise",
      dayCount: 2,
      items: [
        { kind: "spot", day: 1, time: "10:00", refId: "sacheon-beach", durationMin: 60 },
        { kind: "eat", day: 1, time: "12:30", refId: "e3" },
        { kind: "stay", day: 1, time: "18:00", refId: "s2" },
      ],
    });
    expect(course!.title.ko).toBe("동해 DB 템플릿");
    expect(course!.title.en).toBe("East Sea DB Template");
    expect(course!.altNote?.ko).toBe("DB에서 온 대체 메모");
  });

  it("템플릿이 없으면 null 을 반환한다", async () => {
    const db = fakeDbSequence([[]]);
    await expect(fetchDefaultCourseTemplate(db, "missing")).resolves.toBeNull();
  });

  it("알 수 없는 kind 항목은 버린다", async () => {
    const db = fakeDbSequence([
      [
        {
          id: "tpl",
          themeId: "t1",
          titleKo: "템플릿",
          titleEn: null,
          dayCount: 1,
          altNoteKo: null,
          altNoteEn: null,
        },
      ],
      [
        {
          templateId: "tpl",
          seq: 1,
          kind: "spot",
          day: 1,
          time: "10:00",
          refId: "s1",
          durationMin: 60,
        },
        {
          templateId: "tpl",
          seq: 2,
          kind: "unknown",
          day: 1,
          time: "11:00",
          refId: "x",
          durationMin: null,
        },
      ],
    ]);

    const course = await fetchDefaultCourseTemplate(db, "t1");
    expect(course!.items).toHaveLength(1);
    expect(course!.items[0]!.kind).toBe("spot");
  });
});

describe("spot_profile 어댑터", () => {
  const rows = [
    {
      spotId: "db-beach",
      nameKo: "DB 해변",
      nameEn: "DB Beach",
      typeKo: "해변",
      typeEn: "Beach",
      regionKo: "강릉",
      regionEn: "Gangneung",
      themeIds: ["east-sea-sunrise"],
      tagsKo: ["바다", "한적"],
      tagsEn: ["sea", "quiet"],
      baselineCongestion: "calm",
      suitability: 91,
      rating: 4.7,
      reviewCount: 12,
      defaultDurationMin: 75,
      lat: 37.8368,
      lon: 128.8782,
      imageUrl: "https://example.com/db-beach.jpg",
    },
    {
      spotId: "db-mountain",
      nameKo: "DB 산",
      nameEn: null,
      typeKo: "산",
      typeEn: null,
      regionKo: "평창",
      regionEn: null,
      themeIds: ["mountain-trek"],
      tagsKo: ["산"],
      tagsEn: [],
      baselineCongestion: "busy",
      suitability: 70,
      rating: 4.1,
      reviewCount: 3,
      defaultDurationMin: 120,
      lat: null,
      lon: null,
      imageUrl: null,
    },
  ];

  it("테마에 해당하는 spot_profile 만 도메인 Spot 으로 정규화한다", async () => {
    const db = fakeDbSequence([[rows[0]]]);
    const spots = await fetchSpotProfilesForTheme(db, "east-sea-sunrise");

    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({
      id: "db-beach",
      congestion: "calm",
      suitability: 91,
      rating: 4.7,
      reviewCount: 12,
      lat: 37.8368,
      lon: 128.8782,
      imageUrl: "https://example.com/db-beach.jpg",
    });
    expect(spots[0]!.name.ko).toBe("DB 해변");
    expect(spots[0]!.durationText?.ko).toBe("1시간 15분");
    expect(spots[0]!.tags.map((tag) => tag.ko)).toContain("한적");
  });

  it("DB 검색 결과가 없으면 빈 배열을 반환한다", async () => {
    const db = fakeDbSequence([[]]);
    await expect(fetchSpotProfilesForTheme(db, "no-theme")).resolves.toEqual([]);
  });

  it("단일 spot_profile 을 조회한다", async () => {
    const db = fakeDbSequence([[rows[0]]]);
    const spot = await fetchSpotProfile(db, "db-beach");
    expect(spot?.id).toBe("db-beach");
    expect(spot?.region.ko).toBe("강릉");
  });
});
