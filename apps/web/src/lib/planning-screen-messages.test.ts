import { describe, expect, it } from "vitest";
import { planningScreenMessage, PLANNING_SCREEN_MESSAGES } from "./planning-screen-messages";
import { SCREEN_MESSAGES } from "./screen-messages";

describe("일정 화면 다국어 안내", () => {
  it("공통 사전과 중복하지 않고 모든 안내를 6개 외국어로 제공한다", () => {
    for (const [source, translations] of Object.entries(PLANNING_SCREEN_MESSAGES)) {
      expect(SCREEN_MESSAGES[source], source).toBeUndefined();
      expect(translations, source).toHaveLength(6);
      expect(
        translations.every((value) => value.trim().length > 0 && !/\p{Script=Hangul}/u.test(value)),
        source,
      ).toBe(true);
    }
  });
  it("일차·실제 날짜·소요 시간을 언어에 맞추고 앞뒤 여백을 보존한다", () => {
    expect(planningScreenMessage("  내 코스 저장  ", "fr")).toBe("  Enregistrer mon voyage  ");
    expect(planningScreenMessage("9일차", "zh-TW")).toBe("第9天");
    expect(planningScreenMessage("2026.09.12 · Day 7", "de")).toBe("2026.09.12 · Tag 7");
    expect(planningScreenMessage("Day 3 동선 지도", "ja")).toBe("3日目のルートマップ");
    expect(planningScreenMessage("1시간 35분", "fr")).toBe("1 h 35 min");
    expect(planningScreenMessage("10곳", "en")).toBe("10 stops");
  });
  it("날짜 축소 경고에서 실제 날짜와 장소 보존을 함께 알린다", () => {
    const source =
      "2026.09.12 · Day 7 외 2일에 장소가 남아 있어요. 종료일을 늘리거나 해당 장소를 기간 안으로 옮겨 주세요. 장소는 삭제되지 않았어요.";
    expect(planningScreenMessage(source, "en")).toBe(
      "Stops remain on 2026.09.12 · Day 7, and 2 more days. Extend the end date or move these stops into the travel period. Nothing was deleted.",
    );
    expect(planningScreenMessage(source, "ja")).toContain("2026.09.12 · 7日目、ほか2日");
    expect(planningScreenMessage(source, "zh-CN")).toContain("未删除任何地点。");
  });
  it("버튼 동작만 번역하고 장소 이름·사용자 입력을 임의로 바꾸지 않는다", () => {
    expect(planningScreenMessage("박수근미술관 위로", "en")).toBe("Move up: 박수근미술관");
    expect(planningScreenMessage("박수근미술관 예정 시각 해제", "de")).toBe(
      "Geplante Zeit löschen: 박수근미술관",
    );
    expect(planningScreenMessage("우리 가족 여름 여행", "fr")).toBeUndefined();
    expect(planningScreenMessage("내 코스 저장", "ko")).toBeUndefined();
  });
});
