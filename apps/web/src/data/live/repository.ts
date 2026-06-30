// ─────────────────────────────────────────────
// LiveRepository — 실데이터 기반 구현 (DATA_SOURCE=live).
//
// 설계 원칙:
//   - 정적 큐레이션(테마/코스/식음·숙박/사용자/참조)은 MockRepository 를 그대로 상속.
//     (제안서: 테마·코스·키워드 규칙은 사람이 설계한 큐레이션 → API 불필요)
//   - 관광지(Spot)만 실데이터로 보강:
//       · 기상청 단기예보 → weather
//       · 에어코리아 → air
//       · scoreSuitability(혼잡+날씨+대기질) → suitability + 사유(description)
//       · (contentId 확정 시) TourAPI detailCommon2 → 개요/주소 보강
//   - 회복력: 외부 호출 실패 시 해당 스팟은 mock 값으로 폴백 (화면 무중단).
//   - 단기 TTL 캐시로 동적 호출 횟수 절감 (요청 폭주 방지).
//
// 화면은 Repository 인터페이스만 보므로 이 교체로 코드 수정이 없다.
// ─────────────────────────────────────────────

import type { Course, CourseItem, Review, Spot, ThemeMatch, User, Visit } from "@/domain/types";
import { getDb } from "@/server/db";
import { fetchDefaultCourseTemplate, fetchSpotProfile, fetchSpotProfilesForTheme } from "@/server/db/course-catalog";
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
import { MockRepository } from "../mock/repository";
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

function withSpotMappingCoords(spot: Spot): Spot {
  const mapping = getSpotMapping(spot.id);
  return mapping ? { ...spot, lat: mapping.lat, lon: mapping.lon } : spot;
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

export class LiveRepository extends MockRepository {
  /** mock 스팟을 실시간 날씨/대기질/적합성으로 보강. 실패 시 원본 반환. */
  private async enrich(spot: Spot): Promise<Spot> {
    const m = getSpotMapping(spot.id);
    if (!m) {
      log.log(`enrich ${spot.id} → mock (no mapping)`);
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
      };
    } catch (e) {
      // 외부 데이터 실패 → 큐레이션(mock) 값 유지
      log.warn(`enrich ${spot.id} → mock fallback (${e instanceof Error ? e.message : String(e)})`);
      return spot;
    }
  }

  override async getSpot(id: string): Promise<Spot | null> {
    const base = await super.getSpot(id);
    if (!base) return this.getDbSpotProfile(id);
    return this.enrich(base);
  }

  override async listSpots(): Promise<Spot[]> {
    const base = await super.listSpots();
    return Promise.all(base.map((s) => this.enrich(s)));
  }

  override async getAlternatives(spotId: string): Promise<Spot[]> {
    const base = await super.getAlternatives(spotId);
    return Promise.all(base.map((s) => this.enrich(s)));
  }

  /**
   * 테마 코스를 현재 혼잡 기준으로 정리한다 — 코스 플래닝 에이전트에 위임(getCourse 에이전트화).
   *
   * [학습 메모] LLM(heuristicItineraryProvider)은 "어느 날을 재정렬할지"를 오케스트레이션하고,
   * 실제 재배치 수치는 reorder_by_congestion 도구(순수함수)가 계산한다. planItinerary 는 그
   * 도구 결과(trace)를 base 코스에 반영(applyReorderTrace)할 뿐이다. 에이전트가 실패하면
   * 기존 결정형 재정렬(reorderCourseDeterministic)으로 무중단 폴백 → 화면은 늘 Course 를 받는다.
   */
  override async getCourse(themeId: string, options?: ComposeCourseOptions): Promise<Course | null> {
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
    const [theme, seedCourse, seedSpots, eats, stays] = await Promise.all([
      super.getTheme(themeId),
      super.getCourse(themeId),
      super.listSpots(),
      super.listEats(),
      super.listStays(),
    ]);
    if (!theme) return null;
    const baseCourse = (await this.getDbCourseTemplate(themeId)) ?? seedCourse;
    const dbSpots = await this.getDbSpotProfilesForTheme(themeId);
    const spots = dbSpots.length > 0 ? dbSpots : seedSpots.map(withSpotMappingCoords);

    const spotIds = [...new Set((baseCourse?.items ?? []).filter((it) => it.kind === "spot").map((it) => it.refId))];
    const altEntries: [string, Spot[]][] = await Promise.all(
      spotIds.map(async (id) => {
        const seedAlternatives = await super.getAlternatives(id);
        const dbAlternatives = dbSpots.length > 0 ? dbSpots.filter((spot) => spot.id !== id) : [];
        return [id, [...dbAlternatives, ...seedAlternatives.map(withSpotMappingCoords)]];
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
      eats,
      stays,
      alternativesBySpot,
    }, { ...options, travelTimeLookup });
  }

  private async getDbSpotProfilesForTheme(themeId: string): Promise<Spot[]> {
    const db = getDb();
    if (!db) return [];
    try {
      return await fetchSpotProfilesForTheme(db, themeId);
    } catch (e) {
      log.warn(`spot profiles ${themeId} → seed fallback (${e instanceof Error ? e.message : String(e)})`);
      return [];
    }
  }

  private async getDbSpotProfile(spotId: string): Promise<Spot | null> {
    const db = getDb();
    if (!db) return null;
    try {
      return await fetchSpotProfile(db, spotId);
    } catch (e) {
      log.warn(`spot profile ${spotId} → null (${e instanceof Error ? e.message : String(e)})`);
      return null;
    }
  }

  private async getDbCourseTemplate(themeId: string): Promise<Course | null> {
    const db = getDb();
    if (!db) return null;
    try {
      return await fetchDefaultCourseTemplate(db, themeId);
    } catch (e) {
      log.warn(`course template ${themeId} → seed fallback (${e instanceof Error ? e.message : String(e)})`);
      return null;
    }
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
        const baseSpot = await super.getSpot(it.refId); // mock(메모리) — 네트워크 없음
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
  // 사용자 데이터 (Phase 4) — Keycloak 세션→앱 DB. 미로그인/DB부재 시 mock 으로 무중단 폴백.
  //
  // [설계 메모] Keycloak 이 사용자 원장과 세션을 책임진다. 앱은 auth() 세션의 `user.id`
  // (OIDC subject/sub)를 받아 서비스 데이터의 user_id 로만 쓴다. 즉 앱 DB 는 인증 DB 가 아니라
  // 도메인 DB 다. DB 가 없거나 로그인하지 않았으면 기존 데모처럼 mock 으로 폴백한다.
  // ───────────────────────────────────────────

  /** 현재 세션 사용자 (로그인 없으면 null → 호출자가 mock 폴백). */
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

  override async getCurrentUser(): Promise<User | null> {
    const sessionUser = await this.sessionUser();
    const db = getDb();
    if (!sessionUser || !db) return super.getCurrentUser();

    // 신원(name/email/image)은 Keycloak 세션, 통계는 앱 DB, 큐레이션 필드는 mock 기본값.
    const base = (await super.getCurrentUser()) as User;
    const [stats, preference, profile] = await Promise.all([
      computeStats(db, sessionUser.id),
      fetchOnboardingPreference(db, sessionUser.id),
      fetchUserProfile(db, sessionUser.id),
    ]);
    return {
      ...base,
      name: profile?.displayName ? L(profile.displayName) : sessionUser.name ? L(sessionUser.name) : base.name,
      email: sessionUser.email ?? base.email,
      avatarUrl: sessionUser.image ?? base.avatarUrl,
      bio: profile ? L(profile.bio) : base.bio,
      interests: preference?.interestThemeIds ?? base.interests,
      stats,
    };
  }

  override async listReviews(): Promise<Review[]> {
    const uid = (await this.sessionUser())?.id;
    const db = getDb();
    if (!uid || !db) return super.listReviews();
    return fetchReviews(db, uid);
  }

  override async listVisits(): Promise<Visit[]> {
    const uid = (await this.sessionUser())?.id;
    const db = getDb();
    if (!uid || !db) return super.listVisits();
    return fetchVisits(db, uid);
  }

  override async listSavedThemeIds(): Promise<string[]> {
    const uid = (await this.sessionUser())?.id;
    const db = getDb();
    if (!uid || !db) return super.listSavedThemeIds();
    return fetchSavedThemeIds(db, uid);
  }

  override async setThemeSaved(themeId: string, saved: boolean): Promise<void> {
    const uid = (await this.sessionUser())?.id;
    const db = getDb();
    if (!uid || !db) return super.setThemeSaved(themeId, saved);
    await setSavedTheme(db, uid, themeId, saved);
  }

  // ───────────────────────────────────────────
  // 에이전트 배선 (B단계) — 자연어 매칭을 Multi-step 에이전트에 위임한다.
  //
  // [학습 메모] Repository 인터페이스(matchThemes 시그니처)는 그대로다. 바뀐 건
  // "내부에서 누가 테마를 고르느냐"뿐 — 기존엔 키워드 규칙(super.matchThemes)이,
  // 이제는 LLM 에이전트(planCourse)가 도구를 호출해가며 고른다. 에이전트가 실패하면
  // 같은 키워드 규칙으로 무중단 폴백하므로, 화면은 어느 경로든 동일한 ThemeMatch 를 받는다.
  // 현재 LLM 자리는 env 로 선택한다. 기본은 키 없는 heuristic, EUMGIL_AGENT_LLM=openai 이면 실 LLM.
  // ───────────────────────────────────────────
  override async matchThemes(query: string): Promise<ThemeMatch> {
    const ctx = await this.buildAgentContext();
    const result = await planCourse(
      { intent: query, lang: "ko", at: nowKst() },
      {
        llm: courseProviderFromEnv(),
        tools: buildTools(ctx),
        // 폴백: 에이전트 실패 시 기존 키워드 규칙(MockRepository.matchThemes) 그대로 사용.
        fallback: async () => {
          const m = await super.matchThemes(query);
          return { primaryThemeId: m.primaryId, altThemeIds: m.altIds, rationale: L("키워드 규칙 매칭") };
        },
      },
    );

    // 보조 테마(혼잡 분산용)는 결정형 매칭으로 보강한다.
    // (현재 heuristicProvider 는 대표 테마만 고름 → 대안은 키워드 규칙에서 가져옴)
    const det = await super.matchThemes(query);
    const primaryId = result.primaryThemeId || det.primaryId;
    const altSource = result.altThemeIds.length > 0 ? result.altThemeIds : det.altIds;
    const altIds = altSource.filter((id) => id && id !== primaryId).slice(0, 2);

    log.log(`matchThemes "${query}" → ${result.source} primary=${primaryId} steps=${result.trace.length}`);
    return { primaryId, altIds };
  }

  /**
   * 에이전트 도구가 데이터·공공 API 에 닿는 컨텍스트(포트)를 구성한다.
   * 정적 데이터(테마/코스/스팟 메타)는 mock(메모리)에서, 동적 데이터(날씨/대기질/POI)는
   * 공공 API 클라이언트 + 캐시에서 가져온다. 도구 코드는 이 포트만 보므로 출처를 모른다.
   */
  private async buildAgentContext(options?: ComposeCourseOptions): Promise<ToolContext> {
    const [themes, baseSpots] = await Promise.all([super.listThemes(), super.listSpots()]);

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
}
