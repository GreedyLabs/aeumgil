import { expect, it } from "vitest";
import { normalizeHighways } from "./highway";
it("다른 동해선·미측정·오래된 자료를 제외하고 같은 구간의 중복 검지기를 합친다", () => {
  const r = {
    routeNo: "0650",
    conzoneId: "A",
    conzoneName: "양양–하조대",
    speed: "70",
    stdDate: "20260905",
    stdHour: "1700",
    updownTypeCode: "E",
  };
  const result = normalizeHighways(
    [
      r,
      { ...r, speed: "30" },
      { ...r, conzoneId: "B", speed: "-1" },
      { ...r, conzoneId: "C", stdHour: "1600" },
      { ...r, routeNo: "0652", conzoneId: "D" },
    ],
    Date.parse("2026-09-05T17:10:00+09:00"),
  );
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    segments: 1,
    slowSegments: 1,
    slow: [{ name: "양양–하조대", speed: 30 }],
  });
});
