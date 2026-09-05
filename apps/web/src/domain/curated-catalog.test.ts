import { describe, expect, it } from "vitest";
import {
  buildCuratedCatalog,
  type CatalogCommerce,
  type CatalogLocation,
  type CuratedCourseDefinition,
  type MeasureTravel,
} from "./curated-catalog";

const spots: CatalogLocation[] = [
  { id: "a", name: "첫 전시", region: "원주", lat: 37.5, lon: 128 },
  { id: "b", name: "숲 산책", region: "원주", lat: 37.51, lon: 128 },
  { id: "c", name: "마지막 전시", region: "원주", lat: 37.53, lon: 128 },
];
const commerce: CatalogCommerce[] = [
  {
    id: "eat-restaurant",
    kind: "eat",
    name: "밥집",
    region: "원주",
    type: "한식",
    lat: 37.52,
    lon: 128,
  },
  {
    id: "eat-cafe",
    kind: "eat",
    name: "가까운 쉼터",
    region: "원주",
    type: "카페",
    lat: 37.53,
    lon: 128,
  },
  {
    id: "stay-hotel",
    kind: "stay",
    name: "여행 호텔",
    region: "원주",
    type: "호텔",
    lat: 37.5,
    lon: 128,
  },
  {
    id: "stay-camp",
    kind: "stay",
    name: "별빛 공원",
    region: "원주",
    type: "일반야영장",
    lat: 37.51,
    lon: 128,
  },
  {
    id: "stay-nearer-day-two",
    kind: "stay",
    name: "두 번째 호텔",
    region: "원주",
    type: "호텔",
    lat: 37.53,
    lon: 128,
  },
];
const measure: MeasureTravel = (a, b) => ({
  straightKm: Math.abs(a.lat - b.lat) * 100,
  minutes: Math.round(Math.abs(a.lat - b.lat) * 1000) + 4,
});
function stop(index: number, durationMin = 60) {
  const { id, name, region } = spots[index]!;
  return { id, name, region, durationMin };
}
function definition(): CuratedCourseDefinition {
  return {
    id: "journey-test-weekend",
    title: "주말 문화 여행 코스",
    subtitle: "오후에 도착해 전시와 숲을 둘러봐요",
    tag: "문화",
    hue: 150,
    mood: ["전시"],
    blurb: "여행자가 오래 머무는 두 날의 코스예요.",
    planningNote: "운영과 예약 여부를 확인하고 출발하세요.",
    sources: [{ title: "공식 관광 안내", url: "https://korean.visitkorea.or.kr/" }],
    days: [
      {
        title: "도착하는 날",
        note: "점심 후 도착해 전시를 관람해요.",
        startTime: "13:00",
        endTime: "17:00",
        lunch: false,
        stops: [stop(0), stop(1)],
      },
      {
        title: "돌아가는 날",
        note: "식사 후 여유롭게 귀가해요.",
        startTime: "09:30",
        endTime: "15:00",
        lunch: true,
        stops: [stop(2)],
      },
    ],
  };
}

describe("공식 장소 편집 코스 적재 검증", () => {
  it("오후 도착과 마지막 날 시각·체류를 보존하고 실제 식당/숙소만 연결한다", () => {
    const result = buildCuratedCatalog([definition()], spots, commerce, measure)[0]!;
    expect(result.items[0]).toMatchObject({ day: 1, kind: "spot", time: "13:00", durationMin: 60 });
    expect(result.items.find((item) => item.day === 2)).toMatchObject({
      time: "09:30",
      refId: "c",
    });
    expect(result.items.find((item) => item.kind === "stay")?.refId).toBe("stay-hotel");
    expect(result.items.find((item) => item.kind === "eat")?.refId).toBe("eat-restaurant");
    expect(result.days[1]?.overnightTransfer).toBeDefined();
    expect(result.warnings).toEqual([]);
  });

  it("이름에 드러나지 않아도 카페와 야영장 유형은 식사·일반 숙박에서 제외한다", () => {
    const excluded = commerce.filter(
      (place) => place.id === "eat-cafe" || place.id === "stay-camp",
    );
    const result = buildCuratedCatalog([definition()], spots, excluded, measure)[0]!;
    expect(result.items.every((item) => item.kind === "spot")).toBe(true);
    expect(result.warnings).toHaveLength(2);
  });

  it("같은 권역에서 가까운 기존 숙소는 연박해 매일 더 가까운 숙소로 바꾸지 않는다", () => {
    const input = definition();
    input.days = [
      { ...input.days[0]!, stops: [stop(0)] },
      { ...input.days[1]!, lunch: false, stops: [stop(2)] },
      { ...input.days[1]!, lunch: false, stops: [stop(1)] },
    ];
    const result = buildCuratedCatalog([input], spots, commerce, measure)[0]!;
    expect(result.items.filter((item) => item.kind === "stay").map((item) => item.refId)).toEqual([
      "stay-hotel",
      "stay-hotel",
    ]);
  });

  it("없는 관광지나 바뀐 이름은 추정 매칭하지 않고 적재를 중단한다", () => {
    const input = definition();
    expect(() => buildCuratedCatalog([input], spots.slice(1), commerce, measure)).toThrow(
      "관광지를 찾을 수 없음",
    );
    expect(() =>
      buildCuratedCatalog(
        [input],
        spots.map((place) => ({ ...place, name: `${place.name} 변경` })),
        commerce,
        measure,
      ),
    ).toThrow("이름/지역 변경");
  });

  it("좌표 누락·강원 밖 좌표와 빈 일차를 거절한다", () => {
    const input = definition();
    expect(() =>
      buildCuratedCatalog(
        [input],
        spots.map((place) => ({ ...place, lat: 35 })),
        commerce,
        measure,
      ),
    ).toThrow("실제 좌표");
    input.days[0]!.stops = [];
    expect(() => buildCuratedCatalog([input], spots, commerce, measure)).toThrow();
  });

  it("같은 장소를 다른 날 반복하거나 같은 장소 조합으로 코스 수를 부풀리지 않는다", () => {
    const input = definition();
    input.days[1]!.stops = [stop(0)];
    expect(() => buildCuratedCatalog([input], spots, commerce, measure)).toThrow(
      "같은 관광지를 중복",
    );
    expect(() =>
      buildCuratedCatalog(
        [definition(), { ...definition(), id: "journey-duplicate" }],
        spots,
        commerce,
        measure,
      ),
    ).toThrow("장소 조합이 같은");
  });

  it("실제 체류와 이동이 귀가 시각을 넘으면 일정을 잘라 저장하지 않는다", () => {
    const input = definition();
    input.days[1]!.stops[0]!.durationMin = 360;
    expect(() => buildCuratedCatalog([input], spots, commerce, measure)).toThrow("계획한 종료");
    input.days[1]!.endTime = "08:00";
    expect(() => buildCuratedCatalog([input], spots, commerce, measure)).toThrow("시작·종료");
  });

  it("같은 날 과도한 이동과 날짜 사이 장거리 이동을 따로 막는다", () => {
    expect(() =>
      buildCuratedCatalog([definition()], spots, commerce, () => ({ straightKm: 70, minutes: 90 })),
    ).toThrow("과도한 하루 이동");
    const input = definition();
    input.days[0]!.stops = [stop(0)];
    expect(() =>
      buildCuratedCatalog([input], spots, [], () => ({ straightKm: 121, minutes: 150 })),
    ).toThrow("날짜 사이 이동");
  });
});
