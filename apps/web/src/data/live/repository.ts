import { fetchFestivalDetail } from "@/server/tourism/festival";
import { GANGWON_REGIONS } from "@/domain/place-search";
import { getHighways } from "@/server/public-api/highway";
import { personalCourseInput, type PersonalCourseInput } from "@/domain/personal-course";
import {
  fetchPersonalCourse,
  fetchPersonalCourses,
  savePersonalCourse,
  removePersonalCourse,
} from "@/server/db/personal-courses";
import { getAccessibility } from "@/server/public-api/accessibility";
import { getUvForRegion } from "@/server/public-api/living-weather";
import { getRegionalVisitors } from "@/server/public-api/visitors";
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

import type { Repository, SavedThemeRef, SpotQueryOptions } from "@/domain/repository";
import type {
  AuthProvider,
  Companion,
  Course,
  CourseItem,
  Eat,
  FestivalListing,
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
  searchSpotProfiles,
  fetchSpotProfilesForTheme,
  fetchTheme,
  fetchThemes,
  saveSpotProfileImageUrl,
} from "@/server/db/course-catalog";
import { fetchEat, fetchEats, fetchStay, fetchStays } from "@/server/db/commerce";
import {
  computeStats,
  fetchOnboardingPreference,
  fetchReviews,
  fetchSavedThemeIds,
  fetchSavedThemes,
  fetchUserProfile,
  fetchVisits,
  setSavedTheme,
} from "@/server/db/user-data";
import {
  INTENT_QUERY_MAX_LENGTH,
  matchThemeIdsByKeyword,
  normalizeIntentQuery,
} from "@/domain/matching";
import { THEME_KEYWORD_RULES } from "@/domain/theme-keywords";
import { courseMapStops } from "@/domain/course-map";
import { routingPortFromEnv, approximateDirectionsPort } from "@/server/routing/travel-time";
import { regionalThemeMatch } from "@/domain/regional-matching";
import { scoreSuitability } from "@/domain/scoring";
import { estimateCongestion } from "@/domain/congestion";
import { reorderSpotsByCongestion, type ScheduledSpot } from "@/domain/course-reorder";
import { scheduleCourse } from "@/domain/course-schedule";
import { composeCourse, type ComposeCourseOptions } from "@/domain/course-compose";
import { getWeatherByCoords, weatherCacheKey } from "@/server/public-api/kma";
import { getAirForStation } from "@/server/public-api/airkorea";
import {
  getItemDetail,
  listGangwonItems,
  searchGangwonKeyword,
  listGangwonFestivals,
} from "@/server/public-api/tourapi";
import { REGIONS, type RegionKey } from "@/server/public-api/regions";
import { apiCache } from "@/server/cache";
import { agentMatchLimiter, requestClientKey } from "@/server/rate-limit";
import { createLogger } from "@/server/log";
import { env } from "@/lib/env";
import { buildTravelTimeLookup } from "@/server/routing/travel-time";
import type { Coord } from "@/domain/travel-time";
import { L, type LocalizedText } from "@/lib/i18n";
import { buildTools } from "@/server/agent/tools";
import { planCourse, planItinerary } from "@/server/agent/planner";
import { courseProviderFromEnv, itineraryProviderFromEnv } from "@/server/agent/llm";
import type { AgentStep, SpotMeta, ToolContext } from "@/server/agent/types";
import { getSpotMapping } from "./spot-mapping";
import { getCrowdForecast } from "@/server/public-api/tourism-demand";
import { nowKst } from "./congestion-now";

const log = createLogger("repo");

// ── 영속 TTL 캐시 (메모리+파일, server/cache.ts) ──
// 30분: KMA 단기예보는 3시간 주기 발표, 에어코리아는 1시간 단위 측정이라
// 10분 TTL 은 원천 데이터 갱신 주기보다 잦았다(§3.2 쿼터 계산은 플랜 문서 참고).
const TTL_MS = 30 * 60 * 1000; // 동적 데이터(날씨/대기질) 30분
const DAY_MS = 24 * 60 * 60 * 1000; // 관광 상세 24시간
const MATCH_TTL_MS = 60 * 60 * 1000; // 자연어 매칭 결과(LLM 비용 방어) 1시간
const cached = apiCache.cached;

/** "HH:MM" → 분(정렬용). 파싱 실패 시 720(정오). */
function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return Number.isFinite(h) ? (h as number) * 60 + (Number.isFinite(m) ? (m as number) : 0) : 720;
}

function poiNamesFromTrace(trace: AgentStep[]): string[] {
  const step = [...trace].reverse().find((s) => s.tool === "search_pois" && s.ok);
  if (!Array.isArray(step?.result)) return [];
  return step.result
    .map((p) =>
      typeof (p as { name?: unknown }).name === "string" ? (p as { name: string }).name : undefined,
    )
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
}

function routeCoordsFromSpots(spots: Spot[]) {
  return spots
    .filter(
      (spot): spot is Spot & { lat: number; lon: number } =>
        typeof spot.lat === "number" && typeof spot.lon === "number",
    )
    .map((spot) => ({ lat: spot.lat, lon: spot.lon, region: spot.region.ko }));
}

function routeCoordOf(spot: Spot | undefined): Coord | null {
  if (!spot || typeof spot.lat !== "number" || typeof spot.lon !== "number") return null;
  return { lat: spot.lat, lon: spot.lon, region: spot.region.ko };
}

/**
 * [§3.3] 실호출 가치가 있는 좌표쌍만 추린다 — 전쌍(N×N)이 아니라
 * 코스 타임라인의 인접 구간 + 각 슬롯 후보(원본·대체지)↔인접 기본 스팟.
 * composeCourse 의 pickSpotForSlot 이 (prev, 후보)·(후보, next)만 조회하므로,
 * 그 조회 패턴을 그대로 미리 계산한다. 나머지 쌍은 조회 시 근사값으로 답한다.
 * 템플릿이 없으면(스크래치 조합) 후보 선택이 동적이므로 근사만 쓴다(빈 배열).
 */
function timelineApiPairs(
  baseCourse: Course | null,
  spots: Spot[],
  alternativesBySpot: Record<string, Spot[]>,
): [Coord, Coord][] {
  if (!baseCourse) return [];
  const byId = new Map(spots.map((s) => [s.id, s]));

  // composeFromTemplate 과 동일하게, 템플릿 항목 순서를 유지한 채 day 별 스팟 슬롯을 만든다.
  const slotsByDay = new Map<number, string[]>();
  for (const it of baseCourse.items) {
    if (it.kind !== "spot") continue;
    slotsByDay.set(it.day, [...(slotsByDay.get(it.day) ?? []), it.refId]);
  }

  const pairs: [Coord, Coord][] = [];
  for (const slots of slotsByDay.values()) {
    for (let i = 0; i < slots.length; i++) {
      const slotId = slots[i];
      if (!slotId) continue;
      const prev = routeCoordOf(byId.get(slots[i - 1] ?? ""));
      const next = routeCoordOf(byId.get(slots[i + 1] ?? ""));
      const candidates = [byId.get(slotId), ...(alternativesBySpot[slotId] ?? [])];
      for (const candidate of candidates) {
        const c = routeCoordOf(candidate);
        if (!c) continue;
        if (prev) pairs.push([prev, c]);
        if (next) pairs.push([c, next]);
      }
    }
  }
  return pairs;
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
    const r = s.result as {
      day?: number;
      changed?: boolean;
      order?: { refId: string; time: string }[];
    };
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
  {
    id: "calm",
    name: L("여유", "Calm"),
    desc: L("하루 장소 수를 줄이고 이동 여유를 둡니다.", "Fewer stops with more buffer time."),
  },
  {
    id: "balanced",
    name: L("균형", "Balanced"),
    desc: L("이동과 체류를 균형 있게 배치합니다.", "Balances travel and time on site."),
  },
  {
    id: "active",
    name: L("활동적", "Active"),
    desc: L("하루에 더 많은 장소를 방문합니다.", "Covers more stops per day."),
  },
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
  {
    id: "keycloak",
    label: L("Keycloak 통합 로그인", "Keycloak SSO"),
    bg: "#111827",
    fg: "#ffffff",
    border: "transparent",
  },
];

export class LiveRepository implements Repository {
  async getRegionalVisitors() {
    try {
      return await getRegionalVisitors();
    } catch {
      log.warn("지역 방문 통계 미확인");
      return null;
    }
  }
  async listFestivals(): Promise<FestivalListing> {
    if (!env.DATA_GO_KR_SERVICE_KEY) return { status: "unavailable", items: [] };
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const through = new Date(today.getTime() + 30 * DAY_MS);
    const fromKey = today.toISOString().slice(0, 10).replaceAll("-", "");
    const throughKey = through.toISOString().slice(0, 10).replaceAll("-", "");
    try {
      const items = await cached(`festivals:v2:${fromKey}`, 60 * 60 * 1000, () =>
        listGangwonFestivals(fromKey, throughKey),
      );
      return { status: "available", items };
    } catch {
      log.warn("강원 행사 정보 미확인");
      return { status: "unavailable", items: [] };
    }
  }
  /** 각 원천을 독립적으로 보강한다. 관광 상세 장애가 날씨·대기질을 지우지 않는다. */
  private async enrich(spot: Spot): Promise<Spot> {
    const m = getSpotMapping(spot.id);
    const lat = spot.lat ?? m?.lat;
    const lon = spot.lon ?? m?.lon;
    const region = m
      ? REGIONS[m.region]
      : Object.values(REGIONS).find((r) => spot.region.ko.includes(r.ko));
    const contentId = spot.sourceContentId ?? m?.tourContentId;
    const [wxResult, airResult, tourResult, demandResult, uvResult, accessibilityResult] =
      await Promise.allSettled([
        lat !== undefined && lon !== undefined && env.DATA_GO_KR_SERVICE_KEY
          ? cached(weatherCacheKey(lat, lon), TTL_MS, () => getWeatherByCoords(lat, lon))
          : Promise.resolve(undefined),
        region && env.DATA_GO_KR_SERVICE_KEY
          ? getAirForStation(region.station)
          : Promise.resolve(undefined),
        contentId && env.DATA_GO_KR_SERVICE_KEY
          ? cached(`tour:v3:${contentId}`, DAY_MS, () => getItemDetail(contentId))
          : Promise.resolve(null),
        getCrowdForecast(
          spot.id,
          region
            ? {
                name: spot.name.ko,
                district: `51${GANGWON_REGIONS.find((r) => r.key === region.key)?.code ?? ""}`,
              }
            : undefined,
        ),

        region ? getUvForRegion(region.key) : Promise.resolve(undefined),
        spot.hasAccessibilityInfo && contentId && env.DATA_GO_KR_SERVICE_KEY
          ? getAccessibility(contentId)
          : Promise.resolve(undefined),
      ]);
    const weather = wxResult.status === "fulfilled" ? wxResult.value : undefined;
    const air = airResult.status === "fulfilled" ? airResult.value : undefined;
    const detail = tourResult.status === "fulfilled" ? tourResult.value : undefined;
    for (const [name, result] of [
      ["날씨", wxResult],
      ["대기질", airResult],
      ["관광상세", tourResult],
    ] as const) {
      if (result.status === "rejected") log.warn(`enrich ${spot.id} ${name} 미확인`);
    }
    const uv = uvResult.status === "fulfilled" ? uvResult.value : undefined;
    const kind = spot.environment ?? m?.env ?? "inland";
    const crowd = estimateCongestion({
      baseline: spot.baselineCongestion ?? spot.congestion,
      kind,
      at: nowKst(),
      pop: weather?.pop,
      pty: weather?.pty,
    });
    const validAir = air && air.khaiGrade > 0 ? air : undefined;
    // 누락된 날씨를 맑음/대기질 좋음으로 가정해 높은 적합도를 만들지 않는다.
    const score =
      weather && validAir
        ? scoreSuitability({
            congestion: crowd.level,
            pop: weather.pop,
            windMs: weather.windMs,
            pty: weather.pty,
            khaiGrade: validAir.khaiGrade,
            kind,
            uvIndex: uv?.index,
          })
        : undefined;
    if (detail?.image && !spot.imageUrl) {
      try {
        await saveSpotProfileImageUrl(requireDb(), spot.id, detail.image);
      } catch {
        log.warn(`image persist ${spot.id} → skipped`);
      }
    }
    return {
      ...spot,
      congestion: crowd.level,
      crowdTip: crowd.tip,
      crowdHourly: crowd.hourly,
      weather: weather
        ? { tempC: weather.tempC, desc: weather.desc, icon: weather.icon }
        : spot.weather,
      air: validAir?.grade ?? spot.air,
      suitability: score?.suitability ?? spot.suitability,
      description: detail?.overview ? L(detail.overview) : spot.description,
      imageUrl: detail?.image || spot.imageUrl,
      uv,
      photos: detail?.photos,
      visitInfo: detail?.visitInfo,
      accessibility:
        accessibilityResult.status === "fulfilled" ? accessibilityResult.value : undefined,
      crowdForecast: demandResult.status === "fulfilled" ? demandResult.value : undefined,
      conditions: {
        weather: weather ? "available" : "unavailable",
        air: validAir ? "available" : "unavailable",
        forecastAt: weather?.forecastAt,
        airObservedAt: air?.observedAt,
        airStation: air?.station,
        airScope: air?.scope,
        pm10: air?.pm10,
        pm25: air?.pm25,
      },
    };
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

  async searchSpots(query: import("@/domain/place-search").PlaceSearchQuery = {}) {
    return searchSpotProfiles(requireDb(), query);
  }

  async listSpots(options: SpotQueryOptions = {}): Promise<Spot[]> {
    const base = await fetchSpotProfiles(requireDb());
    if (options.enrich !== true) return base;
    return Promise.all(base.map((s) => this.enrich(s)));
  }

  async getAlternatives(spotId: string, options: SpotQueryOptions = {}): Promise<Spot[]> {
    const db = requireDb();
    const base = await fetchSpotProfile(db, spotId);
    if (!base) return [];
    const all = await fetchSpotProfiles(db);
    const baseRegion = base.region.ko;
    const candidates = all
      .filter(
        (spot) =>
          spot.id !== spotId &&
          spot.region.ko === baseRegion &&
          (base.themeIds?.length
            ? spot.themeIds?.some((id) => base.themeIds!.includes(id))
            : spot.type.ko === base.type.ko),
      )
      .slice(0, 6);
    if (options.enrich === false) return candidates;
    const enriched = await Promise.all(candidates.map((s) => this.enrich(s)));
    const crowdRank = { calm: 0, moderate: 1, busy: 2 };
    return enriched.sort(
      (a, b) => crowdRank[a.congestion] - crowdRank[b.congestion] || b.suitability - a.suitability,
    );
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
    const spots = await fetchSpotProfilesForTheme(requireDb(), themeId);
    const finalize = async (course: Course): Promise<Course> => {
      const mode = options?.transport ?? "car";
      const scheduled = scheduleCourse(course, spots, mode);
      const spotMap = Object.fromEntries(spots.map((s) => [s.id, s]));
      const eatRows = await Promise.all(
        [...new Set(course.items.filter((i) => i.kind === "eat").map((i) => i.refId))].map((id) =>
          this.getEat(id).catch(() => null),
        ),
      );
      const stayRows = await Promise.all(
        [...new Set(course.items.filter((i) => i.kind === "stay").map((i) => i.refId))].map((id) =>
          this.getStay(id).catch(() => null),
        ),
      );
      const eats = Object.fromEntries(eatRows.flatMap((p) => (p ? [[p.id, p]] : [])));
      const stays = Object.fromEntries(stayRows.flatMap((p) => (p ? [[p.id, p]] : [])));
      const port = routingPortFromEnv();
      const routeLegs: import("@/domain/course-map").CourseRouteLeg[] = [];
      for (let day = 1; day <= scheduled.dayCount; day++) {
        const points = courseMapStops(
          scheduled.items.filter((i) => i.day === day),
          spotMap,
          eats,
          stays,
        );
        await Promise.all(
          points.slice(0, -1).map(async (from, index) => {
            const to = points[index + 1]!;
            const result =
              (await port.estimate(from, to, mode).catch(() => null)) ??
              (await approximateDirectionsPort.estimate(from, to, mode));
            if (result)
              routeLegs.push({
                day,
                fromId: from.id,
                toId: to.id,
                minutes: result.driveMinutes,
                distanceKm: result.distanceKm,
                source: result.source ?? "approx",
                path: result.path,
              });
          }),
        );
      }
      return { ...scheduled, routeLegs };
    };

    try {
      const ctx = await this.buildAgentContext(options);
      const result = await planItinerary(
        {
          intent: `테마 ${themeId} 코스를 현재 혼잡 기준으로 정리`,
          lang: "ko",
          themeId,
          at: nowKst(),
        },
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
      return finalize(result.course);
    } catch {
      return finalize(base);
    }
  }

  /**
   * 코스 생성 MVP — DB/시드 후보 기반 결정형 조합.
   *
   * [학습 메모] LLM 없이도 가능한 핵심 단계다. 기존 정적 코스는 "시간 슬롯 템플릿"으로만 쓰고,
   * 실제 항목은 테마·혼잡·대체지·권역 기준으로 다시 고른다. 이후 DB 테이블이 생기면
   * 여기서 읽는 후보 풀만 DB 쿼리로 바꾸고 `composeCourse` 순수 함수는 그대로 둔다.
   */
  private async composeSeedCourse(
    themeId: string,
    options?: ComposeCourseOptions,
  ): Promise<Course | null> {
    const db = requireDb();
    // eat/stay 는 보조 데이터 — 수집 전/조회 실패여도 코스 생성(스팟 중심)은 계속돼야 한다.
    const [theme, baseCourse, allThemeSpots, eats, stays] = await Promise.all([
      fetchTheme(db, themeId),
      fetchDefaultCourseTemplate(db, themeId),
      fetchSpotProfilesForTheme(db, themeId),
      fetchEats(db).catch((e) => (log.warn(`fetchEats 실패 → 빈 후보로 진행`, e), [] as Eat[])),
      fetchStays(db).catch((e) => (log.warn(`fetchStays 실패 → 빈 후보로 진행`, e), [] as Stay[])),
    ]);
    if (!theme) return null;

    const templateIds = new Set(
      baseCourse?.items.filter((it) => it.kind === "spot").map((it) => it.refId),
    );
    const spots = [...allThemeSpots]
      .sort((a, b) => Number(templateIds.has(b.id)) - Number(templateIds.has(a.id)))
      .slice(0, 36);
    const spotIds = [
      ...new Set(
        (baseCourse?.items ?? []).filter((it) => it.kind === "spot").map((it) => it.refId),
      ),
    ];
    const altEntries: [string, Spot[]][] = await Promise.all(
      spotIds.map(async (id) => {
        const dbAlternatives = spots.filter((spot) => spot.id !== id).slice(0, 8);
        return [id, dbAlternatives];
      }),
    );
    const alternativesBySpot = Object.fromEntries(altEntries);
    const travelSpots = [...spots, ...altEntries.flatMap(([, alternatives]) => alternatives)];
    const travelTimeLookup = await buildTravelTimeLookup(routeCoordsFromSpots(travelSpots), {
      mode: options?.transport ?? "car",
      // §3.3: 전쌍(N×N) 대신 코스 인접 구간 + 대체지 후보만 실호출 대상으로 지정.
      apiPairs: timelineApiPairs(baseCourse, spots, alternativesBySpot),
    });

    return composeCourse(
      {
        theme,
        baseCourse,
        spots,
        eats,
        stays,
        alternativesBySpot,
      },
      { ...options, travelTimeLookup },
    );
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
        const { hourly } = estimateCongestion({
          baseline: baseSpot?.congestion ?? "moderate",
          kind: env,
          at,
        });
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
  private async sessionUser(): Promise<{
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null> {
    try {
      const { auth } = await import("@/server/auth");
      const session = await auth();
      const user = session?.user as
        | { id?: string; name?: string | null; email?: string | null; image?: string | null }
        | undefined;
      return user?.id
        ? { id: user.id, name: user.name, email: user.email, image: user.image }
        : null;
    } catch (e) {
      log.warn(`sessionUser → null (${e instanceof Error ? e.message : String(e)})`);
      return null;
    }
  }

  async getFestival(id: string) {
    return fetchFestivalDetail(id);
  }
  async getTravelTraffic() {
    try {
      return await getHighways();
    } catch {
      return [];
    }
  }
  async listPersonalCourses() {
    const uid = (await this.sessionUser())?.id;
    return uid ? fetchPersonalCourses(requireDb(), uid) : [];
  }
  async getPersonalCourse(id: string) {
    const uid = (await this.sessionUser())?.id;
    return uid ? fetchPersonalCourse(requireDb(), uid, id) : null;
  }
  async savePersonalCourse(input: PersonalCourseInput) {
    const uid = (await this.sessionUser())?.id;
    if (!uid) throw new Error("로그인이 필요해요.");
    const value = personalCourseInput.parse(input);
    const places = await Promise.all(
      value.items.map((item) =>
        item.kind === "festival"
          ? this.getFestival(item.refId).then((event) => event?.place ?? null)
          : item.kind === "spot"
            ? this.getSpot(item.refId, { enrich: false })
            : item.kind === "eat"
              ? this.getEat(item.refId)
              : this.getStay(item.refId),
      ),
    );
    if (places.some((place) => !place))
      throw new Error("더 이상 제공되지 않는 장소가 있어요. 해당 장소를 제거해 주세요.");
    return savePersonalCourse(requireDb(), uid, value);
  }
  async deletePersonalCourse(id: string) {
    const uid = (await this.sessionUser())?.id;
    if (!uid) throw new Error("로그인이 필요해요.");
    await removePersonalCourse(requireDb(), uid, id);
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
    const nextGrade =
      REFERENCE_GRADES.find((g) => g.level === level + 1) ??
      REFERENCE_GRADES[REFERENCE_GRADES.length - 1]!;
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

  async listSavedThemes(): Promise<SavedThemeRef[]> {
    const uid = (await this.sessionUser())?.id;
    if (!uid) return [];
    return fetchSavedThemes(requireDb(), uid);
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
    // [§3.1 어뷰즈 방어] /result?q= 는 무인증 진입점이라 임의 입력이 LLM·공공 API
    // 호출로 직결된다. 화면(result/page.tsx)이 1차 검증하지만, 리포지토리도 스스로
    // 방어한다(다른 호출부·직접 호출 대비): 정규화 + 길이 절단.
    const intent = normalizeIntentQuery(query).slice(0, INTENT_QUERY_MAX_LENGTH);
    if (!intent) return this.matchThemesDeterministic(intent);

    // 동일 정규화 쿼리는 단기 캐시로 흡수 — 캐시 히트는 LLM/토큰버킷 비용이 0.
    // 프로바이더를 키에 포함해 heuristic↔openai 전환 시 결과가 섞이지 않게 한다.
    // 트레이드오프: 레이트리밋·에이전트 실패로 결정형 폴백이 나온 경우도 1h 캐시된다
    // (품질이 잠시 고정되지만, 어뷰즈 방어 관점에선 의도된 동작).
    const cacheKey = `match:${env.EUMGIL_AGENT_LLM}:${intent.toLowerCase()}`;
    return cached(cacheKey, MATCH_TTL_MS, async () => {
      // 캐시 미스에서만 토큰 소모. 소진 시 LLM 미호출 — 결정형 매칭으로 응답은 유지.
      if (!agentMatchLimiter.take(await requestClientKey())) {
        log.warn(`matchThemes "${intent}" rate-limited → deterministic only`);
        return this.matchThemesDeterministic(intent);
      }

      const ctx = await this.buildAgentContext();
      const result = await planCourse(
        { intent, lang: "ko", at: nowKst() },
        {
          llm: courseProviderFromEnv(),
          tools: buildTools(ctx),
          fallback: async () => {
            const m = await this.matchThemesDeterministic(intent);
            return {
              primaryThemeId: m.primaryId,
              altThemeIds: m.altIds,
              rationale: L("DB 테마 텍스트 매칭"),
            };
          },
        },
      );

      // 보조 테마(혼잡 분산용)는 DB 테마 텍스트 매칭으로 보강한다.
      // [§6.1 유효성 가드] LLM 이 낸 테마 id 는 실존 테마와 대조한다 — 헛 id 가
      // 통과하면 /theme/<없는id> 로 이동해 화면이 깨진다. 무효면 결정형 결과로 대체.
      const det = await this.matchThemesDeterministic(intent);
      const validIds = new Set(ctx.themes.map((t) => t.id));
      const primaryId = validIds.has(result.primaryThemeId) ? result.primaryThemeId : det.primaryId;
      const altSource = result.altThemeIds.length > 0 ? result.altThemeIds : det.altIds;
      const altIds = altSource.filter((id) => validIds.has(id) && id !== primaryId).slice(0, 2);

      log.log(
        `matchThemes "${intent}" → ${result.source} primary=${primaryId} steps=${result.trace.length}`,
      );
      return { primaryId, altIds };
    });
  }

  /**
   * 결정형 매칭 — 에이전트 실패·레이트리밋 시 안전망.
   * ① 정적 큐레이션 키워드 규칙(도메인 정본, heuristic 판단부와 공유)을 1차 신호로,
   * ② 테마 텍스트 토큰 겹침 점수를 2차 신호로 합친다. DB 테마 텍스트는 제목뿐이라
   * (mood 미시드) 토큰 겹침만으로는 대부분의 자연어가 0점 동률 → 첫 테마로 수렴하는
   * 문제가 있었다(2026-07-11) — 규칙이 그 구멍을 메운다.
   */
  private async matchThemesDeterministic(query: string): Promise<ThemeMatch> {
    const themes = await this.listThemes();
    const q = query.trim().toLowerCase();
    const known = new Set(themes.map((t) => t.id));
    const keywordHits = matchThemeIdsByKeyword(q, THEME_KEYWORD_RULES).filter((id) =>
      known.has(id),
    );
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

    const regional = regionalThemeMatch(
      q,
      themes.map((t) => ({ id: t.id, title: t.title.ko, subtitle: t.subtitle.ko })),
    );
    const ranked: string[] = regional ? [regional] : [];
    for (const id of [...keywordHits, ...scored.map((item) => item.id)]) {
      if (!ranked.includes(id)) ranked.push(id);
    }
    const primaryId = ranked[0] ?? "";
    return { primaryId, altIds: ranked.slice(1, 3) };
  }

  /**
   * 에이전트 도구가 데이터·공공 API 에 닿는 컨텍스트(포트)를 구성한다.
   * 정적 데이터(테마/코스/스팟 메타)는 DB에서, 동적 데이터(날씨/대기질/POI)는 공공 API
   * 클라이언트 + 캐시에서 가져온다. 도구 코드는 이 포트만 보므로 출처를 모른다.
   */
  private async buildAgentContext(options?: ComposeCourseOptions): Promise<ToolContext> {
    const [themes, baseSpots] = await Promise.all([
      this.listThemes(),
      fetchSpotProfiles(requireDb()),
    ]);

    // 매핑이 있는 스팟만 도구의 행동 대상으로 노출(좌표·권역·성격 필요).
    const spots: SpotMeta[] = [];
    for (const s of baseSpots) {
      const m = getSpotMapping(s.id);
      const region = m?.region ?? Object.values(REGIONS).find((r) => r.ko === s.region.ko)?.key;
      const lat = s.lat ?? m?.lat,
        lon = s.lon ?? m?.lon;
      if (!region || lat === undefined || lon === undefined) continue;
      spots.push({
        id: s.id,
        baseline: s.baselineCongestion ?? s.congestion,
        env: s.environment ?? m?.env ?? "inland",
        lat,
        lon,
        region,
      });
    }

    return {
      themes,
      spots,
      getCourse: (themeId) => this.composeSeedCourse(themeId, options),
      weather: async (meta) => {
        const w = await cached(weatherCacheKey(meta.lat, meta.lon), TTL_MS, () =>
          getWeatherByCoords(meta.lat, meta.lon),
        );
        return { tempC: w.tempC, pop: w.pop, windMs: w.windMs, pty: w.pty, desc: w.desc };
      },
      air: async (region) => {
        const info = REGIONS[region as RegionKey];
        if (!info) throw new Error(`알 수 없는 권역: ${region}`);
        const a = await cached(`air:${region}`, TTL_MS, () => getAirForStation(info.station));
        return { khaiGrade: a.khaiGrade, grade: a.grade };
      },
      searchPois: async (keyword) => {
        // TourAPI 키워드 검색(searchKeyword2)으로 관련 POI 를 조회하고, 키워드별로
        // 캐시한다(§4.5). 키워드는 도구 인자(LLM 산출 가능)라 캐시 키 길이를 제한.
        const k = keyword.trim().slice(0, 30);
        if (k) {
          const hits = await cached(`pois:kw:${k.toLowerCase()}`, DAY_MS, () =>
            searchGangwonKeyword(k, { numOfRows: 20 }),
          );
          if (hits.length > 0) {
            return hits.slice(0, 8).map((it) => ({ id: it.contentId, name: L(it.title) }));
          }
        }
        // 키워드 미스/빈 키워드 → 지역기반 목록 폴백(종전 동작 유지).
        const items = await cached(`pois:list`, DAY_MS, () => listGangwonItems({ numOfRows: 30 }));
        return items.slice(0, 8).map((it) => ({ id: it.contentId, name: L(it.title) }));
      },
      now: () => nowKst(),
    };
  }

  async getEat(id: string): Promise<Eat | null> {
    return fetchEat(requireDb(), id);
  }

  async getStay(id: string): Promise<Stay | null> {
    return fetchStay(requireDb(), id);
  }

  async listEats(): Promise<Eat[]> {
    return fetchEats(requireDb());
  }

  async listStays(): Promise<Stay[]> {
    return fetchStays(requireDb());
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
