import { describe, expect, it } from "vitest";
import { normalizeDemand } from "./tourism-demand";

describe("관광공사 방문 예측", () => {
  it("동일 이름의 다른 지역·과거 날짜·빈 값·범위 밖 수치를 제외하고 날짜를 정렬한다", () => {
    const row = { tAtsNm: "안목해변", signguCd: "51150", baseYmd: "20260906", cnctrRate: "37.41" };
    const result = normalizeDemand(
      [
        row,
        { ...row, baseYmd: "20260905", cnctrRate: "0" },
        { ...row, signguCd: "11110" },
        { ...row, baseYmd: "20260904" },
        { ...row, baseYmd: "20260907", cnctrRate: "" },
        { ...row, baseYmd: "20260908", cnctrRate: "101" },
        { ...row, baseYmd: "20260931" },
      ],
      "안목해변",
      "51150",
      "20260905",
      "2026-09-05T00:00:00Z",
    );
    expect(result?.days).toEqual([
      { date: "2026-09-05", rate: 0 },
      { date: "2026-09-06", rate: 37.41 },
    ]);
  });
  it("누락된 관광지를 근처 관광지의 값으로 대체하지 않는다", () => {
    expect(
      normalizeDemand(
        [{ tAtsNm: "동명항", signguCd: "51210", baseYmd: "20260905", cnctrRate: "50" }],
        "속초항",
        "51210",
        "20260905",
        "",
      ),
    ).toBeUndefined();
  });
});
