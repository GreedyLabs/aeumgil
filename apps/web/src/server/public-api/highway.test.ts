import { describe, expect, it } from "vitest";
import { highwaySpeedLevel } from "@/domain/highway";
import { normalizeHighways, type RoadRow } from "./highway";

const now = Date.parse("2026-09-05T17:10:00+09:00");
const row: RoadRow = {
  routeNo: "0650",
  conzoneId: "0650CZE250",
  conzoneName: "양양IC-하조대IC",
  speed: "70",
  stdDate: "20260905",
  stdHour: "1700",
  updownTypeCode: "E",
  vdsId: "A",
};
const donghae = (rows: RoadRow[], at = now) => normalizeHighways(rows, at)[2]!;

describe("도로공사 구간별 관측 정규화", () => {
  it("빈 응답도 세 노선을 미관측으로 구분하고 원활로 채우지 않는다", () => {
    const roads = normalizeHighways([], now);
    expect(roads.map((road) => road.routeCode)).toEqual(["0500", "0600", "0650"]);
    expect(roads.every((road) => road.status === "unavailable" && road.segments === 0)).toBe(true);
    expect(roads.every((road) => road.observedAt === undefined && road.details.length === 0)).toBe(
      true,
    );
  });

  it("동일 구간·방향의 검지기를 하나로 합치고 최저 관측속도와 실제 이름을 보존한다", () => {
    const roads = normalizeHighways(
      [
        row,
        { ...row, speed: "30", vdsId: "B" },
        { ...row, speed: "30", vdsId: "B" },
        { ...row, conzoneId: "missing", speed: "-1" },
        { ...row, conzoneId: "old", stdHour: "1600" },
        { ...row, routeNo: "0652", conzoneId: "different-road" },
      ],
      now,
    );
    expect(roads[2]).toMatchObject({
      status: "current",
      segments: 1,
      slowSegments: 1,
      delayedSegments: 0,
      unavailableSegments: 1,
      staleSegments: 1,
      details: [
        {
          name: "양양IC-하조대IC",
          speed: 30,
          directionCode: "E",
          observedAt: "2026-09-05T08:00:00.000Z",
        },
      ],
    });
    expect(roads[0]!.segments).toBe(0);
  });

  it("같은 구간 ID라도 반대 방향은 별도 집계한다", () => {
    const result = donghae([
      row,
      { ...row, conzoneName: "하조대IC-양양IC", updownTypeCode: "S", speed: "90" },
    ]);
    expect(result.segments).toBe(2);
    expect(result.delayedSegments).toBe(1);
    expect(
      result.details.map((segment) => [segment.name, segment.directionCode, segment.speed]),
    ).toEqual([
      ["양양IC-하조대IC", "E", 70],
      ["하조대IC-양양IC", "S", 90],
    ]);
  });

  it("이전 시각의 정체를 최신 관측에 섞지 않고 입력 순서에도 영향을 받지 않는다", () => {
    const rows = [
      { ...row, speed: "10" },
      { ...row, stdHour: "1705", speed: "95" },
    ];
    expect(donghae(rows)).toEqual(donghae([...rows].reverse()));
    expect(donghae(rows)).toMatchObject({
      slowSegments: 0,
      delayedSegments: 0,
      details: [{ speed: 95 }],
    });
  });

  it("최신 관측이 -1이면 이전 속도를 부활시키지 않는다", () => {
    expect(donghae([row, { ...row, stdHour: "1705", speed: "-1" }])).toMatchObject({
      status: "unavailable",
      segments: 0,
      unavailableSegments: 1,
      details: [],
    });
  });

  it("20분까지 사용하고 같은 캐시 데이터도 그 이후에는 갱신 지연으로 처리한다", () => {
    const atBoundary = Date.parse("2026-09-05T17:20:00+09:00");
    expect(donghae([row], atBoundary).status).toBe("current");
    expect(donghae([row], atBoundary + 1)).toMatchObject({
      status: "stale",
      segments: 0,
      staleSegments: 1,
      details: [],
      observedAt: "2026-09-05T08:00:00.000Z",
    });
  });

  it("미측정·비정상값·미래시각·존재하지 않는 날짜는 실제 0km/h와 구별한다", () => {
    const invalid: RoadRow[] = ["-1", "", " ", "NaN", "Infinity", "201"].map((speed, i) => ({
      ...row,
      conzoneId: `speed${i}`,
      speed,
    }));
    invalid.push({ ...row, conzoneId: "future", stdHour: "1711" });
    invalid.push({ ...row, conzoneId: "bad-hour", stdHour: "2500" });
    invalid.push({ ...row, conzoneId: "bad-date", stdDate: "20260230" });
    invalid.push({ ...row, conzoneId: undefined });
    expect(donghae(invalid)).toMatchObject({
      status: "unavailable",
      segments: 0,
      unavailableSegments: 9,
    });
    expect(donghae([{ ...row, speed: "0" }])).toMatchObject({
      status: "current",
      slowSegments: 1,
      details: [{ speed: 0 }],
    });
  });

  it("저속 구간을 세 개에서 자르지 않고 전체를 속도순으로 제공한다", () => {
    const rows = [60, 20, 30, 10, 90].map((speed, i) => ({
      ...row,
      conzoneId: `zone${i}`,
      speed: String(speed),
    }));
    const result = donghae(rows);
    expect(result.details.map((segment) => segment.speed)).toEqual([10, 20, 30, 60, 90]);
    expect(result).toMatchObject({ segments: 5, slowSegments: 3, delayedSegments: 1 });
  });

  it("에움길 표시 임계값 40·80을 정확히 적용한다", () => {
    expect([0, 39, 40, 79, 80, 120].map(highwaySpeedLevel)).toEqual([
      "slow",
      "slow",
      "delayed",
      "delayed",
      "clear",
      "clear",
    ]);
  });
});
