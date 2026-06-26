// ─────────────────────────────────────────────
// MockRepository — 기존 프로토타입 데이터(design/data.ts)를
// 도메인 타입으로 정규화해 반환한다.
//
// design/data.ts 는 @ts-nocheck mock 이므로 경계에서 any 로 받아 매핑한다.
// 실데이터 구현이 들어오면 이 파일만 교체하면 된다.
// ─────────────────────────────────────────────

import { DATA } from "@/design/data";
import { L } from "@/lib/i18n";
import { matchThemes } from "@/domain/matching";
import type { Repository } from "@/domain/repository";
import type {
  AuthProvider,
  Companion,
  Congestion,
  Course,
  CourseItem,
  Eat,
  Grade,
  KeywordRule,
  Pace,
  Review,
  SamplePrompt,
  Spot,
  Stay,
  Theme,
  ThemeMatch,
  User,
  Visit,
} from "@/domain/types";

// design/data.ts 는 타입이 없으므로 경계에서 한 번만 느슨하게 받는다.
const D = DATA as unknown as Record<string, any>;

// ── 매퍼 ──────────────────────────────────
function mapTheme(t: any): Theme {
  return {
    id: t.id,
    title: L(t.ko, t.en),
    subtitle: L(t.subtitle_ko, t.subtitle_en),
    tag: L(t.tag_ko),
    region: L(t.region_ko),
    hue: t.hue,
    duration: L(t.duration),
    pace: L(t.pace),
    spotCount: t.spots,
    mood: (t.mood_ko ?? []).map((m: string) => L(m)),
    blurb: L(t.blurb_ko, t.blurb_en),
  };
}

function mapSpot(s: any): Spot {
  return {
    id: s.id,
    name: L(s.name_ko, s.name_en),
    type: L(s.type_ko, s.type_en),
    region: L(s.region_ko, s.region_en),
    congestion: s.congestion as Congestion,
    suitability: s.suitability,
    weather: {
      tempC: s.weather.temp,
      desc: L(s.weather.desc_ko, s.weather.desc_en),
      icon: s.weather.icon,
    },
    air: L(s.air),
    traffic: s.traffic_ko ? L(s.traffic_ko) : undefined,
    durationText: s.duration_ko ? L(s.duration_ko) : undefined,
    rating: s.rating,
    reviewCount: s.reviews,
    tags: (s.tags_ko ?? []).map((tag: string) => L(tag)),
    description: s.desc_ko ? L(s.desc_ko) : undefined,
  };
}

function mapEat(e: any): Eat {
  return {
    id: e.id,
    name: L(e.name_ko, e.name_en),
    type: L(e.type_ko),
    price: e.price,
    rating: e.rating,
    region: L(e.region_ko),
  };
}

function mapStay(s: any): Stay {
  return {
    id: s.id,
    name: L(s.name_ko, s.name_en),
    type: L(s.type_ko),
    price: L(s.price_ko),
    rating: s.rating,
    region: L(s.region_ko),
  };
}

function mapCourseItem(it: any): CourseItem {
  // design/data.ts 의 item.stay 는 spot/eat 에서는 체류 분(number),
  // 단독 숙박 항목에서는 stay id(string) 로 오버로딩되어 있다 → 여기서 분리.
  const durationMin = typeof it.stay === "number" ? it.stay : undefined;
  if (it.spot) return { kind: "spot", day: it.day, time: it.time, refId: it.spot, durationMin };
  if (it.eat) return { kind: "eat", day: it.day, time: it.time, refId: it.eat, durationMin };
  return { kind: "stay", day: it.day, time: it.time, refId: it.stay };
}

function mapCourse(c: any): Course {
  return {
    themeId: c.themeId,
    title: L(c.title_ko, c.title_en),
    dayCount: c.day_count,
    altNote: c.alt_note_ko ? L(c.alt_note_ko) : undefined,
    items: (c.items ?? []).map(mapCourseItem),
  };
}

function mapUser(u: any): User {
  return {
    name: L(u.name_ko, u.name_en),
    handle: u.handle,
    avatarUrl: u.avatar,
    provider: u.provider,
    email: u.email,
    bio: L(u.bio_ko, u.bio_en),
    joined: L(u.joined_ko, u.joined_en),
    level: u.level,
    grade: L(u.grade_ko, u.grade_en),
    nextGrade: L(u.nextGrade_ko, u.nextGrade_en),
    levelProgress: u.levelProgress,
    interests: u.interests ?? [],
    stats: u.stats,
  };
}

function mapReview(r: any): Review {
  return {
    id: r.id,
    spotId: r.spotId,
    rating: r.rating,
    date: r.date,
    text: L(r.text_ko),
    helpful: r.helpful,
  };
}

function mapGrade(g: any): Grade {
  return { level: g.lv, name: L(g.ko, g.en), minVisits: g.min };
}

function mapPace(p: any): Pace {
  return { id: p.id, name: L(p.ko, p.en), desc: p.desc_ko ? L(p.desc_ko) : undefined };
}

function mapCompanion(c: any): Companion {
  return { id: c.id, name: L(c.ko, c.en) };
}

function mapProvider(p: any): AuthProvider {
  return { id: p.id, label: L(p.label_ko, p.label_en), bg: p.bg, fg: p.fg, border: p.border };
}

/** 미로그인/DB부재 시 보여줄 저장 테마 시드(데모용 큐레이션 값). */
const SAVED_THEME_SEED = ["quiet-inland", "east-sea-sunrise", "cafe-viewpoint"];

// ── 구현 ──────────────────────────────────
export class MockRepository implements Repository {
  /** 데모용 저장 상태 — 프로세스 메모리(요청 간 공유, 재시작 시 초기화). */
  protected savedThemeIds: Set<string> = new Set(SAVED_THEME_SEED);

  async listThemes(): Promise<Theme[]> {
    return (D.THEMES as any[]).map(mapTheme);
  }

  async getTheme(id: string): Promise<Theme | null> {
    const t = (D.THEMES as any[]).find((x) => x.id === id);
    return t ? mapTheme(t) : null;
  }

  async getSamplePrompts(): Promise<SamplePrompt[]> {
    return (D.SAMPLE_PROMPTS as any[]).map((p) => ({ text: L(p.ko, p.en) }));
  }

  async matchThemes(query: string): Promise<ThemeMatch> {
    const rules = D.KEYWORD_MATCH as KeywordRule[];
    const themeIds = (D.THEMES as any[]).map((t) => t.id as string);
    return matchThemes(query, rules, themeIds);
  }

  async listSpots(): Promise<Spot[]> {
    return Object.values(D.SPOTS as Record<string, any>).map(mapSpot);
  }

  async getSpot(id: string): Promise<Spot | null> {
    const s = (D.SPOTS as Record<string, any>)[id];
    return s ? mapSpot(s) : null;
  }

  async getAlternatives(spotId: string): Promise<Spot[]> {
    const ids = (D.ALT_SPOTS as Record<string, string[]>)[spotId] ?? [];
    return ids
      .map((id) => (D.SPOTS as Record<string, any>)[id])
      .filter(Boolean)
      .map(mapSpot);
  }

  async getCourse(themeId: string): Promise<Course | null> {
    const c = (D.COURSES as Record<string, any>)[themeId];
    return c ? mapCourse(c) : null;
  }

  async getEat(id: string): Promise<Eat | null> {
    const e = (D.EATS as any[]).find((x) => x.id === id);
    return e ? mapEat(e) : null;
  }

  async getStay(id: string): Promise<Stay | null> {
    const s = (D.STAYS as any[]).find((x) => x.id === id);
    return s ? mapStay(s) : null;
  }

  async listEats(): Promise<Eat[]> {
    return (D.EATS as any[]).map(mapEat);
  }

  async listStays(): Promise<Stay[]> {
    return (D.STAYS as any[]).map(mapStay);
  }

  async getCurrentUser(): Promise<User | null> {
    return mapUser(D.USER);
  }

  async listReviews(): Promise<Review[]> {
    return (D.REVIEWS as any[]).map(mapReview);
  }

  async listVisits(): Promise<Visit[]> {
    return (D.VISITS as any[]).map((v) => ({
      spotId: v.spotId,
      date: v.date,
      congestionThen: v.congestionThen as Congestion,
    }));
  }

  async listSavedThemeIds(): Promise<string[]> {
    return [...this.savedThemeIds];
  }

  async setThemeSaved(themeId: string, saved: boolean): Promise<void> {
    if (saved) this.savedThemeIds.add(themeId);
    else this.savedThemeIds.delete(themeId);
  }

  async listGrades(): Promise<Grade[]> {
    return (D.GRADES as any[]).map(mapGrade);
  }

  async listPaces(): Promise<Pace[]> {
    return (D.PACES as any[]).map(mapPace);
  }

  async listCompanions(): Promise<Companion[]> {
    return (D.COMPANIONS as any[]).map(mapCompanion);
  }

  async listProviders(): Promise<AuthProvider[]> {
    return (D.PROVIDERS as any[]).map(mapProvider);
  }
}
