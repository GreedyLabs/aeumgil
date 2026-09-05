"use client";
import Link from "next/link";
import { Select } from "@/components/select";
import { CourseMap } from "./course-map";
import { courseMapStops } from "@/domain/course-map";
import { GANGWON_REGIONS } from "@/domain/place-search";

// CourseView — Phase 1b. 코스 타임라인(혼잡도 포함). 데이터는 서버에서 주입.
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { localized, type Lang } from "@/lib/i18n";
import { shareCurrentPage } from "@/lib/share";
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
const regionChoices = GANGWON_REGIONS.map((r) => r.ko);

export function CourseView({
  theme,
  course,
  spots,
  eats,
  stays,
  options,
  initiallySaved,
  onSaveTheme,
}: Props) {
  const { lang, requireAuth, showToast } = useAppState();
  const { nav } = useAppNav();
  const [day, setDay] = useState(1);
  const [showTune, setShowTune] = useState(false);
  const [draftDays, setDraftDays] = useState(options.days ?? course.dayCount);
  const [draftPace, setDraftPace] = useState(options.pace ?? "balanced");
  const [draftCompanion, setDraftCompanion] = useState(options.companion ?? "couple");
  const [draftTransport, setDraftTransport] = useState<TravelMode>(options.transport ?? "car");
  const [draftRegion, setDraftRegion] = useState(
    options.startRegion ?? localized(theme.region, "ko").split(" · ")[0] ?? "강릉",
  );
  const [isSaved, setIsSaved] = useState(initiallySaved);
  const [isPending, startTransition] = useTransition();
  const [isTuning, startTuning] = useTransition();
  useEffect(() => {
    setDraftDays(options.days ?? course.dayCount);
    setDraftPace(options.pace ?? "balanced");
    setDraftCompanion(options.companion ?? "couple");
    setDraftTransport(options.transport ?? "car");
    setDraftRegion(options.startRegion ?? "");
    setIsSaved(initiallySaved);
  }, [options, course.dayCount, initiallySaved]);

  useEffect(() => {
    if (day > course.dayCount) setDay(course.dayCount);
  }, [course.dayCount, day]);

  const items = course.items.filter((it) => it.day === day);
  const mapStops = useMemo(
    () =>
      courseMapStops(
        course.items.filter((it) => it.day === day),
        spots,
        eats,
        stays,
      ),
    [course.items, day, spots, eats, stays],
  );
  const mapLegs = useMemo(
    () => course.routeLegs?.filter((l) => l.day === day) ?? [],
    [course.routeLegs, day],
  );
  const busy = items.some((it) => it.kind === "spot" && spots[it.refId]?.congestion === "busy");
  const tuned =
    Boolean(options.days) ||
    Boolean(options.pace) ||
    Boolean(options.companion) ||
    Boolean(options.transport) ||
    Boolean(options.startRegion);
  const saveLabel = isSaved
    ? lang === "ko"
      ? "테마 보관 해제"
      : "Remove theme"
    : lang === "ko"
      ? "테마 보관"
      : "Keep theme";

  const toggleSave = () => {
    requireAuth("save", () => {
      const next = !isSaved;
      setIsSaved(next);
      startTransition(async () => {
        try {
          await onSaveTheme(theme.id, next);
          showToast(next ? "내 여행에 테마를 보관했어요" : "저장을 해제했어요");
        } catch {
          setIsSaved(!next);
          showToast("저장에 실패했어요. 잠시 후 다시 시도해 주세요");
        }
      });
    });
  };

  const applyTune = () => {
    setShowTune(false);
    startTuning(() =>
      nav("course", {
        themeId: theme.id,
        days: draftDays,
        pace: draftPace,
        companion: draftCompanion,
        transport: draftTransport,
        startRegion: draftRegion,
      }),
    );
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

  const copyQuery = new URLSearchParams({ from: theme.id });
  for (const [key, value] of Object.entries(options))
    if (value !== undefined) copyQuery.set(key, String(value));
  return (
    <div className="screen-enter course-page">
      <TopBar
        title="코스 상세"
        onBack={() => nav("theme", { themeId: theme.id })}
        right={
          <button
            className="icon-btn"
            aria-label="코스 공유"
            onClick={() => void shareCurrentPage(theme.title.ko, showToast)}
          >
            <Icon.share />
          </button>
        }
      />
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            {localized(theme.tag, lang)} · {localized(theme.region, lang)}
          </span>
          <h1>{localized(theme.title, lang)}</h1>
          <p>
            {course.dayCount}일 ·{" "}
            {paceChoices.find((p) => p.id === (options.pace ?? "balanced"))?.ko} · 관광지{" "}
            {course.items.filter((it) => it.kind === "spot").length}곳
          </p>
        </div>
        <button
          className="icon-btn filled"
          aria-label={isSaved ? "테마 보관 해제" : "테마 보관"}
          onClick={toggleSave}
          disabled={isPending}
        >
          {isSaved ? <Icon.bookmarkFill /> : <Icon.bookmark />}
        </button>
      </header>
      <div className="detail-layout">
        <div className="detail-primary">
          {busy && (
            <div className="course-note caution">
              <strong>조금 더 여유로운 여행을 원한다면</strong>
              <p>혼잡한 장소가 포함되어 있어요. 같은 분위기의 다른 장소를 비교해 보세요.</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  nav("alternative", {
                    spotId: items.find(
                      (it) => it.kind === "spot" && spots[it.refId]?.congestion === "busy",
                    )?.refId,
                    themeId: theme.id,
                  })
                }
              >
                <Icon.refresh /> 대체지 보기
              </button>
            </div>
          )}
          {course.reorderNote && (
            <div className="course-note">
              <Icon.clock /> {localized(course.reorderNote, lang)}
            </div>
          )}
          {course.altNote && (
            <details className="course-note">
              <summary>코스 추천 이유</summary>
              <p>{localized(course.altNote, lang)}</p>
            </details>
          )}
          <div className="course-tabs" aria-label="여행 날짜">
            {Array.from({ length: course.dayCount }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                aria-pressed={day === d}
                className={`chip${day === d ? " active" : ""}`}
              >
                Day {d}
              </button>
            ))}
            <button
              className={`chip${showTune || tuned ? " active" : ""}`}
              disabled={isTuning}
              aria-expanded={showTune}
              onClick={() => setShowTune((v) => !v)}
            >
              <Icon.filter /> 조건
            </button>
          </div>
          {isTuning && <p role="status">선택한 조건으로 코스를 조정하고 있어요…</p>}
          <CourseMap stops={mapStops} legs={mapLegs} day={day} />
          <div className="course-timeline">
            {items.map((it, i) => (
              <CourseTimelineItem
                key={`${it.kind}-${it.refId}-${i}`}
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
          <p className="section-description">
            이동시간은 관광지 좌표를 바탕으로 한 예상값이에요. 음식점·숙소 이동, 영업시간과 대중교통
            운행은 지도에서 확인해 주세요.
          </p>
        </div>
        <aside className="detail-aside summary-panel mobile-first" aria-label="코스 조건과 저장">
          {showTune ? (
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
          ) : (
            <>
              <Link className="btn btn-primary btn-block" href={`/my-courses/new?${copyQuery}`}>
                <Icon.plus /> 내 코스로 편집
              </Link>
              <p>장소·방문 순서를 바꾸고 이 일정을 저장하세요.</p>
              <details className="trip-facts">
                <summary>
                  {course.dayCount}일 ·{" "}
                  {transportChoices.find((t) => t.id === (options.transport ?? "car"))?.ko}
                  <span>여행 조건</span>
                </summary>
                <dl className="summary-facts">
                  <div>
                    <dt>일정</dt>
                    <dd>{course.dayCount}일</dd>
                  </div>
                  <div>
                    <dt>이동수단</dt>
                    <dd>
                      {transportChoices.find((t) => t.id === (options.transport ?? "car"))?.ko}
                    </dd>
                  </div>
                  <div>
                    <dt>여행 페이스</dt>
                    <dd>{paceChoices.find((p) => p.id === (options.pace ?? "balanced"))?.ko}</dd>
                  </div>
                  <div>
                    <dt>동행</dt>
                    <dd>
                      {options.companion
                        ? companionChoices.find((c) => c.id === options.companion)?.ko
                        : "자유롭게"}
                    </dd>
                  </div>
                </dl>
              </details>
              <button className="btn btn-secondary btn-block" onClick={() => setShowTune(true)}>
                <Icon.filter /> 여행 조건 바꾸기
              </button>
              <button
                className="btn btn-ghost btn-block"
                style={{ marginTop: 10 }}
                onClick={toggleSave}
                disabled={isPending}
              >
                {isSaved ? <Icon.bookmarkFill /> : <Icon.bookmark />}
                {isPending ? "저장 중…" : saveLabel}
              </button>
              <p className="summary-footnote">
                테마 보관은 테마만 기억해요. 지금 일정을 남기려면 내 코스로 편집하세요.
              </p>
            </>
          )}
        </aside>
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
    <div
      className="course-tune"
      style={{
        margin: "0 20px 14px",
        padding: 14,
        background: "var(--bg-elev)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {lang === "ko" ? "코스 조건" : "Trip options"}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
            {lang === "ko"
              ? "선택값으로 후보 장소와 동선을 다시 조합해요."
              : "Regenerate stops and route with these choices."}
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={onReset}
          aria-label={lang === "ko" ? "조건 초기화" : "Reset options"}
        >
          <Icon.refresh />
        </button>
      </div>

      <TuneGroup label={lang === "ko" ? "일정" : "Days"}>
        {dayChoices.map((d) => (
          <button
            key={d}
            aria-pressed={days === d}
            className={"chip" + (days === d ? " active" : "")}
            onClick={() => onDays(d)}
          >
            {lang === "ko" ? `${d}일` : `${d}d`}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={lang === "ko" ? "페이스" : "Pace"}>
        {paceChoices.map((p) => (
          <button
            key={p.id}
            aria-pressed={pace === p.id}
            className={"chip" + (pace === p.id ? " active" : "")}
            onClick={() => onPace(p.id)}
          >
            {lang === "ko" ? p.ko : p.en}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={lang === "ko" ? "동행" : "With"}>
        {companionChoices.map((c) => (
          <button
            key={c.id}
            aria-pressed={companion === c.id}
            className={"chip" + (companion === c.id ? " active" : "")}
            onClick={() => onCompanion(c.id)}
          >
            {lang === "ko" ? c.ko : c.en}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={lang === "ko" ? "이동수단" : "Transport"}>
        {transportChoices.map((t) => (
          <button
            key={t.id}
            aria-pressed={transport === t.id}
            className={"chip" + (transport === t.id ? " active" : "")}
            onClick={() => onTransport(t.id)}
          >
            {lang === "ko" ? t.ko : t.en}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={lang === "ko" ? "시작 권역" : "Start"}>
        <Select
          className="input"
          aria-label="시작 권역"
          value={startRegion}
          onChange={(e) => onRegion(e.target.value)}
        >
          <option value="">코스 기본 권역</option>
          {regionChoices.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
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
      <div className="course-tune-label">{label}</div>
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
        <div
          style={{
            width: 38,
            flexShrink: 0,
            textAlign: "center",
            paddingTop: 16,
            fontSize: 11,
            color: "var(--ink-3)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ fontFamily: "SF Mono, monospace", fontWeight: 600 }}>{item.time}</div>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "var(--surface)",
              border: "2.5px solid var(--brand)",
              margin: "8px auto 0",
            }}
          />
        </div>
        <button
          onClick={() => onNavSpot(s.id)}
          className="card"
          style={{ flex: 1, minWidth: 0, padding: 12, textAlign: "left", display: "flex", gap: 12 }}
        >
          <Placeholder
            label={localized(s.name, lang)}
            src={s.imageUrl}
            h={68}
            style={{ width: 80, borderRadius: 10, flexShrink: 0 }}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minWidth: 0,
            }}
          >
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{localized(s.name, lang)}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                {localized(s.type, lang)}
                {item.durationMin ? ` · ${item.durationMin} ${lang === "ko" ? "분" : "min"}` : ""}
              </div>
            </div>
            <Signal level={s.congestion} lang={lang} />
            {item.travelMinutes && (
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                이전 관광지에서 약 {item.travelMinutes}분 이동
              </span>
            )}
          </div>
        </button>
      </div>
    );
  }

  const place = item.kind === "eat" ? eats[item.refId] : stays[item.refId];
  if (!place) return null;
  const isEat = item.kind === "eat";
  const name = localized(place.name, lang);
  const price = typeof place.price === "string" ? place.price : localized(place.price, lang);
  return (
    <div className="itinerary-row" style={{ display: "flex", gap: 16, ...pad }}>
      <div className="itinerary-time">
        <span className="mono">{item.time}</span>
        <span className={`itinerary-kind${isEat ? " meal" : ""}`}>
          {isEat ? <Icon.utensils /> : <Icon.bed />}
        </span>
      </div>
      <a
        className="card itinerary-commerce"
        href={`https://map.kakao.com/link/search/${encodeURIComponent(`${name} ${place.address ?? place.region.ko}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${name} 지도·영업정보 (새 탭)`}
      >
        <Placeholder
          src={place.imageUrl}
          label={name}
          h={84}
          style={{ width: 90, borderRadius: 10, flexShrink: 0 }}
        />
        <div>
          <span className="eyebrow">{isEat ? "식사" : "숙박"}</span>
          <h3>{name}</h3>
          <p>{[localized(place.type, lang), price].filter(Boolean).join(" · ")}</p>
          <span className="text-link">
            지도·영업정보 <Icon.chevR />
          </span>
        </div>
      </a>
    </div>
  );
}
