import { describe, expect, it } from "vitest";
import { normalizeVisitors } from "./visitors";
describe("지역 방문 통계", () => {
  it("광역 합계·현지인·다른 날짜를 제외하고 소수 추정값을 유지한다", () => {
    const r = { signguCode: "51150", baseYmd: "20260801", touDivCd: "2", touNum: "190932.5" };
    expect(
      normalizeVisitors(
        [
          r,
          { ...r, touDivCd: "3", touNum: "1511.98" },
          { ...r, touDivCd: "1", touNum: "999999" },
          { ...r, signguCode: "51000", touNum: "999999" },
          { ...r, baseYmd: "20260802", touNum: "999999" },
        ],
        "20260801",
      ),
    ).toMatchObject({
      date: "2026-08-01",
      regions: [{ key: "gangneung", domestic: 190932.5, foreign: 1511.98 }],
    });
  });
  it("누락과 잘못된 값을 0명으로 바꾸지 않는다", () => {
    expect(
      normalizeVisitors(
        [{ signguCode: "51150", baseYmd: "20260801", touDivCd: "2", touNum: "" }],
        "20260801",
      ).regions,
    ).toEqual([]);
  });
});
