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
  /** 편집 코스의 방문 조건과 공식 참고 자료. */
  planningNote?: LocalizedText;
  sources?: { title: string; url: string }[];
  /** 테마에 속한 실제 관광지의 대표 사진과 장소명. */
  imageUrl?: string;

  imageLabel?: LocalizedText;
}

/** 추천 예시 프롬프트 */
export interface SamplePrompt {
  text: LocalizedText;
}

export interface Festival {
  id: string;
  name: LocalizedText;
  startsOn: string;
  endsOn: string;
  address: string;
  imageUrl?: string;
}

export interface FestivalDetail {
  event: Festival;
  place: Spot;
  venue?: string;
  hours?: string;
  fees?: string;
  host?: string;
  phone?: string;
  homepage?: string;
  nearbySpots: Spot[];
  nearbyEats: Eat[];
}

export interface FestivalListing {
  status: "available" | "unavailable";
  items: Festival[];
}

/** 자연어 매칭 결과 */
export interface ThemeMatch {
  primaryId: string;
  /** 혼잡 분산/대안 제시용 보조 테마 */
  altIds: string[];
  /** 키워드 근거이며 확률·현재 혼잡도·접근성 판정이 아니다. */
  explanation?: {
    status: "matched" | "partial" | "unmatched";
    keywords: string[];
    excludedKeywords: string[];
    regions: string[];
    summary: LocalizedText;
    notice?: LocalizedText;
    /** 명시 조건이 동등한 후보에서 저장 취향을 참고했을 때만 제공한다. */
    preference?: LocalizedText;
  };
}

// ── 관광지 / POI ──────────────────────────
export interface Spot {
  sourceContentId?: string;
  address?: string;
  category?: string;
  id: string;
  name: LocalizedText;
  type: LocalizedText;
  region: LocalizedText;
  congestion: Congestion;
  /** DB 큐레이션 prior와 현재 추정을 분리한다. */
  baselineCongestion?: Congestion;
  themeIds?: string[];
  environment?: "beach" | "mountain" | "inland";
  crowdHourly?: { hour: number; index: number }[];
  conditions?: {
    weather: "available" | "unavailable";
    air: "available" | "unavailable";
    forecastAt?: string;
    airObservedAt?: string;
    airStation?: string;
    airScope?: "station" | "province";
    pm10?: number;
    pm25?: number;
  };
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
  /** 코스 생성/이동거리 근사용 좌표. 없으면 권역 기반 점수만 사용한다. */
  lat?: number;
  lon?: number;
  /** 실제 원천 이미지 URL. TourAPI firstimage 또는 운영 DB에 검증 저장된 URL만 사용한다. */
  imageUrl?: string;
  /** 출처와 이용 조건을 보존한 원본 사진. */
  photos?: { url: string; label: string; license: string }[];
  /** 안내 보유 여부이며, 휠체어 등 특정 조건의 이용 가능 판정이 아니다. */
  hasAccessibilityInfo?: boolean;
  accessibility?: { items: { key: string; label: string; value: string }[]; fetchedAt: string };
  visitInfo?: {
    hours?: string;
    closed?: string;
    fees?: string;
    parking?: string;
    phone?: string;
    address?: string;
  };
  /** 관광공사의 일별 방문 집중률 예측. 시간대별 자체 추정과 구분한다. */
  highways?: HighwayStatus[];
  uv?: { index: number; forecastAt: string; issuedAt: string };
  crowdForecast?: { place: string; fetchedAt: string; days: { date: string; rate: number }[] };
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
  imageUrl?: string;
  address?: string;
  telephone?: string;
  lat?: number;
  lon?: number;
}

export interface Stay {
  id: string;
  name: LocalizedText;
  type: LocalizedText;
  /** 1박 가격 표기 */
  price: LocalizedText;
  rating: number;
  region: LocalizedText;
  imageUrl?: string;
  address?: string;
  telephone?: string;
  lat?: number;
  lon?: number;
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
  /** 같은 날 이전 방문 장소(관광지·식당·숙소)에서의 예상 이동시간(분). */
  travelMinutes?: number;
}

export interface Course {
  /** 체험 시간과 지역 이동을 편집한 코스는 혼잡 추정만으로 순서를 바꾸지 않는다. */
  preserveStopOrder?: boolean;
  /** 저장 취향의 기본값까지 합친 실제 코스 생성 조건. */
  appliedOptions?: import("./course-compose").ComposeCourseOptions;
  preferenceNote?: LocalizedText;
  routeLegs?: import("./course-map").CourseRouteLeg[];
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
  /** 관심 분야의 안정 코드(topic:sea 등). */
  interests: string[];
  preference?: OnboardingPreference | null;
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

/** 특정 공개 표본일의 시군구별 방문 규모. 실시간 인원·관광객 수와 다르다. */
export interface RegionalVisitors {
  date: string;
  regions: { key: string; name: LocalizedText; domestic: number; foreign: number }[];
}

export interface HighwayStatus {
  routeCode: string;
  route: string;
  status: "current" | "stale" | "unavailable";
  segments: number;
  slowSegments: number;
  delayedSegments: number;
  staleSegments: number;
  unavailableSegments: number;
  observedAt?: string;
  details: HighwaySegment[];
}

export interface HighwaySegment {
  id: string;
  name: string;
  directionCode?: string;
  speed: number;
  observedAt: string;
}
