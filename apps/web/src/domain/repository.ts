// ─────────────────────────────────────────────
// Repository 인터페이스
//
// 화면·로직은 데이터 출처를 모른 채 이 인터페이스만 호출한다.
// Phase 0: MockRepository 구현.
// Phase 2+: 공공 API + DB 기반 구현으로 교체 (화면 수정 없이).
// 모든 메서드는 비동기 — 실제 구현은 네트워크/DB I/O 이기 때문.
// ─────────────────────────────────────────────

import type {
  AuthProvider,
  Companion,
  Course,
  Eat,
  Grade,
  Pace,
  Review,
  SamplePrompt,
  Spot,
  Stay,
  Theme,
  ThemeMatch,
  User,
  Visit,
} from "./types";

export interface Repository {
  // ── 테마 ──
  listThemes(): Promise<Theme[]>;
  getTheme(id: string): Promise<Theme | null>;
  getSamplePrompts(): Promise<SamplePrompt[]>;
  /** 자연어 입력 → 대표/보조 테마 */
  matchThemes(query: string): Promise<ThemeMatch>;

  // ── 관광지 ──
  listSpots(): Promise<Spot[]>;
  getSpot(id: string): Promise<Spot | null>;
  /** 혼잡 분산용 대체 관광지 */
  getAlternatives(spotId: string): Promise<Spot[]>;

  // ── 코스 / 식음·숙박 ──
  getCourse(themeId: string): Promise<Course | null>;
  getEat(id: string): Promise<Eat | null>;
  getStay(id: string): Promise<Stay | null>;
  listEats(): Promise<Eat[]>;
  listStays(): Promise<Stay[]>;

  // ── 사용자 ──
  /** 현재 로그인 사용자 (Phase 0: 고정 mock, 미로그인 시 null) */
  getCurrentUser(): Promise<User | null>;
  listReviews(): Promise<Review[]>;
  listVisits(): Promise<Visit[]>;

  // ── 참조 데이터 ──
  listGrades(): Promise<Grade[]>;
  listPaces(): Promise<Pace[]>;
  listCompanions(): Promise<Companion[]>;
  listProviders(): Promise<AuthProvider[]>;
}
