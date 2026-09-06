"use client";
import { useUiText } from "@/components/use-ui-text";
import { ExternalLink, ExternalLinkIndicator } from "@/components/external-link";
import Link from "next/link";
import { Select } from "@/components/select";
import { CourseMap } from "./course-map";
import { ThemePlanningInfo } from "./theme-planning-info";
import { courseMapStops } from "@/domain/course-map";
import { GANGWON_REGIONS } from "@/domain/place-search";
import { COURSE_DAY_CHOICES } from "@/domain/course-options";

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

const dayChoices = COURSE_DAY_CHOICES;
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
  const translateUi = useUiText();
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
  const saveLabel = isSaved ? "테마 보관 해제" : "테마 보관";

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
        title={translateUi("코스 상세")}
        onBack={() => nav("theme", { themeId: theme.id })}
        right={
          <button
            className="icon-btn"
            aria-label={translateUi("코스 공유")}
            onClick={() => void shareCurrentPage(theme.title.ko, showToast)}
          >
            <Icon.share />
          </button>
        }
      />
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            {translateUi(localized(theme.tag, lang))} · {translateUi(localized(theme.region, lang))}
          </span>
          <h1>{translateUi(localized(theme.title, lang))}</h1>
          <p>
            {translateUi(course.dayCount)}
            {translateUi("일 ·")}
            {translateUi(" ")}
            {translateUi(paceChoices.find((p) => p.id === (options.pace ?? "balanced"))?.ko)}
            {translateUi(" · 관광지")}
            {translateUi(" ")}
            {translateUi(course.items.filter((it) => it.kind === "spot").length)}
            {translateUi("곳")}
          </p>
        </div>
        <button
          className="icon-btn filled"
          aria-label={translateUi(isSaved ? "테마 보관 해제" : "테마 보관")}
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
              <strong>{translateUi("조금 더 여유로운 여행을 원한다면")}</strong>
              <p>
                {translateUi(
                  "혼잡한 장소가 포함되어 있어요. 같은 분위기의 다른 장소를 비교해 보세요.",
                )}
              </p>
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
                <Icon.refresh />
                {translateUi(" 대체지 보기")}
              </button>
            </div>
          )}
          {course.preferenceNote && (
            <p className="course-note">{translateUi(localized(course.preferenceNote, lang))}</p>
          )}
          {course.reorderNote && (
            <div className="course-note">
              <Icon.clock /> {translateUi(localized(course.reorderNote, lang))}
            </div>
          )}
          {course.altNote && (
            <details className="course-note">
              <summary>{translateUi("코스 추천 이유")}</summary>
              <p>{translateUi(localized(course.altNote, lang))}</p>
            </details>
          )}
          <ThemePlanningInfo theme={theme} lang={lang} />
          <div className="course-tabs" aria-label={translateUi("여행 날짜")}>
            {Array.from({ length: course.dayCount }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                aria-pressed={day === d}
                className={`chip${day === d ? " active" : ""}`}
              >
                Day {translateUi(d)}
              </button>
            ))}
            <button
              className={`chip${showTune || tuned ? " active" : ""}`}
              disabled={isTuning}
              aria-expanded={showTune}
              onClick={() => setShowTune((v) => !v)}
            >
              <Icon.filter />
              {translateUi(" 조건")}
            </button>
          </div>
          {isTuning && (
            <p role="status">{translateUi("선택한 조건으로 코스를 조정하고 있어요…")}</p>
          )}
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
            {translateUi(
              "같은 날 관광지·식당·숙소 사이의 이동은 좌표로 추정해요. 첫 장소까지의 이동과 날짜 사이 이동·귀가 시간은 별도로 잡아주세요. 실제 영업시간과 교통편은 출발 전에 확인해 주세요.",
            )}
          </p>
        </div>
        <aside
          className="detail-aside summary-panel mobile-first"
          aria-label={translateUi("코스 조건과 저장")}
        >
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
                <Icon.plus />
                {translateUi(" 내 코스로 편집")}
              </Link>
              <p>{translateUi("장소·방문 순서를 바꾸고 이 일정을 저장하세요.")}</p>
              <details className="trip-facts">
                <summary>
                  {translateUi(course.dayCount)}
                  {translateUi("일 ·")}
                  {translateUi(" ")}
                  {translateUi(
                    transportChoices.find((t) => t.id === (options.transport ?? "car"))?.ko,
                  )}
                  <span>{translateUi("여행 조건")}</span>
                </summary>
                <dl className="summary-facts">
                  <div>
                    <dt>{translateUi("일정")}</dt>
                    <dd>
                      {translateUi(course.dayCount)}
                      {translateUi("일")}
                    </dd>
                  </div>
                  <div>
                    <dt>{translateUi("이동수단")}</dt>
                    <dd>
                      {translateUi(
                        transportChoices.find((t) => t.id === (options.transport ?? "car"))?.ko,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{translateUi("여행 페이스")}</dt>
                    <dd>
                      {translateUi(
                        paceChoices.find((p) => p.id === (options.pace ?? "balanced"))?.ko,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{translateUi("동행")}</dt>
                    <dd>
                      {translateUi(
                        options.companion
                          ? companionChoices.find((c) => c.id === options.companion)?.ko
                          : "자유롭게",
                      )}
                    </dd>
                  </div>
                </dl>
              </details>
              <button className="btn btn-secondary btn-block" onClick={() => setShowTune(true)}>
                <Icon.filter />
                {translateUi(" 여행 조건 바꾸기")}
              </button>
              <button
                className="btn btn-ghost btn-block"
                style={{ marginTop: 10 }}
                onClick={toggleSave}
                disabled={isPending}
              >
                {isSaved ? <Icon.bookmarkFill /> : <Icon.bookmark />}
                {translateUi(isPending ? "저장 중…" : saveLabel)}
              </button>
              <p className="summary-footnote">
                {translateUi(
                  "테마 보관은 테마만 기억해요. 지금 일정을 남기려면 내 코스로 편집하세요.",
                )}
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
  const translateUi = useUiText();
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
          <div style={{ fontSize: 13, fontWeight: 700 }}>{translateUi("코스 조건")}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
            {translateUi("선택값으로 후보 장소와 동선을 다시 조합해요.")}
          </div>
        </div>
        <button className="icon-btn" onClick={onReset} aria-label={translateUi("조건 초기화")}>
          <Icon.refresh />
        </button>
      </div>

      <TuneGroup label={translateUi("일정")}>
        {dayChoices.map((d) => (
          <button
            key={d}
            aria-pressed={days === d}
            className={"chip" + (days === d ? " active" : "")}
            onClick={() => onDays(d)}
          >
            {translateUi(lang === "ko" ? `${d}일` : `${d}d`)}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={translateUi("페이스")}>
        {paceChoices.map((p) => (
          <button
            key={p.id}
            aria-pressed={pace === p.id}
            className={"chip" + (pace === p.id ? " active" : "")}
            onClick={() => onPace(p.id)}
          >
            {translateUi(p.ko)}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={translateUi("동행")}>
        {companionChoices.map((c) => (
          <button
            key={c.id}
            aria-pressed={companion === c.id}
            className={"chip" + (companion === c.id ? " active" : "")}
            onClick={() => onCompanion(c.id)}
          >
            {translateUi(c.ko)}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={translateUi("이동수단")}>
        {transportChoices.map((t) => (
          <button
            key={t.id}
            aria-pressed={transport === t.id}
            className={"chip" + (transport === t.id ? " active" : "")}
            onClick={() => onTransport(t.id)}
          >
            {translateUi(t.ko)}
          </button>
        ))}
      </TuneGroup>

      <TuneGroup label={translateUi("시작 권역")}>
        <Select
          className="input"
          aria-label={translateUi("시작 권역")}
          value={startRegion}
          onChange={(e) => onRegion(e.target.value)}
        >
          <option value="">{translateUi("코스 기본 권역")}</option>
          {regionChoices.map((r) => (
            <option key={r} value={r}>
              {translateUi(r)}
            </option>
          ))}
        </Select>
      </TuneGroup>

      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={onApply}>
        <Icon.refresh /> {translateUi("조건 적용")}
      </button>
    </div>
  );
}

function TuneGroup({ label, children }: { label: string; children: ReactNode }) {
  const translateUi = useUiText();
  return (
    <div style={{ marginTop: 13 }}>
      <div className="course-tune-label">{translateUi(label)}</div>
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
  const translateUi = useUiText();
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
          <div style={{ fontFamily: "SF Mono, monospace", fontWeight: 600 }}>
            {translateUi(item.time)}
          </div>
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
            label={translateUi(localized(s.name, lang))}
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
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                {translateUi(localized(s.name, lang))}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                {translateUi(localized(s.type, lang))}
                {translateUi(item.durationMin ? ` · ${item.durationMin} ${"분"}` : "")}
              </div>
            </div>
            <Signal level={s.congestion} lang={lang} />
            {item.travelMinutes && (
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {translateUi("이전 관광지에서 약 ")}
                {translateUi(item.travelMinutes)}
                {translateUi("분 이동")}
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
        <span className="mono">{translateUi(item.time)}</span>
        <span className={`itinerary-kind${isEat ? " meal" : ""}`}>
          {isEat ? <Icon.utensils /> : <Icon.bed />}
        </span>
      </div>
      <ExternalLink
        className="card itinerary-commerce"
        href={`https://map.kakao.com/link/search/${encodeURIComponent(`${name} ${place.address ?? place.region.ko}`)}`}
        indicatorPlacement="within"
        lang={lang}
        aria-label={translateUi(`${name} ${"카카오맵 지도·영업정보"}`)}
      >
        <Placeholder
          src={place.imageUrl}
          label={translateUi(name)}
          h={84}
          style={{ width: 90, borderRadius: 10, flexShrink: 0 }}
        />
        <div>
          <span className="eyebrow">{translateUi(isEat ? "식사" : "숙박")}</span>
          <h3>{translateUi(name)}</h3>
          <p>{translateUi([localized(place.type, lang), price].filter(Boolean).join(" · "))}</p>
          <span className="text-link">
            {translateUi("카카오맵 · 영업정보")}
            {translateUi(" ")}
            <ExternalLinkIndicator />
          </span>
        </div>
      </ExternalLink>
    </div>
  );
}
