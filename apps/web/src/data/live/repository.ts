// ─────────────────────────────────────────────
// LiveRepository — DB + 실데이터 기반 구현.
//
// 설계 원칙:
//   - 런타임 카탈로그는 DB(spot_profile/course_template/course_template_item)에서 읽는다.
//   - 관광지(Spot)는 DB 기본값 위에 실데이터를 보강한다:
//       · 기상청 단기예보 → weather
//       · 에어코리아 → air
//       · scoreSuitability(혼잡+날씨+대기질) → suitability + 사유(description)
//       · (contentId 확정 시) TourAPI detailCommon2 → 개요/주소 보강
//   - 외부 API 실패 시 DB 기본값을 유지한다. mock/seed Repository 로는 폴백하지 않는다.
//   - 단기 TTL 캐시로 동적 호출 횟수 절감 (요청 폭주 방지).
//
// 화면은 Repository 인터페이스만 보므로 이 교체로 코드 수정이 없다.
// ─────────────────────────────────────────────

import type { Repository, SpotQueryOptions } from "@/domain/repository";
import type {
  AuthProvider,
  Companion,
  Course,
  CourseItem,
  Eat,
  Grade,
  Pace,
  Review,
  SamplePrompt,
  Spot,
  Stay,
  ThemeMatch,
  User,
  Visit,
} from "@/domain/types";
import { requireDb } from "@/server/db";
import {
  fetchDefaultCourseTemplate,
  fetchSpotProfile,
  fetchSpotProfiles,
  fetchSpotProfilesForTheme,
  fetchTheme,
  fetchThemes,
  saveSpotProfileImageUrl,
} from "@/server/db/course-catalog";
import {
  computeStats,
  fetchOnboardingPreference,
  fetchReviews,
  fetchSavedThemeIds,
  fetchUserProfile,
  fetchVisits,
  setSavedTheme,
} from "@/server/db/user-data";
import { scoreSuitability } from "@/domain/scoring";
import { estimateCongestion } from "@/domain/congestion";
import { reorderSpotsByCongestion, type ScheduledSpot } from "@/domain/course-reorder";
import { composeCourse, type ComposeCourseOptions } from "@/domain/course-compose";
import { getWeatherByCoords } from "@/server/public-api/kma";
import { getAirForStation } from "@/server/public-api/airkorea";
import { getItemDetail, listGangwonItems } from "@/server/public-api/tourapi";
import { REGIONS, type RegionKey } from "@/server/public-api/regions";
import { apiCache } from "@/server/cache";
import { createLogger } from "@/server/log";
import { buildTravelTimeLookup } from "@/server/routing/travel-time";
import { L, type LocalizedText } from "@/lib/i18n";
import { buildTools } from "@/server/agent/tools";
import { planCourse, planItinerary } from "@/server/agent/planner";
import { courseProviderFromEnv, itineraryProviderFromEnv } from "@/server/agent/llm";
import type { AgentStep, SpotMeta, ToolContext } from "@/server/agent/types";
import { getSpotMapping } from "./spot-mapping";

const log = createLogger("repo");

// ── 영속 TTL 캐시 (메모리+파일, server/cache.ts) ──
const TTL_MS = 10 * 60 * 1000; // 동적 데이터(날씨/대기질) 10분
const DAY_MS = 24 * 60 * 60 * 1000; // 관광 상세 24시간
const cached = apiCache.cached;

/** 서버 TZ 무관하게 KST 벽시계를 로컬 필드로 갖는 Date. */
function nowKst(): Date {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), k.getUTCHours(), k.getUTCMinutes());
}

/** "HH:MM" → 분(정렬용). 파싱 실패 시 720(정오). */
function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return Number.isFinite(h) ? (h as number) * 60 + (Number.isFinite(m) ? (m as number) : 0) : 720;
}

function poiNamesFromTrace(trace: AgentStep[]): string[] {
  const step = [...trace].reverse().find((s) => s.tool === "search_pois" && s.ok);
  if (!Array.isArray(step?.result)) return [];
  return step.result
    .map((p) => (typeof (p as { name?: unknown }).name === "string" ? (p as { name: string }).name : undefined))
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
}

function routeCoordsFromSpots(spots: Spot[]) {
  return spots
    .filter((spot): spot is Spot & { lat: number; lon: number } => typeof spot.lat === "number" && typeof spot.lon === "number")
    .map((spot) => ({ lat: spot.lat, lon: spot.lon, region: spot.region.ko }));
}

/**
 * 에이전트 trace 의 reorder_by_congestion 결과들을 base 코스에 반영해 최종 Course 를 만든다(순수).
 * planItinerary 에 주입 — LLM 이 "어느 날을 정리할지" 정하면, 여기서 그 도구 결과를 코스에 적용한다.
 * (각 스팟은 refId/체류시간 유지, 더 한산한 시각 슬롯으로만 이동)
 */
function applyReorderTrace(base: Course, trace: AgentStep[], rationale: LocalizedText): Course {
  const items: CourseItem[] = base.items.map((it) => ({ ...it }));
  let changed = false;

  for (const s of trace) {
    if (s.tool !== "reorder_by_congestion" || !s.ok) continue;
    const r = s.result as { day?: number; changed?: boolean; order?: { refId: string; time: string }[] };
    if (!r?.changed || !Array.isArray(r.order)) continue;
    const timeFor = new Map(r.order.map((o) => [o.refId, o.time]));
    for (const it of items) {
      if (it.day === r.day && it.kind === "spot" && timeFor.has(it.refId)) {
        it.time = timeFor.get(it.refId) as string;
      }
    }
    changed = true;
  }

  const poiNames = poiNamesFromTrace(trace);
  const altNote =
    poiNames.length > 0
      ? L(
          `혼잡이 계속 높으면 같은 테마의 실시간 POI 후보(${poiNames.join(", ")})를 대체지로 검토할 수 있어요.`,
          `If crowding stays high, consider live POI alternatives in the same theme: ${poiNames.join(", ")}.`,
        )
      : base.altNote;

  if (!changed) return altNote === base.altNote ? base : { ...base, altNote };
  items.sort((a, b) => a.day - b.day || minutesOf(a.time) - minutesOf(b.time));
  return { ...base, items, altNote, reorderNote: rationale };
}

const REFERENCE_PACES: Pace[] = [
  { id: "calm", name: L("여유", "Calm"), desc: L("하루 장소 수를 줄이고 이동 여유를 둡니다.", "Fewer stops with more buffer time.") },
  { id: "balanced", name: L("균형", "Balanced"), desc: L("이동과 체류를 균형 있게 배치합니다.", "Balances travel and time on site.") },
  { id: "active", name: L("활동적", "Active"), desc: L("하루에 더 많은 장소를 방문합니다.", "Covers more stops per day.") },
];

const REFERENCE_COMPANIONS: Companion[] = [
  { id: "solo", name: L("혼자", "Solo") },
  { id: "couple", name: L("둘이", "Couple") },
  { id: "family", name: L("가족", "Family") },
];

const REFERENCE_GRADES: Grade[] = [
  { level: 1, name: L("새싹 여행자", "New traveler"), minVisits: 0 },
  { level: 2, name: L("강원 탐험가", "Gangwon explorer"), minVisits: 5 },
  { level: 3, name: L("에움길 마스터", "Eumgil master"), minVisits: 15 },
];

const AUTH_PROVIDERS: AuthProvider[] = [
  { id: "keycloak", label: L("Keycloak 통합 로그인", "Keycloak SSO"), bg: "#111827", fg: "#ffffff", border: "transparent" },
];

export class LiveRepository implements Repository {
  /** DB 스팟을 실시간 날씨/대기질/적합성으로 보강. 실패 시 DB 원본 반환. */
  private async enrich(spot: Spot): Promise<Spot> {
    const m = getSpotMapping(spot.id);
    if (!m) {
      log.log(`enrich ${spot.id} → db (no mapping)`);
      return spot;
    }

    try {
      const station = REGIONS[m.region].station;
      const [weather, air] = await Promise.all([
        cached(`wx:${spot.id}`, TTL_MS, () => getWeatherByCoords(m.lat, m.lon)),
        cached(`air:${m.region}`, TTL_MS, () => getAirForStation(station)),
      ]);

      // 정적 큐레이션 혼잡도를 인기 prior 로 두고, 현재 시각(KST)·날씨로 동적 혼잡 산출.
      const crowd = estimateCongestion({
        baseline: spot.congestion,
        kind: m.env,
        at: nowKst(),
        pop: weather.pop,
        pty: weather.pty,
      });

      const { suitability, reason } = scoreSuitability({
        congestion: crowd.level,
        pop: weather.pop,
        windMs: weather.windMs,
        pty: weather.pty,
        khaiGrade: air.khaiGrade,
        kind: m.env,
      });

      // contentId 가 확정된 경우에만 TourAPI 개요로 설명 보강
      let description = L(reason.ko, reason.en);
      let imageUrl = spot.imageUrl;
      let tourMark = "tour–";
      if (m.tourContentId) {
        const detail = await cached(`tour:${m.tourContentId}`, DAY_MS, () =>
          getItemDetail(m.tourContentId as string),
        );
        if (detail?.overview) {
          description = L(detail.overview);
          tourMark = "tour✓";
        } else {
          tourMark = "tour✗";
        }
        if (detail?.image) {
          imageUrl = detail.image;
          if (!spot.imageUrl) {
            try {
              await saveSpotProfileImageUrl(requireDb(), spot.id, detail.image);
            } catch (e) {
              log.warn(`image persist ${spot.id} → skipped (${e instanceof Error ? e.message : String(e)})`);
            }
          }
        }
      }

      log.log(
        `enrich ${spot.id} → live (wx✓ air✓ ${tourMark}) congestion=${crowd.level} suit=${suitability}`,
      );
      return {
        ...spot,
        congestion: crowd.level,
        crowdTip: crowd.tip,
        weather: { tempC: weather.tempC, desc: weather.desc, icon: weather.icon },
        air: air.grade,
        suitability,
        description,
        imageUrl,
      };
    } catch (e) {
      // 외부 데이터 실패 → DB 기본값 유지
      log.warn(`enrich ${spot.id} → db fallback (${e instanceof Error ? e.message : String(e)})`);
      return spot;
    }
  }

  async listThemes() {
    return fetchThemes(requireDb());
  }

  async getTheme(id: string) {
    return fetchTheme(requireDb(), id);
  }

  async getSamplePrompts(): Promise<SamplePrompt[]> {
    return [
      { text: L("부모님이랑 한적한 바다 보고 싶어", "Quiet seaside trip with my parents") },
      { text: L("비 오는 날에도 괜찮은 강원도 코스", "Gangwon route that works on rainy days") },
      { text: L("대중교통으로 갈 수 있는 숲길 추천", "Forest trail reachable by transit") },
    ];
  }

  async getSpot(id: string, options: SpotQueryOptions = {}): Promise<Spot | null> {
    const base = await fetchSpotProfile(requireDb(), id);
    if (!base) return null;
    return options.enrich === false ? base : this.enrich(base);
  }

  async listSpots(options: SpotQueryOptions = {}): Promise<Spot[]> {
    const base = await fetchSpotProfiles(requireDb());
    if (options.enrich === false) return base;
    return Promise.all(base.map((s) => this.enrich(s)));
  }

  async getAlternatives(spotId: string, options: SpotQueryOptions = {}): Promise<Spot[]> {
    const db = requireDb();
    const base = await fetchSpotProfile(db, spotId);
    if (!base) return [];
    const all = await fetchSpotProfiles(db);
    const baseRegion = base.region.ko;
    const candidates = all.filter((spot) => spot.id !== spotId && spot.region.ko === baseRegion).slice(0, 6);
    if (options.enrich === false) return candidates;
    return Promise.all(candidates.map((s) => this.enrich(s)));
  }

  /**
   * 테마 코스를 현재 혼잡 기준으로 정리한다 — 코스 플래닝 에이전트에 위임(getCourse 에이전트화).
   *
   * [학습 메모] LLM(heuristicItineraryProvider)은 "어느 날을 재정렬할지"를 오케스트레이션하고,
   * 실제 재배치 수치는 reorder_by_congestion 도구(순수함수)가 계산한다. planItinerary 는 그
   * 도구 결과(trace)를 base 코스에 반영(applyReorderTrace)할 뿐이다. 에이전트가 실패하면
   * 기존 결정형 재정렬(reorderCourseDeterministic)으로 무중단 폴백 → 화면은 늘 Course 를 받는다.
   */
  async getCourse(themeId: string, options?: ComposeCourseOptions): Promise<Course | null> {
    const base = await this.composeSeedCourse(themeId, options);
    if (!base) return base;

    try {
      const ctx = await this.buildAgentContext(options);
      const result = await planItinerary(
        { intent: `테마 ${themeId} 코스를 현재 혼잡 기준으로 정리`, lang: "ko", themeId, at: nowKst() },
        {
          llm: itineraryProviderFromEnv(),
          tools: buildTools(ctx),
          baseCourse: base,
          assemble: applyReorderTrace,
          fallback: async () => ({
            course: await this.reorderCourseDeterministic(themeId, base),
            rationale: L(
              "지금 혼잡 기준으로 한산한 시간대에 맞춰 장소 순서를 조정했어요.",
              "Reordered stops to quieter time slots based on current crowding.",
            ),
          }),
        },
      );
      log.log(`getCourse ${themeId} → ${result.source} steps=${result.trace.length}`);
      return result.course;
    } catch {
      return base;
    }
  }

  /**
   * 코스 생성 MVP — DB/시드 후보 기반 결정형 조합.
   *
   * [학습 메모] LLM 없이도 가능한 핵심 단계다. 기존 정적 코스는 "시간 슬롯 템플릿"으로만 쓰고,
   * 실제 항목은 테마·혼잡·대체지·권역 기준으로 다시 고른다. 이후 DB 테이블이 생기면
   * 여기서 읽는 후보 풀만 DB 쿼리로 바꾸고 `composeCourse` 순수 함수는 그대로 둔다.
   */
  private async composeSeedCourse(themeId: string, options?: ComposeCourseOptions): Promise<Course | null> {
    const db = requireDb();
    const [theme, baseCourse, spots] = await Promise.all([
      fetchTheme(db, themeId),
      fetchDefaultCourseTemplate(db, themeId),
      fetchSpotProfilesForTheme(db, themeId),
    ]);
    if (!theme) return null;

    const spotIds = [...new Set((baseCourse?.items ?? []).filter((it) => it.kind === "spot").map((it) => it.refId))];
    const altEntries: [string, Spot[]][] = await Promise.all(
      spotIds.map(async (id) => {
        const dbAlternatives = spots.filter((spot) => spot.id !== id);
        return [id, dbAlternatives];
      }),
    );
    const alternativesBySpot = Object.fromEntries(altEntries);
    const travelSpots = [...spots, ...altEntries.flatMap(([, alternatives]) => alternatives)];
    const travelTimeLookup = await buildTravelTimeLookup(routeCoordsFromSpots(travelSpots), {
      mode: options?.transport ?? "car",
    });

    return composeCourse({
      theme,
      baseCourse,
      spots,
      eats: [],
      stays: [],
      alternativesBySpot,
    }, { ...options, travelTimeLookup });
  }

  /**
   * 결정형 코스 재정렬(에이전트 폴백). 하루별 스팟을 혼잡 최소가 되도록 시각 슬롯에 재배치.
   * 네트워크 불필요(시간대 곡선=인기 prior×장소 성격). 변경 없으면 base 그대로 반환.
   */
  private async reorderCourseDeterministic(themeId: string, base: Course): Promise<Course> {
    const at = nowKst();
    const items: CourseItem[] = base.items.map((it) => ({ ...it }));
    const days = [...new Set(items.map((it) => it.day))];
    let changed = false;

    for (const day of days) {
      const spotItems = items.filter((it) => it.day === day && it.kind === "spot");
      if (spotItems.length < 2) continue;

      const scheduled: ScheduledSpot[] = [];
      for (const it of spotItems) {
        const baseSpot = await fetchSpotProfile(requireDb(), it.refId);
        const env = getSpotMapping(it.refId)?.env ?? "inland";
        const { hourly } = estimateCongestion({ baseline: baseSpot?.congestion ?? "moderate", kind: env, at });
        scheduled.push({ refId: it.refId, time: it.time, hourly });
      }

      const res = reorderSpotsByCongestion(scheduled);
      if (!res.changed) continue;
      changed = true;
      const timeFor = new Map(res.order.map((o) => [o.refId, o.time]));
      for (const it of spotItems) it.time = timeFor.get(it.refId) ?? it.time;
    }

    if (!changed) return base;
    items.sort((a, b) => a.day - b.day || minutesOf(a.time) - minutesOf(b.time));
    return {
      ...base,
      items,
      reorderNote: L(
        "지금 혼잡 기준으로 한산한 시간대에 맞춰 장소 순서를 조정했어요.",
        "Reordered stops to quieter time slots based on current crowding.",
      ),
    };
  }

  // ───────────────────────────────────────────
  // 사용자 데이터 (Phase 4) — Keycloak 세션→앱 DB.
  //
  // [설계 메모] Keycloak 이 사용자 원장과 세션을 책임진다. 앱은 auth() 세션의 `user.id`
  // (OIDC subject/sub)를 받아 서비스 데이터의 user_id 로만 쓴다. 즉 앱 DB 는 인증 DB 가 아니라
  // 도메인 DB 다. DB 가 없으면 requireDb() 가 명확히 실패하고, 로그인하지 않았으면 사용자별
  // 데이터는 빈 상태(null/[])로 반환한다.
  // ───────────────────────────────────────────

  /** 현재 세션 사용자. */
  private async sessionUser(): Promise<{ id: string; name?: string | null; email?: string | null; image?: string | null } | null> {
    try {
      const { auth } = await import("@/server/auth");
      const session = await auth();
      const user = session?.user as { id?: string; name?: string | null; email?: string | null; image?: string | null } | undefined;
      return user?.id ? { id: user.id, name: user.name, email: user.email, image: user.image } : null;
    } catch (e) {
      log.warn(`sessionUser → null (${e instanceof Error ? e.message : String(e)})`);
      return null;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    const sessionUser = await this.sessionUser();
    if (!sessionUser) return null;

    const db = requireDb();
    const [stats, preference, profile] = await Promise.all([
      computeStats(db, sessionUser.id),
      fetchOnboardingPreference(db, sessionUser.id),
      fetchUserProfile(db, sessionUser.id),
    ]);
    const visits = stats.visits;
    const level = visits >= 15 ? 3 : visits >= 5 ? 2 : 1;
    const currentGrade = REFERENCE_GRADES.find((g) => g.level === level) ?? REFERENCE_GRADES[0]!;
    const nextGrade = REFERENCE_GRADES.find((g) => g.level === level + 1) ?? REFERENCE_GRADES[REFERENCE_GRADES.length - 1]!;
    return {
      name: L(profile?.displayName || sessionUser.name || "여행자"),
      handle: sessionUser.id,
      provider: "keycloak",
      email: sessionUser.email ?? "",
      avatarUrl: sessionUser.image ?? "",
      bio: L(profile?.bio ?? ""),
      joined: L("가입 정보는 Keycloak에서 관리합니다.", "Account identity is managed by Keycloak."),
      level,
      grade: currentGrade.name,
      nextGrade: nextGrade.name,
      levelProgress: Math.min(100, Math.round((visits / 15) * 100)),
      interests: preference?.interestThemeIds ?? [],
      stats,
    };
  }

  async listReviews(): Promise<Review[]> {
    const uid = (await this.sessionUser())?.id;
    if (!uid) return [];
    return fetchReviews(requireDb(), uid);
  }

  async listVisits(): Promise<Visit[]> {
    const uid = (await this.sessionUser())?.id;
    if (!uid) return [];
    return fetchVisits(requireDb(), uid);
  }

  async listSavedThemeIds(): Promise<string[]> {
    const uid = (await this.sessionUser())?.id;
    if (!uid) return [];
    return fetchSavedThemeIds(requireDb(), uid);
  }

  async setThemeSaved(themeId: string, saved: boolean): Promise<void> {
    const uid = (await this.sessionUser())?.id;
    if (!uid) throw new Error("로그인이 필요합니다.");
    await setSavedTheme(requireDb(), uid, themeId, saved);
  }

  // ───────────────────────────────────────────
  // 에이전트 배선 (B단계) — 자연어 매칭을 Multi-step 에이전트에 위임한다.
  //
  // [학습 메모] Repository 인터페이스(matchThemes 시그니처)는 그대로다. 바뀐 건
  // "내부에서 누가 테마를 고르느냐"뿐 — LLM 에이전트(planCourse)가 도구를 호출해가며 고른다.
  // 에이전트가 실패하면 DB 테마 텍스트 기반 결정형 매칭으로 폴백한다.
  // 현재 LLM 자리는 env 로 선택한다. 기본은 키 없는 heuristic, EUMGIL_AGENT_LLM=openai 이면 실 LLM.
  // ───────────────────────────────────────────
  async matchThemes(query: string): Promise<ThemeMatch> {
    const ctx = await this.buildAgentContext();
    const result = await planCourse(
      { intent: query, lang: "ko", at: nowKst() },
      {
        llm: courseProviderFromEnv(),
        tools: buildTools(ctx),
        fallback: async () => {
          const m = await this.matchThemesDeterministic(query);
          return { primaryThemeId: m.primaryId, altThemeIds: m.altIds, rationale: L("DB 테마 텍스트 매칭") };
        },
      },
    );

    // 보조 테마(혼잡 분산용)는 DB 테마 텍스트 매칭으로 보강한다.
    const det = await this.matchThemesDeterministic(query);
    const primaryId = result.primaryThemeId || det.primaryId;
    const altSource = result.altThemeIds.length > 0 ? result.altThemeIds : det.altIds;
    const altIds = altSource.filter((id) => id && id !== primaryId).slice(0, 2);

    log.log(`matchThemes "${query}" → ${result.source} primary=${primaryId} steps=${result.trace.length}`);
    return { primaryId, altIds };
  }

  private async matchThemesDeterministic(query: string): Promise<ThemeMatch> {
    const themes = await this.listThemes();
    const q = query.trim().toLowerCase();
    const scored = themes
      .map((theme) => {
        const haystack = [
          theme.id,
          theme.title.ko,
          theme.title.en,
          theme.subtitle.ko,
          theme.tag.ko,
          theme.region.ko,
          theme.blurb.ko,
          ...theme.mood.map((m) => m.ko),
        ]
          .join(" ")
          .toLowerCase();
        const score = q
          .split(/\s+/)
          .filter(Boolean)
          .reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
        return { id: theme.id, score };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const primaryId = scored[0]?.id ?? "";
    return { primaryId, altIds: scored.slice(1, 3).map((item) => item.id) };
  }

  /**
   * 에이전트 도구가 데이터·공공 API 에 닿는 컨텍스트(포트)를 구성한다.
   * 정적 데이터(테마/코스/스팟 메타)는 DB에서, 동적 데이터(날씨/대기질/POI)는 공공 API
   * 클라이언트 + 캐시에서 가져온다. 도구 코드는 이 포트만 보므로 출처를 모른다.
   */
  private async buildAgentContext(options?: ComposeCourseOptions): Promise<ToolContext> {
    const [themes, baseSpots] = await Promise.all([this.listThemes(), fetchSpotProfiles(requireDb())]);

    // 매핑이 있는 스팟만 도구의 행동 대상으로 노출(좌표·권역·성격 필요).
    const spots: SpotMeta[] = [];
    for (const s of baseSpots) {
      const m = getSpotMapping(s.id);
      if (!m) continue;
      spots.push({ id: s.id, baseline: s.congestion, env: m.env, lat: m.lat, lon: m.lon, region: m.region });
    }

    return {
      themes,
      spots,
      getCourse: (themeId) => this.composeSeedCourse(themeId, options),
      weather: async (meta) => {
        const w = await cached(`wx:${meta.id}`, TTL_MS, () => getWeatherByCoords(meta.lat, meta.lon));
        return { tempC: w.tempC, pop: w.pop, windMs: w.windMs, pty: w.pty, desc: w.desc };
      },
      air: async (region) => {
        const info = REGIONS[region as RegionKey];
        if (!info) throw new Error(`알 수 없는 권역: ${region}`);
        const a = await cached(`air:${region}`, TTL_MS, () => getAirForStation(info.station));
        return { khaiGrade: a.khaiGrade, grade: a.grade };
      },
      searchPois: async (keyword) => {
        // listGangwonItems 는 지역기반 목록(키워드 검색 아님) → 받아온 뒤 제목으로 근사 필터.
        const items = await cached(`pois:list`, DAY_MS, () => listGangwonItems({ numOfRows: 30 }));
        const k = keyword.trim();
        const hit = k ? items.filter((it) => it.title.includes(k)) : items;
        return (hit.length > 0 ? hit : items).slice(0, 8).map((it) => ({ id: it.contentId, name: L(it.title) }));
      },
      now: () => nowKst(),
    };
  }

  async getEat(_id: string): Promise<Eat | null> {
    return null;
  }

  async getStay(_id: string): Promise<Stay | null> {
    return null;
  }

  async listEats(): Promise<Eat[]> {
    return [];
  }

  async listStays(): Promise<Stay[]> {
    return [];
  }

  async listGrades(): Promise<Grade[]> {
    return REFERENCE_GRADES;
  }

  async listPaces(): Promise<Pace[]> {
    return REFERENCE_PACES;
  }

  async listCompanions(): Promise<Companion[]> {
    return REFERENCE_COMPANIONS;
  }

  async listProviders(): Promise<AuthProvider[]> {
    return AUTH_PROVIDERS;
  }
}
