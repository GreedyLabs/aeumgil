// ─────────────────────────────────────────────
// 에움길 도메인 타입
//
// 화면·로직·데이터 소스가 공유하는 단일 모델.
// mock / 공공 API / DB 어떤 구현이든 이 타입으로 정규화해서 반환한다.
// 모든 다국어 텍스트는 LocalizedText 로 보관한다.
// ─────────────────────────────────────────────

import type { LocalizedText } from "@/lib/i18n";

/** 혼잡도 수준 */
export type Congestion = "calm" | "moderate" | "busy";

/** 날씨 요약 */
export interface Weather {
  tempC: number;
  desc: LocalizedText;
  /** 아이콘 키 (예: "sun", "wind") */
  icon: string;
}

// ── 테마 ──────────────────────────────────
export interface Theme {
  id: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  /** 짧은 분류 태그 (예: 힐링/해변/미식) */
  tag: LocalizedText;
  region: LocalizedText;
  /** 테마 색상 hue (0~360) */
  hue: number;
  duration: LocalizedText;
  pace: LocalizedText;
  spotCount: number;
  mood: LocalizedText[];
  blurb: LocalizedText;
}

/** 추천 예시 프롬프트 */
export interface SamplePrompt {
  text: LocalizedText;
}

/** 자연어 매칭 결과 */
export interface ThemeMatch {
  primaryId: string;
  /** 혼잡 분산/대안 제시용 보조 테마 */
  altIds: string[];
}

// ── 관광지 / POI ──────────────────────────
export interface Spot {
  id: string;
  name: LocalizedText;
  type: LocalizedText;
  region: LocalizedText;
  congestion: Congestion;
  /** 혼잡 분산 안내 — 가장 한산한 추천 방문 시간대 (Phase 3 동적 산출, 없으면 미표시) */
  crowdTip?: LocalizedText;
  /** 방문 적합성 점수 0~100 (Phase 3에서 실시간 산출 예정) */
  suitability: number;
  weather: Weather;
  /** 대기질 등급 (예: 좋음/보통/나쁨) */
  air: LocalizedText;
  traffic?: LocalizedText;
  /** 권장 체류 시간 표기 (예: "1시간 30분") */
  durationText?: LocalizedText;
  rating: number;
  reviewCount: number;
  tags: LocalizedText[];
  description?: LocalizedText;
}

// ── 음식점 / 숙박 ─────────────────────────
export interface Eat {
  id: string;
  name: LocalizedText;
  type: LocalizedText;
  /** 가격대 표기 (예: ₩, ₩₩) */
  price: string;
  rating: number;
  region: LocalizedText;
}

export interface Stay {
  id: string;
  name: LocalizedText;
  type: LocalizedText;
  /** 1박 가격 표기 */
  price: LocalizedText;
  rating: number;
  region: LocalizedText;
}

// ── 코스 ──────────────────────────────────
export type CourseItemKind = "spot" | "eat" | "stay";

export interface CourseItem {
  kind: CourseItemKind;
  day: number;
  time: string;
  /** kind 에 따라 Spot/Eat/Stay 의 id */
  refId: string;
  /** spot/eat 의 권장 체류 시간(분) */
  durationMin?: number;
}

export interface Course {
  themeId: string;
  title: LocalizedText;
  dayCount: number;
  /** 혼잡 분산 메모 (예: "붐비는 안목 대신 사천진 중심") */
  altNote?: LocalizedText;
  /** 동적 혼잡 재정렬 안내 (Phase 3, LiveRepository 가 순서 조정 시 설정) */
  reorderNote?: LocalizedText;
  items: CourseItem[];
}

// ── 사용자 / 회원 ─────────────────────────
export interface UserStats {
  visits: number;
  saved: number;
  regions: number;
  reviews: number;
}

export interface User {
  name: LocalizedText;
  handle: string;
  avatarUrl: string;
  provider: string;
  email: string;
  bio: LocalizedText;
  joined: LocalizedText;
  level: number;
  grade: LocalizedText;
  nextGrade: LocalizedText;
  /** 다음 등급까지 진행률 (%) */
  levelProgress: number;
  /** 관심 테마 id 목록 */
  interests: string[];
  stats: UserStats;
}

export interface OnboardingPreference {
  interestThemeIds: string[];
  paceId: string;
  companionId: string;
  updatedAt?: string;
}

export interface Grade {
  level: number;
  name: LocalizedText;
  /** 등급 진입 최소 방문 수 */
  minVisits: number;
}

export interface Review {
  id: string;
  spotId: string;
  rating: number;
  date: string;
  text: LocalizedText;
  helpful: number;
}

export interface Visit {
  /** DB 방문 기록 id. mock seed 에는 없을 수 있다. */
  id?: string;
  spotId: string;
  date: string;
  congestionThen: Congestion;
}

// ── 온보딩 / 인증 참조 데이터 ──────────────
export interface Pace {
  id: string;
  name: LocalizedText;
  desc?: LocalizedText;
}

export interface Companion {
  id: string;
  name: LocalizedText;
}

export interface AuthProvider {
  id: string;
  label: LocalizedText;
  bg: string;
  fg: string;
  border: string;
}

/** 자연어 → 테마 매칭 규칙 */
export interface KeywordRule {
  keywords: string[];
  themeId: string;
}
