// 기획에서 확정한 테마 설명. 노출 여부·장소 수·일정은 DB 카탈로그가 결정한다.
import { L } from "@/lib/i18n";
import type { Theme } from "./types";
type ThemeCopy = Pick<Theme, "title" | "subtitle" | "tag" | "hue" | "mood" | "blurb">;
export const THEME_COPY: Record<string, ThemeCopy> = {
  "quiet-inland": {
    title: L("조용한 내륙 힐링"),
    subtitle: L("숲길에서 천천히 쉬어가는 여행"),
    tag: L("힐링"),
    hue: 155,
    mood: [L("한적함"), L("숲"), L("사색")],
    blurb: L("숲길과 고원의 풍경을 따라, 번잡한 일상에서 잠시 벗어나 보세요."),
  },
  "east-sea-sunrise": {
    title: L("동해 일출·해변 드라이브"),
    subtitle: L("해안선 따라 만나는 바다와 항구"),
    tag: L("해변"),
    hue: 220,
    mood: [L("바다"), L("일출"), L("드라이브")],
    blurb: L(
      "강원의 해변과 항구를 연결해요. 예상 혼잡도와 이동 조건에 맞춰 해안 여행을 계획해 보세요.",
    ),
  },
  "mountain-trek": {
    title: L("설악·오대산 산악 트레킹"),
    subtitle: L("산과 숲의 계절을 걷는 길"),
    tag: L("트레킹"),
    hue: 140,
    mood: [L("산"), L("트레킹"), L("단풍")],
    blurb: L("산악 풍경과 숲길을 즐기는 테마예요. 날씨와 체력에 맞춰 방문 일정을 조정해 보세요."),
  },
  "market-local": {
    title: L("전통시장·로컬 맛집 투어"),
    subtitle: L("항구와 시장에서 만나는 지역의 일상"),
    tag: L("미식"),
    hue: 60,
    mood: [L("시장"), L("로컬"), L("미식")],
    blurb: L("시장의 먹거리와 항구 골목을 함께 둘러보세요. 인근 상권을 연결하는 여행을 제안해요."),
  },
  "cafe-viewpoint": {
    title: L("감성 카페·뷰포인트"),
    subtitle: L("잠시 머물고 싶은 강원의 풍경"),
    tag: L("카페"),
    hue: 25,
    mood: [L("카페"), L("사진"), L("바다")],
    blurb: L("해변과 전망 좋은 장소를 연결해요. 마음에 드는 풍경 앞에서 여유롭게 머물러 보세요."),
  },
  "family-experience": {
    title: L("가족 체험 여행"),
    subtitle: L("함께 걷고 즐기는 강원 나들이"),
    tag: L("가족"),
    hue: 100,
    mood: [L("가족"), L("체험"), L("자연")],
    blurb: L("목장과 문화 명소를 중심으로 가족과 함께하는 여행을 준비해 보세요."),
  },
};

// 대표 사진은 해당 테마 소속 장소 중 분위기가 맞는 장소부터 선택한다.
export const THEME_COVER_PRIORITY: Record<string, string[]> = {
  "east-sea-sunrise": ["anmok-beach", "sacheon-beach", "dongmyeong-port"],
  "cafe-viewpoint": ["jumunjin-cafe", "anmok-beach", "sacheon-beach"],
  "mountain-trek": ["seorak-gwongeum", "woljeongsa-trail"],
  "quiet-inland": ["woljeongsa-trail", "daegwallyeong-sheep"],
  "family-experience": ["daegwallyeong-sheep", "ojukheon", "woljeongsa-trail"],
  "market-local": ["sokcho-market", "dongmyeong-port"],
};
