// ─────────────────────────────────────────────
// 도구 카탈로그 — 기존 자산을 LLM 이 부를 수 있게 래핑한다 (재구현 아님).
//
// [학습 메모] 에이전트의 "도구"는 곧 우리가 이미 가진 능력이다.
//   순수 추론 함수(domain): estimate_congestion / score_suitability / reorder_by_congestion
//   외부 조회(server)     : get_weather / get_air_quality / search_pois
//   데이터 조회           : list_themes / get_course
// LLM 은 이 8개 "밖"의 행동을 할 수 없다 → 행동 공간을 좁혀 일관성을 높이는 1차 장치.
// ─────────────────────────────────────────────

import { estimateCongestion } from "@/domain/congestion";
import { scoreSuitability } from "@/domain/scoring";
import { reorderSpotsByCongestion, type ScheduledSpot } from "@/domain/course-reorder";
import { localized } from "@/lib/i18n";
import type { SpotMeta, ToolContext, ToolSpec } from "./types";

/** args 에서 문자열 하나를 안전하게 꺼낸다(런타임 방어 — LLM 출력은 신뢰 불가). */
function str(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`도구 인자 '${key}' (문자열) 누락`);
  }
  return v;
}

function findSpot(ctx: ToolContext, id: string): SpotMeta {
  const m = ctx.spots.find((s) => s.id === id);
  if (!m) throw new Error(`알 수 없는 spotId: ${id}`);
  return m;
}

/**
 * ctx 를 클로저로 묶어 도구 8종을 만든다. 도구 run() 은 args 만 받는다.
 * enum 은 ctx 데이터에서 동적으로 채운다(존재하는 id 만 허용 → 헛것 차단).
 */
export function buildTools(ctx: ToolContext): ToolSpec[] {
  const themeIds = ctx.themes.map((t) => t.id);
  const spotIds = ctx.spots.map((s) => s.id);

  return [
    // ── 조회(정적) ──
    {
      name: "list_themes",
      description: "선택 가능한 강원도 여행 테마 목록을 반환한다. 테마를 고르기 전에 호출.",
      parameters: {},
      origin: "domain",
      async run() {
        return ctx.themes.map((t) => ({
          id: t.id,
          title: localized(t.title, "ko"),
          tag: localized(t.tag, "ko"),
          mood: t.mood.map((m) => localized(m, "ko")),
        }));
      },
    },
    {
      name: "get_course",
      description: "특정 테마의 기본 코스 일정(스팟·식사·숙박)을 반환한다.",
      parameters: {
        themeId: { type: "string", required: true, description: "테마 id", enum: themeIds },
      },
      origin: "domain",
      async run(args) {
        const course = await ctx.getCourse(str(args, "themeId"));
        if (!course) throw new Error("코스 없음");
        return {
          themeId: course.themeId,
          dayCount: course.dayCount,
          items: course.items.map((it) => ({
            kind: it.kind,
            day: it.day,
            time: it.time,
            refId: it.refId,
          })),
        };
      },
    },

    // ── 조회(외부 API · 샌드박스 mock 대체) ──
    {
      name: "search_pois",
      description: "키워드로 강원도 관광 POI 후보를 검색한다(대체지 탐색용).",
      parameters: {
        keyword: { type: "string", required: true, description: "검색어 (예: 해변, 시장)" },
      },
      origin: "server",
      async run(args) {
        const pois = await ctx.searchPois(str(args, "keyword"));
        return pois.map((p) => ({ id: p.id, name: localized(p.name, "ko") }));
      },
    },
    {
      name: "get_weather",
      description: "특정 스팟 좌표의 현재 날씨(기온/강수확률/바람)를 반환한다.",
      parameters: {
        spotId: { type: "string", required: true, description: "스팟 id", enum: spotIds },
      },
      origin: "server",
      async run(args) {
        const meta = findSpot(ctx, str(args, "spotId"));
        const w = await ctx.weather(meta);
        return { tempC: w.tempC, pop: w.pop, windMs: w.windMs, pty: w.pty, desc: localized(w.desc, "ko") };
      },
    },
    {
      name: "get_air_quality",
      description: "특정 스팟 권역의 통합대기 등급(1좋음~4매우나쁨)을 반환한다.",
      parameters: {
        spotId: { type: "string", required: true, description: "스팟 id", enum: spotIds },
      },
      origin: "server",
      async run(args) {
        const meta = findSpot(ctx, str(args, "spotId"));
        const a = await ctx.air(meta.region);
        return { khaiGrade: a.khaiGrade, grade: localized(a.grade, "ko") };
      },
    },

    // ── 추론(순수 함수 — 네트워크 불요·재현 가능) ──
    {
      name: "estimate_congestion",
      description:
        "특정 스팟의 현재 혼잡도와 가장 한산한 추천 방문 시간대를 계산한다. 장소 확정 전 호출 권장.",
      parameters: {
        spotId: { type: "string", required: true, description: "스팟 id", enum: spotIds },
      },
      origin: "domain",
      async run(args) {
        const meta = findSpot(ctx, str(args, "spotId"));
        const c = estimateCongestion({ baseline: meta.baseline, kind: meta.env, at: ctx.now() });
        return { spotId: meta.id, level: c.level, index: c.index, bestHours: c.bestHours };
      },
    },
    {
      name: "score_suitability",
      description:
        "혼잡+날씨+대기질을 합쳐 특정 스팟의 방문 적합성(0~100)과 사유를 계산한다.",
      parameters: {
        spotId: { type: "string", required: true, description: "스팟 id", enum: spotIds },
      },
      origin: "domain",
      async run(args) {
        const meta = findSpot(ctx, str(args, "spotId"));
        const [w, a] = await Promise.all([ctx.weather(meta), ctx.air(meta.region)]);
        const c = estimateCongestion({ baseline: meta.baseline, kind: meta.env, at: ctx.now(), pop: w.pop, pty: w.pty });
        const { suitability, reason } = scoreSuitability({
          congestion: c.level,
          pop: w.pop,
          windMs: w.windMs,
          pty: w.pty,
          khaiGrade: a.khaiGrade,
          kind: meta.env,
        });
        return { spotId: meta.id, suitability, reason: localized(reason, "ko") };
      },
    },
    {
      name: "reorder_by_congestion",
      description:
        "한 테마 코스의 특정 날(day) 스팟들을 혼잡이 최소가 되도록 방문 시각 순서로 재배치한다.",
      parameters: {
        themeId: { type: "string", required: true, description: "테마 id", enum: themeIds },
        day: { type: "number", required: true, description: "재정렬할 일차(1부터)" },
      },
      origin: "domain",
      async run(args) {
        const course = await ctx.getCourse(str(args, "themeId"));
        if (!course) throw new Error("코스 없음");
        const day = Number(args["day"]);
        const at = ctx.now();
        const scheduled: ScheduledSpot[] = course.items
          .filter((it) => it.day === day && it.kind === "spot")
          .map((it) => {
            const meta = ctx.spots.find((s) => s.id === it.refId);
            const { hourly } = estimateCongestion({
              baseline: meta?.baseline ?? "moderate",
              kind: meta?.env ?? "inland",
              at,
            });
            return { refId: it.refId, time: it.time, hourly };
          });
        const res = reorderSpotsByCongestion(scheduled);
        return { day, changed: res.changed, saved: res.saved, order: res.order, movedRefIds: res.movedRefIds };
      },
    },
  ];
}
