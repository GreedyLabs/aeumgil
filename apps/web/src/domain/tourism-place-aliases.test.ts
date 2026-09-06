import { describe, expect, it } from "vitest";
import { checkedTourismPlaceAliases } from "./tourism-place-aliases";

const place = {
  id: "ojukheon",
  nameKo: "강릉 오죽헌·시립박물관",
  regionKo: "강릉",
  lat: 37.7791388748,
  lon: 128.8796621017,
};

describe("공식 관광자료의 검토된 장소 별칭", () => {
  it("일치한 복합 시설명의 별칭을 미디어·외국어 연결에 함께 제공한다", () => {
    expect(checkedTourismPlaceAliases(place)).toEqual(["오죽헌"]);
    expect(
      checkedTourismPlaceAliases({ ...place, regionKo: "강릉시", nameKo: "오죽헌·시립박물관" }),
    ).toEqual(["오죽헌"]);
  });
  it("다른 ID·이름·지역·좌표나 좌표 미제공에는 별칭을 만들지 않는다", () => {
    for (const other of [
      { ...place, id: "other" },
      { ...place, nameKo: "오죽헌 근처 시립박물관" },
      { ...place, regionKo: "속초" },
      { ...place, lat: 37.5 },
      { ...place, lon: undefined },
      { ...place, lat: Number.NaN },
      { ...place, lat: place.lat + 360 },
    ])
      expect(checkedTourismPlaceAliases(other)).toEqual([]);
  });
});
