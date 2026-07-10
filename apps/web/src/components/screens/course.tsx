"use client";

// CourseView — Phase 1b. 코스 타임라인(혼잡도 포함). 데이터는 서버에서 주입.
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { localized, type Lang } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { ComposeCourseOptions } from "@/domain/course-compose";
import type { TravelMode } from "@/domain/travel-time";
import type { Course, CourseItem, Eat, Spot, Stay, Theme } from "@/domain/types";

const { TopBar, Signal, Placeholder } = UI;

interface Props {
  theme: Theme;
  course: Course;
  spots: Record<string, Spot>;
  eats: Record<string, Eat>;
  stays: Record<string, Stay>;
  options: ComposeCourseOptions;
  initiallySaved: boolean;
  onSaveTheme: (themeId: string, saved: boolean) => Promise<{ saved: boolean }>;
}

const dayChoices = [1, 2, 3];
const paceChoices = [
  { id: "calm", ko: "여유", en: "Calm" },
  { id: "balanced", ko: "균형", en: "Balanced" },
  { id: "active", ko: "활동적", en: "Active" },
];
const companionChoices = [
  { id: "solo", ko: "혼자", en: "Solo" },
  { id: "couple", ko: "둘이", en: "Couple" },
  { id: "family", ko: "가족", en: "Family" },
];
const transportChoices = [
  { id: "car", ko: "자동차", en: "Car" },
  { id: "transit", ko: "대중교통", en: "Transit" },
  { id: "walk", ko: "도보", en: "Walk" },
] satisfies { id: TravelMode; ko: string; en: string }[];
const regionChoices = ["강릉", "속초", "평창", "양양"];

export function CourseView({ theme, course, spots, eats, stays, options, initiallySaved, onSaveTheme }: Props) {
  const { lang, requireAuth, showToast } = useAppState();
  const { nav } = useAppNav();
  const [day, setDay] = useState(1);
  const [showTune, setShowTune] = useState(false);
  const [draftDays, setDraftDays] = useState(options.days ?? course.dayCount);
  const [draftPace, setDraftPace] = useState(options.pace ?? "balanced");
  const [draftCompanion, setDraftCompanion] = useState(options.companion ?? "couple");
  const [draftTransport, setDraftTransport] = useState<TravelMode>(options.transport ?? "car");
  const [draftRegion, setDraftRegion] = useState(options.startRegion ?? localized(theme.region, "ko").split(" · ")[0] ?? "강릉");
  const [isSaved, setIsSaved] = useState(initiallySaved);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (day > course.dayCount) setDay(course.dayCount);
  }, [course.dayCount, day]);

  const items = course.items.filter((it) => it.day === day);
  const busy = items.some((it) => it.kind === "spot" && spots[it.refId]?.congestion === "busy");
  const tuned =
    Boolean(options.days) ||
    Boolean(options.pace) ||
    Boolean(options.companion) ||
    Boolean(options.transport) ||
    Boolean(options.startRegion);
  const saveLabel = isSaved
    ? lang === "ko"
      ? "저장 해제"
      : "Unsave trip"
    : lang === "ko"
      ? "내 여행에 저장"
      : "Save trip";

  const toggleSave = () => {
    requireAuth("save", () => {
      const next = !isSaved;
      setIsSaved(next);
      startTransition(async () => {
        try {
          await onSaveTheme(theme.id, next);
          showToast(next ? "내 여행에 저장했어요" : "저장을 해제했어요");
        } catch {
          setIsSaved(!next);
          showToast("저장에 실패했어요. 잠시 후 다시 시도해 주세요");
        }
      });
    });
  };

  const applyTune = () => {
    setShowTune(false);
    nav("course", {
      themeId: theme.id,
      days: draftDays,
      pace: draftPace,
      companion: draftCompanion,
      transport: draftTransport,
      startRegion: draftRegion,
    });
  };

  const resetTune = () => {
    setDraftDays(course.dayCount);
    setDraftPace("balanced");
    setDraftCompanion("couple");
    setDraftTransport("car");
    setDraftRegion(localized(theme.region, "ko").split(" · ")[0] ?? "강릉");
    setShowTune(false);
    nav("course", { themeId: theme.id });
  };

  return (
    <div className="screen-enter">
      <TopBar
        title={lang === "ko" ? "코스 상세" : "Course"}
        onBack={() => nav("theme", { themeId: theme.id })}
        right={
          <>
            <button className="icon-btn" onClick={toggleSave} disabled={isPending} style={isSaved ? { color: "var(--brand)" } : undefined}>
              {isSaved ? <Icon.bookmarkFill /> : <Icon.bookmark />}
            </button>
            <button className="icon-btn">
              <Icon.share />
            </button>
          </>
        }
      />

      <div style={{ padding: "4px 20px 14px" }}>
        <div className="section-label" style={{ color: `oklch(0.48 0.1 ${theme.hue})` }}>
          {localized(theme.tag, lang)} · {localized(theme.region, lang)}
        </div>
        <h1 className="serif" style={{ fontSize: 28, margin: "2px 0 8px", lineHeight: 1.15 }}>
          {localized(course.title, lang)}
        </h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
          {lang === "ko"
            ? `${course.dayCount}일 · ${localized(theme.pace, lang)} · ${theme.spotCount}개 장소`
            : `${course.dayCount}d · ${localized(theme.pace, lang)}`}
        </div>
      </div>

      {busy && (
        <div
          style={{ margin: "0 20px 14px", padding: 14, background: "var(--moderate-bg)", border: "1px solid color-mix(in oklab, var(--moderate) 25%, transparent)", borderRadius: "var(--r-md)" }}
        >
          <div style={{ fontSize: 12, color: "var(--moderate)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {lang === "ko" ? "혼잡 분산 제안" : "Reroute suggested"}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>
            {lang === "ko"
              ? "혼잡 장소가 포함된 코스예요. 같은 테마의 한적한 대체지로 바꿔볼 수 있어요."
              : "This course includes a busy spot. We can swap in a quieter alternative."}
          </div>
          <button className="btn btn-sm btn-secondary" style={{ marginTop: 10 }} onClick={() => nav("alternative", { themeId: theme.id })}>
            <Icon.refresh /> {lang === "ko" ? "대체지 보기" : "See alternatives"}
          </button>
        </div>
      )}

      {course.reorderNote && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 20px 14px", padding: "10px 12px", background: "var(--calm-bg)", border: "1px solid color-mix(in oklab, var(--calm) 25%, transparent)", borderRadius: "var(--r-md)", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4 }}>
          <Icon.clock />
          <span>{localized(course.reorderNote, lang)}</span>
        </div>
      )}

      {course.altNote && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 20px 14px", padding: "10px 12px", background: "var(--paper)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4 }}>
          <Icon.refresh />
          <span>{localized(course.altNote, lang)}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, padding: "0 20px 10px", alignItems: "center" }}>
        {course.dayCount > 1 &&
          Array.from({ length: course.dayCount }).map((_, i) => {
            const d = i + 1;
            return (
              <button key={d} onClick={() => setDay(d)} className={"chip" + (day === d ? " active" : "")}>
                {`Day ${d}`}
              </button>
            );
          })}
        <div style={{ flex: 1 }} />
        <button className={"chip" + (showTune || tuned ? " active" : "")} onClick={() => setShowTune((v) => !v)}>
          <Icon.filter /> {lang === "ko" ? "조건" : "Tune"}
        </button>
      </div>

      {showTune && (
        <CourseTunePanel
          lang={lang}
          days={draftDays}
          pace={draftPace}
          companion={draftCompanion}
          transport={draftTransport}
          startRegion={draftRegion}
          onDays={setDraftDays}
          onPace={setDraftPace}
          onCompanion={setDraftCompanion}
          onTransport={setDraftTransport}
          onRegion={setDraftRegion}
          onApply={applyTune}
          onReset={resetTune}
        />
      )}

      <div style={{ padding: "4px 20px 0", position: "relative" }}>
        <div style={{ position: "absolute", left: 46, top: 8, bottom: 8, width: 1.5, background: "var(--line-2)" }} />
        {items.map((it, i) => (
          <CourseTimelineItem
            key={i}
            item={it}
            lang={lang}
            spots={spots}
            eats={eats}
            stays={stays}
            isLast={i === items.length - 1}
            onNavSpot={(id) => nav("spot", { spotId: id })}
          />
        ))}
      </div>

      <div style={{ padding: "22px 20px 32px", display: "flex", gap: 10 }}>
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} onClick={toggleSave} disabled={isPending}>
          {isSaved ? <Icon.bookmarkFill /> : <Icon.bookmark />} {isPending ? (lang === "ko" ? "저장 중..." : "Saving...") : saveLabel}
        </button>
      </div>
    </div>
  );
}

interface TunePanelProps {
  lang: Lang;
  days: number;
  pace: string;
  companion: string;
  transport: TravelMode;
  startRegion: string;
  onDays: (v: number) => void;
  onPace: (v: string) => void;
  onCompanion: (v: string) => void;
  onTransport: (v: TravelMode) => void;
  onRegion: (v: string) => void;
  onApply: () => void;
  onReset: () => void;
}

function CourseTunePanel({
  lang,
  days,
  pace,
  companion,
  transport,
  startRegion,
  onDays,
  onPace,
  onCompanion,
  onTransport,
  onRegion,
  onApply,
  onReset,
}: TunePanelProps) {
  return (
    <div style={{ margin: "0 20px 14px", padding: 14, background: "var(--bg-elev)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{lang === "ko" ? "코스 조건" : "Trip options"}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
            {lang === "ko" ? "선택값으로 후보 장소와 동선을 다시 조합해요." : "Regenerate stops and route with these choices."}
          </div>
        </div>
        <button className="icon-btn" onClick={onReset} aria-label={lang === "ko" ? "조건 초기화" : "Reset options"}>
          <Icon.refresh />
        </button>
      </div>

      <TuneGroup label={lang === "ko" ? "일정" : "Days"}>
        {dayChoices.map((d) => (
          <button key={d} className={"chip" + (days === d ? " active" : "")} onClick={() => onDays(d)}>
            {lang === "ko" ? `${d}일` : `${d}d`}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={lang === "ko" ? "페이스" : "Pace"}>
        {paceChoices.map((p) => (
          <button key={p.id} className={"chip" + (pace === p.id ? " active" : "")} onClick={() => onPace(p.id)}>
            {lang === "ko" ? p.ko : p.en}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={lang === "ko" ? "동행" : "With"}>
        {companionChoices.map((c) => (
          <button key={c.id} className={"chip" + (companion === c.id ? " active" : "")} onClick={() => onCompanion(c.id)}>
            {lang === "ko" ? c.ko : c.en}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={lang === "ko" ? "이동수단" : "Transport"}>
        {transportChoices.map((t) => (
          <button key={t.id} className={"chip" + (transport === t.id ? " active" : "")} onClick={() => onTransport(t.id)}>
            {lang === "ko" ? t.ko : t.en}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={lang === "ko" ? "시작 권역" : "Start"}>
        {regionChoices.map((r) => (
          <button key={r} className={"chip" + (startRegion === r ? " active" : "")} onClick={() => onRegion(r)}>
            {r}
          </button>
        ))}
      </TuneGroup>

      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={onApply}>
        <Icon.refresh /> {lang === "ko" ? "조건 적용" : "Apply"}
      </button>
    </div>
  );
}

function TuneGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 13 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", marginBottom: 7, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{children}</div>
    </div>
  );
}

interface ItemProps {
  item: CourseItem;
  lang: Lang;
  spots: Record<string, Spot>;
  eats: Record<string, Eat>;
  stays: Record<string, Stay>;
  isLast: boolean;
  onNavSpot: (id: string) => void;
}

function CourseTimelineItem({ item, lang, spots, eats, stays, isLast, onNavSpot }: ItemProps) {
  const pad = { paddingBottom: isLast ? 0 : 16 };

  if (item.kind === "spot") {
    const s = spots[item.refId];
    if (!s) return null;
    return (
      <div style={{ display: "flex", gap: 16, ...pad }}>
        <div style={{ width: 30, textAlign: "center", paddingTop: 16, fontSize: 11, color: "var(--ink-3)", position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "SF Mono, monospace", fontWeight: 600 }}>{item.time}</div>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--surface)", border: "2.5px solid var(--brand)", margin: "8px auto 0" }} />
        </div>
        <button onClick={() => onNavSpot(s.id)} className="card" style={{ flex: 1, padding: 12, textAlign: "left", display: "flex", gap: 12 }}>
          <Placeholder label={localized(s.name, lang)} src={s.imageUrl} h={68} style={{ width: 80, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{localized(s.name, lang)}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                {localized(s.type, lang)}
                {item.durationMin ? ` · ${item.durationMin} ${lang === "ko" ? "분" : "min"}` : ""}
              </div>
            </div>
            <Signal level={s.congestion} lang={lang} />
          </div>
        </button>
      </div>
    );
  }

  if (item.kind === "eat") {
    const e = eats[item.refId];
    if (!e) return null;
    return (
      <div style={{ display: "flex", gap: 16, ...pad }}>
        <div style={{ width: 30, textAlign: "center", paddingTop: 12, fontSize: 11, color: "var(--ink-3)", position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "SF Mono, monospace", fontWeight: 600 }}>{item.time}</div>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", margin: "6px auto 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon.utensils />
          </div>
        </div>
        <div style={{ flex: 1, padding: "12px 14px", background: "var(--bg-elev)", borderRadius: "var(--r-md)", border: "1px dashed var(--line-2)" }}>
          <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {lang === "ko" ? "식사" : "Meal"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{localized(e.name, lang)}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {/* TourAPI 수집분은 가격·평점이 없을 수 있다 — 빈 값은 생략 */}
            {[localized(e.type, lang), e.price, e.rating > 0 ? `★ ${e.rating}` : ""].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
    );
  }

  const st = stays[item.refId];
  if (!st) return null;
  return (
    <div style={{ display: "flex", gap: 16, ...pad }}>
      <div style={{ width: 30, textAlign: "center", paddingTop: 12, fontSize: 11, color: "var(--ink-3)", position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: "SF Mono, monospace", fontWeight: 600 }}>{item.time}</div>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand)", margin: "6px auto 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon.bed />
        </div>
      </div>
      <div style={{ flex: 1, padding: "12px 14px", background: "var(--bg-elev)", borderRadius: "var(--r-md)", border: "1px dashed var(--line-2)" }}>
        <div style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {lang === "ko" ? "숙박" : "Stay"}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{localized(st.name, lang)}</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {[localized(st.type, lang), localized(st.price, lang)].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  );
}
