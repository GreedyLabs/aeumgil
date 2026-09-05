// 에어코리아 대기질 정규화 테스트 — fetch 목.
// 실응답(2026-06-23 강원) 특징: stationName 에 "(강원)" 접미사, 값은 문자열.

import { afterEach, describe, expect, it, vi } from "vitest";
import { getAirForStation, listGangwonAir } from "./airkorea";

function mockFetchJson(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    })),
  );
}

const FIXTURE = {
  response: {
    header: { resultCode: "00" },
    body: {
      items: [
        { stationName: "중앙동(강원)", khaiGrade: "2", pm10Value: "26", pm10Grade: "1", pm25Value: "6" },
        { stationName: "옥천동", khaiGrade: "3", pm10Value: "55", pm10Grade: "2", pm25Value: "30" },
        { stationName: "고장난측정소", khaiGrade: "-", pm10Value: "-", pm25Value: "-" },
      ],
    },
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("listGangwonAir", () => {
  it("문자열 값을 숫자로 정규화하고 등급 라벨을 붙인다", async () => {
    mockFetchJson(FIXTURE);
    const list = await listGangwonAir();
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ khaiGrade: 2, pm10: 26, pm25: 6, station: "중앙동(강원)" });
    expect(list[0]!.grade.ko).toBe("보통");
    expect(list[2]!.pm10).toBeUndefined(); // "-" → undefined
  });
});

describe("getAirForStation", () => {
  it("서로 다른 권역의 동시 조회가 강원 전체 응답 1회를 공유한다", async () => {
    mockFetchJson(FIXTURE);
    const [a, b] = await Promise.all([getAirForStation("중앙동"), getAirForStation("옥천동")]);
    expect(a.station).toBe("중앙동(강원)");
    expect(b.station).toBe("옥천동");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("괄호 접미사를 무시하고 측정소를 매칭한다", async () => {
    mockFetchJson(FIXTURE);
    const a = await getAirForStation("중앙동"); // 응답은 "중앙동(강원)"
    expect(a.khaiGrade).toBe(2);
    expect(a.grade.ko).toBe("보통");
  });

  it("미일치 측정소는 유효 등급 평균으로 폴백한다", async () => {
    mockFetchJson(FIXTURE);
    const a = await getAirForStation("존재하지않는측정소");
    // 유효 등급 2,3 의 평균 → 반올림 3(나쁨)
    expect(a.khaiGrade).toBe(3);
    expect(a.station).toBeUndefined();
  });

  it("빈 측정소 힌트면 바로 평균 폴백", async () => {
    mockFetchJson(FIXTURE);
    const a = await getAirForStation("");
    expect(a.khaiGrade).toBeGreaterThan(0);
  });
});
