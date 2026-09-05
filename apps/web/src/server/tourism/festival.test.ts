import { expect, it } from "vitest";
import { festivalDate, festivalFromTour } from "./festival";
import type { TourDetail } from "@/server/public-api/tourapi";
const detail: TourDetail = {
  contentId: "123",
  contentTypeId: "15",
  title: "테스트 행사",
  areaCode: "51",
  sigunguCode: "150",
  addr: "강릉",
  image: "",
  mapX: 128.9,
  mapY: 37.75,
  tel: "",
  cat1: "",
  cat2: "",
  cat3: "",
  overview: "행사 안내",
  homepage: '<a href="https://example.org/event">공식 안내</a>',
  zipcode: "",
  festivalInfo: {
    eventstartdate: "20260905",
    eventenddate: "20260910",
    playtime: "10:00<br/>18:00",
    usetimefestival: "무료",
  },
};
it("행사 일정·요금과 좌표를 보존하고 공식 링크만 안전한 URL로 노출한다", () => {
  const result = festivalFromTour(detail);
  expect(result?.event.startsOn).toBe("2026-09-05");
  expect(result?.fees).toBe("무료");
  expect(result?.place.id).toBe("festival-123");
  expect(result?.homepage).toBe("https://example.org/event");
  expect(result?.hours).toBe("10:00\n18:00");
  expect(
    festivalFromTour({ ...detail, homepage: '<a href="javascript:alert(1)">악성</a>' })?.homepage,
  ).toBeUndefined();
});
it("강원 행사가 아닌 콘텐츠와 잘못된 날짜를 행사로 만들지 않는다", () => {
  expect(festivalFromTour({ ...detail, areaCode: "11" })).toBeNull();
  expect(festivalFromTour({ ...detail, contentTypeId: "12" })).toBeNull();
  expect(festivalDate("20260230")).toBe("");
});
