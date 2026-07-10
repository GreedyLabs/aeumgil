// commerce_profile 행 → 도메인 Eat/Stay 정규화 테스트 — 운영-준비-플랜 §4.1
// (TourAPI 수집분 특성: 영문/가격/평점이 없을 수 있다)

import { describe, expect, it } from "vitest";
import { mapEatRow, mapStayRow } from "./commerce";

const baseRow = {
  id: "eat-123456",
  kind: "eat",
  nameKo: "초당 순두부집",
  nameEn: null,
  typeKo: "한식",
  typeEn: null,
  regionKo: "강릉",
  regionEn: "Gangneung",
  priceKo: "",
  priceEn: null,
  rating: 0,
  addr: "강원특별자치도 강릉시 초당동",
  tel: "033-000-0000",
  lat: 37.79,
  lon: 128.92,
  imageUrl: null,
  source: "tourapi",
  sourceContentId: "123456",
  updatedAt: new Date("2026-07-10"),
};

describe("commerce_profile 정규화", () => {
  it("Eat — 한국어 필드를 정규화하고 영문 부재 시 ko 로 폴백한다", () => {
    const eat = mapEatRow(baseRow);
    expect(eat.id).toBe("eat-123456");
    expect(eat.name.ko).toBe("초당 순두부집");
    expect(eat.name.en).toBe("초당 순두부집"); // L() 폴백
    expect(eat.region.ko).toBe("강릉"); // pickByRegion 매칭 기준
    expect(eat.price).toBe(""); // 원천 무가격 — 화면에서 생략
    expect(eat.rating).toBe(0);
  });

  it("Stay — price 를 LocalizedText 로 정규화한다", () => {
    const stay = mapStayRow({
      ...baseRow,
      id: "stay-777",
      kind: "stay",
      nameKo: "속초 해변 펜션",
      typeKo: "펜션",
      regionKo: "속초",
      regionEn: "Sokcho",
      priceKo: "₩150,000/박",
    });
    expect(stay.id).toBe("stay-777");
    expect(stay.type.ko).toBe("펜션");
    expect(stay.price.ko).toBe("₩150,000/박");
    expect(stay.region.ko).toBe("속초");
  });
});
