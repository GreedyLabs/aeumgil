// 기상청 단기예보 정규화 테스트 — fetch 를 목으로 막아 네트워크 없이 검증.
// 픽스처는 실응답(2026-06-23 강릉) 모양: items.item[] 에 category/fcstValue.

import { afterEach, describe, expect, it, vi } from "vitest";
import { getVilageWeather, weatherCacheKey, latestBase } from "./kma";

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

// 두 예보시점: 0900(이른 시점), 1200. 정규화는 가장 이른 시점을 골라야 한다.
const FIXTURE = {
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
    body: {
      items: {
        item: [
          { category: "TMP", fcstDate: "20260623", fcstTime: "0900", fcstValue: "19" },
          { category: "POP", fcstDate: "20260623", fcstTime: "0900", fcstValue: "60" },
          { category: "PTY", fcstDate: "20260623", fcstTime: "0900", fcstValue: "1" },
          { category: "SKY", fcstDate: "20260623", fcstTime: "0900", fcstValue: "4" },
          { category: "WSD", fcstDate: "20260623", fcstTime: "0900", fcstValue: "1.6" },
          { category: "TMP", fcstDate: "20260623", fcstTime: "1200", fcstValue: "23" },
          { category: "POP", fcstDate: "20260623", fcstTime: "1200", fcstValue: "20" },
        ],
      },
    },
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("getVilageWeather", () => {
  it("가장 이른 예보시점의 값으로 정규화한다", async () => {
    mockFetchJson(FIXTURE);
    const w = await getVilageWeather(92, 132, new Date("2026-06-23T09:30:00+09:00"));
    expect(w.tempC).toBe(19); // 0900 의 TMP (1200=23 아님)
    expect(w.pop).toBe(60);
    expect(w.windMs).toBe(1.6);
    expect(w.pty).toBe(1);
    expect(w.sky).toBe(4);
  });

  it("강수형태(PTY=1)면 비 아이콘/설명을 준다", async () => {
    mockFetchJson(FIXTURE);
    const w = await getVilageWeather(92, 132, new Date("2026-06-23T09:30:00+09:00"));
    expect(w.icon).toBe("rain");
    expect(w.desc.ko).toBe("비");
  });

  it("응답 items 가 비면 에러를 던진다", async () => {
    mockFetchJson({ response: { body: { items: "" } } });
    await expect(getVilageWeather(92, 132, new Date("2026-06-23T09:30:00+09:00"))).rejects.toThrow();
  });
});

describe("weatherCacheKey", () => {
  // 좌표는 data/live/spot-mapping.ts 실값 — 스팟 좌표가 바뀌면 함께 갱신.
  it("같은 KMA 격자의 스팟은 같은 키를 공유한다 (속초시장↔동명항, 약 1.1km)", () => {
    expect(weatherCacheKey(38.2040463, 128.5905776)).toBe(weatherCacheKey(38.2114151, 128.5998182));
  });

  it("다른 격자의 스팟은 다른 키를 갖는다 (속초시장↔대관령 양떼목장)", () => {
    expect(weatherCacheKey(38.2040463, 128.5905776)).not.toBe(weatherCacheKey(37.6889, 128.7178));
  });

  it("키는 격자 좌표로 구성된다 (강릉 기준점 92,132 — grid.test.ts 검증점과 동일)", () => {
    expect(weatherCacheKey(37.7519, 128.8761)).toBe("wx:v2:g92,132");
  });
});

describe("예보 시각·결측 회귀", () => {
  it("현재 시간에 맞는 예보를 선택하고 누락 필드를 0으로 만들지 않는다", async () => {
    mockFetchJson(FIXTURE);
    await expect(getVilageWeather(92, 132, new Date("2026-06-23T12:10:00+09:00"))).rejects.toThrow("WSD");
  });
  it("과거 예보만 있으면 현재 날씨로 표시하지 않는다", async () => {
    mockFetchJson(FIXTURE);
    await expect(getVilageWeather(92, 132, new Date("2026-06-24T12:00:00+09:00"))).rejects.toThrow("현재 시각");
  });
  it("자정 이전 발표와 발표 지연 시간을 KST 기준으로 처리한다", () => {
    expect(latestBase(new Date("2026-09-05T01:00:00+09:00"))).toEqual({ baseDate: "20260904", baseTime: "2300" });
    expect(latestBase(new Date("2026-09-05T05:10:00+09:00"))).toEqual({ baseDate: "20260905", baseTime: "0200" });
    expect(latestBase(new Date("2026-09-05T05:20:00+09:00"))).toEqual({ baseDate: "20260905", baseTime: "0500" });
  });
});
