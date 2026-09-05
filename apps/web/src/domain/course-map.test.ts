import { expect, it } from "vitest";
import type { Spot, Eat } from "./types";
import { courseMapStops } from "./course-map";
it("식당을 포함한 일정 순서를 유지하고 좌표가 없는 장소를 지도에서 제외한다", () => {
  const spots = {
    s: { id: "s", name: { ko: "관광지", en: "Spot" }, lat: 37, lon: 128 } as Spot,
    missing: { id: "missing" } as Spot,
  };
  const eats = { e: { id: "e", name: { ko: "식당", en: "Eat" }, lat: 37.1, lon: 128.1 } as Eat };
  const mapped = courseMapStops(
    [
      { day: 1, time: "09:30", kind: "spot", refId: "s" },
      { day: 1, time: "12:00", kind: "eat", refId: "e" },
      { day: 1, time: "14:00", kind: "spot", refId: "missing" },
    ],
    spots,
    eats,
    {},
  );
  expect(mapped.map((p) => [p.id, p.time])).toEqual([
    ["s", "09:30"],
    ["e", "12:00"],
  ]);
});
