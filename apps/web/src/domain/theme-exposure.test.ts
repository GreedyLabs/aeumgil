import { describe, expect, it } from "vitest";
import { L } from "@/lib/i18n";
import type { Theme } from "./types";
import { orderDiscoverThemes, selectHomeThemes } from "./theme-exposure";

const regions = [
  "강릉",
  "속초",
  "춘천",
  "원주",
  "철원",
  "정선",
  "영월",
  "동해",
  "고성",
  "태백",
  "양구",
];
function theme(id: string, days: number, region: string, curated = false): Theme {
  return {
    id,
    title: L(id),
    subtitle: L("여행 안내"),
    tag: L("문화"),
    region: L(region),
    hue: 100,
    duration: L(`${days}일`),
    pace: L("균형"),
    spotCount: days * 3,
    mood: [L("전시")],
    blurb: L("여행 코스 소개"),
    imageUrl: "/test.jpg",
    ...(curated
      ? { sources: [{ title: "공식 관광 안내", url: "https://korean.visitkorea.or.kr/" }] }
      : {}),
  };
}
const catalog = [
  ...Array.from({ length: 115 }, (_, index) =>
    theme(`daytrip-${index}`, 1, regions[index % regions.length]!),
  ),
  ...Array.from({ length: 11 }, (_, index) =>
    theme(`journey-two-${index}`, 2, regions[index]!, true),
  ),
  ...Array.from({ length: 4 }, (_, index) =>
    theme(`journey-three-${index}`, 3, regions[index + 4]!, true),
  ),
  theme("journey-four-a", 4, "강릉 · 동해 · 삼척", true),
  theme("journey-four-b", 4, "원주 · 영월", true),
  theme("journey-five", 5, "정선 · 태백 · 동해", true),
  { ...theme("legacy-two-short", 2, "강릉"), spotCount: 1 },
];
const dayCount = (item: Theme) => Number(item.duration.ko.replace("일", ""));

describe("요청별 테마 노출", () => {
  it("같은 seed는 같은 배열을 만들고 입력이나 테마를 수정하지 않는다", () => {
    const before = JSON.stringify(catalog);
    expect(orderDiscoverThemes(catalog, "request-a")).toEqual(
      orderDiscoverThemes(catalog, "request-a"),
    );
    expect(selectHomeThemes(catalog, "request-a")).toEqual(selectHomeThemes(catalog, "request-a"));
    expect(JSON.stringify(catalog)).toBe(before);
  });

  it("실제 규모의 당일 다수 카탈로그에서도 첫 18개는 1~2박을 중심으로 배치한다", () => {
    for (let index = 0; index < 30; index++) {
      const ordered = orderDiscoverThemes(catalog, `request-${index}`);
      const first = ordered.slice(0, 18);
      expect(first.filter((item) => dayCount(item) === 1)).toHaveLength(4);
      expect(first.filter((item) => dayCount(item) >= 2).length).toBeGreaterThanOrEqual(12);
      expect(first.filter((item) => dayCount(item) === 2 || dayCount(item) === 3)).toHaveLength(12);
      expect(first.filter((item) => dayCount(item) >= 4)).toHaveLength(2);
      expect(first.every((item) => item.id !== "legacy-two-short")).toBe(true);
      for (const duration of [2, 3, 4, 5])
        expect(
          ordered.find((item) => dayCount(item) === duration)?.sources?.length,
        ).toBeGreaterThan(0);
    }
  });

  it("지역·기간 필터에서 찾을 모든 유효 테마가 중복 없이 남는다", () => {
    const input = [...catalog, catalog[0]!, { ...catalog[1]!, id: "empty", spotCount: 0 }];
    const result = orderDiscoverThemes(input, "complete");
    expect(result.map((item) => item.id).sort()).toEqual(catalog.map((item) => item.id).sort());
    expect(new Set(result.map((item) => item.id)).size).toBe(catalog.length);
  });

  it("seed가 바뀌면 첫 화면을 다양하게 보여 준다", () => {
    const discovery = new Set(
      Array.from({ length: 20 }, (_, index) =>
        orderDiscoverThemes(catalog, String(index))
          .slice(0, 6)
          .map((item) => item.id)
          .join(","),
      ),
    );
    const home = new Set(
      Array.from({ length: 20 }, (_, index) =>
        selectHomeThemes(catalog, String(index))
          .map((item) => item.id)
          .join(","),
      ),
    );
    expect(discovery.size).toBeGreaterThan(15);
    expect(home.size).toBeGreaterThan(15);
  });

  it("같은 권역만 연달아 노출하지 않고 홈 세 장도 가능한 다른 권역을 고른다", () => {
    const ample = Array.from({ length: 36 }, (_, index) =>
      theme(`regional-${index}`, 2, regions[index % regions.length]!, true),
    );
    const ordered = orderDiscoverThemes(ample, "regions");
    for (let i = 1; i < 18; i++) expect(ordered[i]!.region.ko).not.toBe(ordered[i - 1]!.region.ko);
    const home = selectHomeThemes(ample, "regions");
    expect(new Set(home.map((item) => item.region.ko)).size).toBe(3);
  });

  it("홈은 2일·3일을 한 장씩 포함하고 장기 여행은 소수 요청에서만 순환한다", () => {
    let longTripRequests = 0;
    for (let i = 0; i < 100; i++) {
      const result = selectHomeThemes(catalog, `home-${i}`);
      expect(result).toHaveLength(3);
      expect(dayCount(result[0]!)).toBe(2);
      expect(dayCount(result[1]!)).toBe(3);
      expect(result.every((item) => item.sources?.length && item.spotCount >= dayCount(item))).toBe(
        true,
      );
      if (dayCount(result[2]!) >= 4) longTripRequests++;
    }
    expect(longTripRequests).toBeGreaterThan(10);
    expect(longTripRequests).toBeLessThan(40);
  });

  it("원하는 기간·사진이 없는 작은 카탈로그에서도 없는 테마를 만들지 않는다", () => {
    const one = { ...theme("only", 1, "속초"), imageUrl: undefined };
    expect(orderDiscoverThemes([], "empty")).toEqual([]);
    expect(selectHomeThemes([], "empty")).toEqual([]);
    expect(selectHomeThemes([one], "small")).toEqual([one]);
  });
});
