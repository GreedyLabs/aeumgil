import { describe, expect, it } from "vitest";
import { normalizeFestivals } from "./tourapi";

const event = {
  contentid: "festival-1",
  title: "강원 숲길 축제",
  eventstartdate: "20260912",
  eventenddate: "20260914",
  addr1: "강원 평창",
  firstimage: "https://example.test/photo.jpg",
};

describe("행사 일정 정규화", () => {
  it("원천 날짜와 장소·사진을 화면 모델로 전달한다", () => {
    expect(normalizeFestivals([event], "20260905", "20261005")).toEqual([
      {
        id: "festival-1",
        name: { ko: "강원 숲길 축제", en: "강원 숲길 축제" },
        startsOn: "2026-09-12",
        endsOn: "2026-09-14",
        address: "강원 평창",
        imageUrl: "https://example.test/photo.jpg",
      },
    ]);
  });
  it("종료·범위 밖·뒤집힌 날짜·존재하지 않는 날짜는 제외한다", () => {
    expect(
      normalizeFestivals(
        [
          { ...event, eventenddate: "20260901" },
          { ...event, eventstartdate: "20261020", eventenddate: "20261022" },
          { ...event, eventstartdate: "20260931", eventenddate: "20261002" },
          { ...event, eventstartdate: undefined },
        ],
        "20260905",
        "20261005",
      ),
    ).toEqual([]);
  });
  it("기간에 겹치는 진행 중 행사도 포함한다", () => {
    expect(
      normalizeFestivals(
        [{ ...event, eventstartdate: "20260901", eventenddate: "20260910" }],
        "20260905",
        "20261005",
      ),
    ).toHaveLength(1);
  });
  it("행사 시작일 순으로 정렬한다", () => {
    expect(
      normalizeFestivals(
        [event, { ...event, contentid: "earlier", eventstartdate: "20260906" }],
        "20260905",
        "20261005",
      ).map((e) => e.id),
    ).toEqual(["earlier", "festival-1"]);
  });
});
