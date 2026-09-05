import { describe, expect, it } from "vitest";
import { appendPersonalCourseInput, appendPersonalPlaces } from "./append-personal-course";
import type { PersonalCourseItem } from "./personal-course";

const festival = { kind: "festival" as const, refId: "festival-734219" };
const spot = { kind: "spot" as const, refId: "spot-one" };
const item: PersonalCourseItem = { ...spot, day: 1, durationMin: 90 };

describe("기존 여행에 장소 담기", () => {
  it("이미 담은 행사와 새 주변 장소를 함께 선택해도 새 장소만 추가한다", () => {
    const current = [{ ...festival, day: 1, durationMin: 150 }];
    const result = appendPersonalPlaces(current, [festival, spot], 1);
    expect(result).toEqual({
      items: [...current, { ...spot, day: 1, durationMin: 60 }],
      added: 1,
      skipped: 1,
    });
    expect(current).toHaveLength(1);
  });

  it("다른 날짜의 같은 장소는 허용하고 새 장소는 선택한 날짜 끝에 붙인다", () => {
    const secondDay = { ...item, refId: "day-two", day: 2 };
    const result = appendPersonalPlaces([item, secondDay], [festival, spot], 2);
    expect(result.items.map((place) => [place.refId, place.day])).toEqual([
      ["spot-one", 1],
      ["day-two", 2],
      ["festival-734219", 2],
      ["spot-one", 2],
    ]);
    expect(result.items[2]?.durationMin).toBe(120);
    expect(result.added).toBe(2);
  });

  it("중복 요청도 같은 날짜·종류·ID 한 개만 추가한다", () => {
    expect(appendPersonalPlaces([], [spot, spot], 1)).toMatchObject({ added: 1, skipped: 1 });
    expect(appendPersonalPlaces([item], [spot], 1)).toMatchObject({ items: [item], added: 0 });
  });

  it("코스 ID·버전·허용 날짜·담을 종류와 개수를 검증한다", () => {
    const input = {
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      version: 2,
      day: 1,
      places: [spot],
    };
    expect(appendPersonalCourseInput.safeParse(input).success).toBe(true);
    for (const change of [
      { courseId: "other" },
      { version: undefined },
      { version: -1 },
      { day: 0 },
      { places: [] },
      { places: Array(4).fill(spot) },
      { places: [{ kind: "unknown", refId: "x" }] },
    ])
      expect(appendPersonalCourseInput.safeParse({ ...input, ...change }).success).toBe(false);
  });
});
