// 기상청 단기예보 정규화 테스트 — fetch 를 목으로 막아 네트워크 없이 검증.
// 픽스처는 실응답(2026-06-23 강릉) 모양: items.item[] 에 category/fcstValue.

import { afterEach, describe, expect, it, vi } from "vitest";
import { getVilageWeather } from "./kma";

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
    const w = await getVilageWeather(92, 132);
    expect(w.tempC).toBe(19); // 0900 의 TMP (1200=23 아님)
    expect(w.pop).toBe(60);
    expect(w.windMs).toBe(1.6);
    expect(w.pty).toBe(1);
    expect(w.sky).toBe(4);
  });

  it("강수형태(PTY=1)면 비 아이콘/설명을 준다", async () => {
    mockFetchJson(FIXTURE);
    const w = await getVilageWeather(92, 132);
    expect(w.icon).toBe("rain");
    expect(w.desc.ko).toBe("비");
  });

  it("응답 items 가 비면 에러를 던진다", async () => {
    mockFetchJson({ response: { body: { items: "" } } });
    await expect(getVilageWeather(92, 132)).rejects.toThrow();
  });
});
