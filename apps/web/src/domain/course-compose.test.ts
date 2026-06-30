// 시드/DB 후보 기반 코스 생성 MVP 테스트.

import { describe, expect, it } from "vitest";
import { L } from "@/lib/i18n";
import type { Course, Eat, Spot, Stay, Theme } from "./types";
import { composeCourse } from "./course-compose";

const theme: Theme = {
  id: "east-sea-sunrise",
  title: L("동해 일출·해변 드라이브", "East Sea Sunrise Drive"),
  subtitle: L(""),
  tag: L("해변"),
  region: L("강릉 · 속초"),
  hue: 220,
  duration: L("1박 2일"),
  pace: L("느긋한 드라이브"),
  spotCount: 3,
  mood: [L("바다"), L("일출"), L("커피")],
  blurb: L(""),
};

function spot(
  id: string,
  region: string,
  congestion: Spot["congestion"],
  suitability: number,
  tags: string[],
  coords?: { lat: number; lon: number },
): Spot {
  return {
    id,
    name: L(id),
    type: L(tags[0] ?? "관광지"),
    region: L(region),
    congestion,
    suitability,
    weather: { tempC: 15, desc: L("맑음"), icon: "sun" },
    air: L("좋음"),
    rating: 4.5,
    reviewCount: 10,
    tags: tags.map((t) => L(t)),
    ...coords,
  };
}

const busyBeach = spot("anmok-beach", "강릉", "busy", 62, ["바다", "커피"], { lat: 37.7713, lon: 128.9472 });
const quietBeach = spot("sacheon-beach", "강릉", "calm", 88, ["바다", "한적"], { lat: 37.8368, lon: 128.8782 });
const farBeach = spot("far-beach", "삼척", "calm", 99, ["바다", "한적"], { lat: 37.289, lon: 129.17 });
const port = spot("dongmyeong-port", "속초", "calm", 84, ["항구", "로컬"], { lat: 38.2114, lon: 128.5998 });

const eats: Eat[] = [
  { id: "e-gangneung", name: L("강릉 밥집"), type: L("로컬"), price: "₩", rating: 4.6, region: L("강릉") },
  { id: "e-sokcho", name: L("속초 밥집"), type: L("로컬"), price: "₩", rating: 4.8, region: L("속초") },
];

const stays: Stay[] = [
  { id: "stay-gangneung", name: L("강릉 숙소"), type: L("호텔"), price: L("₩100,000/박"), rating: 4.4, region: L("강릉") },
  { id: "stay-sokcho", name: L("속초 숙소"), type: L("호텔"), price: L("₩120,000/박"), rating: 4.9, region: L("속초") },
];

const baseCourse: Course = {
  themeId: "east-sea-sunrise",
  title: L("해변 템플릿"),
  dayCount: 1,
  items: [
    { kind: "spot", day: 1, time: "10:00", refId: "anmok-beach", durationMin: 90 },
    { kind: "eat", day: 1, time: "12:30", refId: "e-sokcho" },
    { kind: "spot", day: 1, time: "14:00", refId: "dongmyeong-port", durationMin: 60 },
  ],
};

describe("composeCourse", () => {
  it("혼잡한 템플릿 스팟을 같은 테마 대체 후보로 교체한다", () => {
    const course = composeCourse({
      theme,
      baseCourse,
      spots: [busyBeach, quietBeach, port],
      eats,
      stays,
      alternativesBySpot: { "anmok-beach": [quietBeach] },
    });

    expect(course).not.toBeNull();
    expect(course!.items.find((it) => it.time === "10:00")?.refId).toBe("sacheon-beach");
    expect(course!.items.map((it) => it.refId)).not.toContain("anmok-beach");
    expect(course!.altNote?.ko).toContain("코스 생성 엔진");
  });

  it("식당은 같은 날 스팟 권역에 맞춰 다시 고른다", () => {
    const course = composeCourse({
      theme,
      baseCourse,
      spots: [busyBeach, quietBeach, port],
      eats,
      stays,
      alternativesBySpot: { "anmok-beach": [quietBeach] },
    });

    expect(course!.items.find((it) => it.kind === "eat")?.refId).toBe("e-gangneung");
  });

  it("대체 후보 점수가 높아도 원래 장소에서 너무 멀면 가까운 후보를 우선한다", () => {
    const course = composeCourse({
      theme,
      baseCourse,
      spots: [busyBeach, quietBeach, farBeach, port],
      eats,
      stays,
      alternativesBySpot: { "anmok-beach": [farBeach, quietBeach] },
    });

    expect(course!.items.find((it) => it.time === "10:00")?.refId).toBe("sacheon-beach");
  });

  it("점수가 높은 후보라도 하루 동선에서 크게 돌아가면 낮춘다", () => {
    const routeBase: Course = {
      ...baseCourse,
      items: [
        { kind: "spot", day: 1, time: "10:00", refId: "anmok-beach", durationMin: 60 },
        { kind: "spot", day: 1, time: "14:00", refId: "dongmyeong-port", durationMin: 60 },
      ],
    };
    const nearLowScore = spot("near-route-beach", "강릉", "calm", 78, ["바다", "한적"], { lat: 37.8368, lon: 128.8782 });
    const farHighScore = spot("far-detour-beach", "삼척", "calm", 96, ["바다", "한적"], { lat: 37.289, lon: 129.17 });

    const course = composeCourse({
      theme,
      baseCourse: routeBase,
      spots: [busyBeach, nearLowScore, farHighScore, port],
      eats,
      stays,
      alternativesBySpot: { "anmok-beach": [farHighScore, nearLowScore] },
    });

    expect(course!.items.find((it) => it.time === "10:00")?.refId).toBe("near-route-beach");
  });

  it("baseCourse 가 없어도 후보 풀에서 간단한 코스를 생성한다", () => {
    const course = composeCourse({
      theme,
      spots: [busyBeach, quietBeach, port],
      eats,
      stays,
      dayCount: 1,
    });

    expect(course).not.toBeNull();
    expect(course!.items.some((it) => it.kind === "spot")).toBe(true);
    expect(course!.items.some((it) => it.kind === "eat")).toBe(true);
    expect(course!.title.ko).toContain("맞춤 코스");
  });

  it("새 코스 생성에서도 연속 이동시간이 긴 후보를 낮춘다", () => {
    const pyeongchangHighScore = spot("pyeongchang-detour", "평창", "calm", 100, ["바다", "전망"], { lat: 37.3705, lon: 128.3902 });
    const gangneungNext = spot("gangneung-next", "강릉", "calm", 78, ["바다", "한적"], { lat: 37.8368, lon: 128.8782 });
    const course = composeCourse(
      {
        theme,
        spots: [busyBeach, pyeongchangHighScore, gangneungNext, port],
        eats,
        stays,
        dayCount: 1,
      },
      { days: 1, maxSpotsPerDay: 2, startRegion: "강릉" },
    );

    const spotRefs = course!.items.filter((it) => it.kind === "spot").map((it) => it.refId);
    expect(spotRefs).toContain("gangneung-next");
    expect(spotRefs).not.toContain("pyeongchang-detour");
  });

  it("days 와 calm pace 조건은 하루 스팟 수를 줄인다", () => {
    const course = composeCourse(
      {
        theme,
        spots: [busyBeach, quietBeach, farBeach, port],
        eats,
        stays,
      },
      { days: 1, pace: "calm" },
    );

    expect(course!.dayCount).toBe(1);
    expect(course!.items.filter((it) => it.kind === "spot")).toHaveLength(2);
  });

  it("startRegion 조건은 같은 권역 후보를 우선한다", () => {
    const gangneung = spot("gangneung-calm", "강릉", "calm", 80, ["바다"], { lat: 37.77, lon: 128.94 });
    const sokcho = spot("sokcho-calm", "속초", "calm", 86, ["바다"], { lat: 38.2, lon: 128.59 });
    const course = composeCourse(
      {
        theme,
        spots: [sokcho, gangneung],
        eats,
        stays,
        dayCount: 1,
      },
      { startRegion: "강릉" },
    );

    expect(course!.items.find((it) => it.kind === "spot")?.refId).toBe("gangneung-calm");
  });
});
