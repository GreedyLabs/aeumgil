"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, NewTabLink } from "@/components/external-link";
import { useRouter } from "next/navigation";
import {
  savePersonalCourseAction,
  deletePersonalCourseAction,
  searchCoursePlacesAction,
} from "@/app/actions/personal-course";
import { Select } from "@/components/select";
import { CourseDayInput } from "@/components/course-day-input";
import {
  calendarDateAt,
  courseDateCount,
  courseDateProblem,
  courseDayLabel,
} from "@/domain/course-dates";
import { useAppState } from "@/components/app-shell";
import type { PersonalCourseInput, PersonalCourseItem } from "@/domain/personal-course";
import { orderPersonalItems, personalDayStartTime } from "@/domain/personal-course";
import dayTimeStyles from "./personal-day-start.module.css";
import {
  readCourseDraft,
  preserveOlderDraft,
  prepareRecoveredDraft,
  clearRecoveredSource,
  type CourseDraftSnapshot,
} from "@/domain/personal-draft";
import { GANGWON_REGIONS } from "@/domain/place-search";
import type {
  CoursePlaceSearchResult,
  CourseSearchKind,
  CourseSearchPlace,
} from "@/domain/course-place-search";
import type { Spot } from "@/domain/types";
import { schedulePersonalCourseDay } from "@/domain/personal-course-schedule";
import { CourseMap } from "./course-map";
import { UI, Icon } from "./_ui";

export type EditorPlace = Pick<
  Spot,
  "id" | "name" | "region" | "lat" | "lon" | "imageUrl" | "hasAccessibilityInfo"
>;
export function PersonalCourseEditor({
  initial,
  initialPlaces,
  initialSearch,
  ownerId,
  draftKey,
}: {
  initial: PersonalCourseInput;
  initialPlaces: Record<string, EditorPlace>;
  initialSearch: CoursePlaceSearchResult;
  ownerId: string;
  draftKey: string;
}) {
  const [ready, setReady] = useState(false);

  const router = useRouter();
  const { showToast } = useAppState();
  const [draft, setDraft] = useState(initial);
  const [places, setPlaces] = useState(initialPlaces);
  const [dirty, setDirty] = useState(false);
  const [day, setDay] = useState(() =>
    initial.items.length ? Math.min(...initial.items.map((item) => item.day)) : 1,
  );
  const [panel, setPanel] = useState<"itinerary" | "search">("itinerary");
  const [draftNotice, setDraftNotice] = useState("");
  const [draftCached, setDraftCached] = useState(false);
  const [olderDraft, setOlderDraft] = useState<CourseDraftSnapshot | null>(null);
  const [recoverySourceKey, setRecoverySourceKey] = useState<string>();
  const [recoverySourceVersion, setRecoverySourceVersion] = useState<number>();
  const storageKey = `eumgil.draft:${ownerId}:${draftKey}`;
  const olderStorageKey = `${storageKey}:older`;
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [searchKind, setSearchKind] = useState<CourseSearchKind>("spot");
  const [accessible, setAccessible] = useState(false);
  const [results, setResults] = useState(initialSearch);
  const [searchError, setSearchError] = useState("");
  const [error, setError] = useState("");
  const [saving, startSave] = useTransition();
  const [searching, startSearch] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const request = useRef(0);
  const firstSearch = useRef(true);
  const update = (change: Partial<PersonalCourseInput>) => {
    setDraft((value) => ({ ...value, ...change }));
    setDirty(true);
    setError("");
  };
  useEffect(() => {
    try {
      const older = readCourseDraft(sessionStorage.getItem(olderStorageKey), ownerId);
      if (older) {
        setOlderDraft(older);
        setDraftNotice("이전 초안을 별도 코스로 복구할 수 있어요.");
      }
      const raw = sessionStorage.getItem(storageKey);
      const saved = readCourseDraft(raw, ownerId);
      if (saved && saved.draft.id === initial.id && saved.draft.version === initial.version) {
        setDraft(saved.draft);
        setDay(
          saved.draft.items.length ? Math.min(...saved.draft.items.map((item) => item.day)) : 1,
        );
        setPlaces({ ...initialPlaces, ...saved.places });
        setRecoverySourceKey(saved.recoverySourceKey);
        setRecoverySourceVersion(saved.recoverySourceVersion);
        setDirty(true);
        setDraftCached(true);
        setDraftNotice("이 탭에서 편집하던 초안을 이어서 불러왔어요.");
      } else if (saved && saved.draft.id === initial.id && raw) {
        preserveOlderDraft(sessionStorage, storageKey, raw);
        setOlderDraft(saved);
        setDraftNotice(
          "다른 곳에서 저장한 최신 코스를 불러왔어요. 이전 초안은 별도 코스로 복구할 수 있어요.",
        );
      } else if (raw) {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      setDraftNotice(
        "이 브라우저에서는 임시 저장을 사용할 수 없어요. 이동 전에 코스를 저장해 주세요.",
      );
    }
    setReady(true);
    // 같은 코스의 초기 버전을 기준으로 한 번만 복원한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    if (!ready || !dirty) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ draft, places, recoverySourceKey, recoverySourceVersion }),
      );
      setDraftCached(true);
    } catch {
      setDraftCached(false);
    }
  }, [ready, dirty, draft, places, storageKey, recoverySourceKey, recoverySourceVersion]);
  const clearDraft = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* 임시 저장 미지원 */
    }
  };
  useEffect(() => {
    if (!dirty || draftCached) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, draftCached]);
  const searchPage = (page: number) => {
    const seq = ++request.current;
    setSearchError("");
    startSearch(async () => {
      try {
        const result = await searchCoursePlacesAction(
          {
            q: query,
            region,
            accessibility: accessible ? "info" : "",
            page,
          },
          searchKind,
        );
        if (seq === request.current) setResults(result);
      } catch {
        if (seq === request.current)
          setSearchError("장소 검색을 불러오지 못했어요. 다시 검색해 주세요.");
      }
    });
  };
  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false;
      return;
    }
    ++request.current;
    const timer = setTimeout(() => searchPage(1), 350);
    return () => clearTimeout(timer);
    // 검색 입력이 바뀔 때만 실행한다. 요청 번호로 늦게 도착한 응답을 무시한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, region, accessible, searchKind]);
  const items = useMemo(() => orderPersonalItems(draft.items), [draft.items]);
  const dateProblem = courseDateProblem(draft, items);
  const selectedDayProblem = courseDateProblem(draft, [{ day }]);
  const scheduledDays = [...new Set(items.map((item) => item.day))];
  const dateCount = courseDateCount(draft.startDate, draft.endDate);
  const selectedStartTime = personalDayStartTime(draft, day);
  const hasDayStartTime = draft.dayStartTimes?.[String(day)] !== undefined;
  const changeDayStartTime = (time: string) => {
    const next = { ...draft.dayStartTimes };
    if (time && !hasDayStartTime && Object.keys(next).length >= 30) {
      showToast("날짜별 출발 시간은 최대 30개까지 설정할 수 있어요. 기존 설정을 먼저 비워 주세요.");
      return;
    }
    if (time) next[String(day)] = time;
    else delete next[String(day)];
    update({ dayStartTimes: next });
  };
  const changeStartDate = (startDate: string) => {
    if (!startDate) {
      update({ startDate: undefined, endDate: undefined });
      return;
    }
    // 출발일을 옮겨도 장소의 상대 일차와 여행 기간은 유지한다.
    const duration = dateCount ?? Math.max(1, ...items.map((item) => item.day));
    const endDate =
      !draft.startDate && courseDateCount(startDate, draft.endDate)
        ? draft.endDate
        : calendarDateAt(startDate, duration);
    update({ startDate, endDate });
  };
  const mapData = useMemo(
    () => schedulePersonalCourseDay(draft, places, day),
    [draft, places, day],
  );
  const add = (spot: CourseSearchPlace) => {
    if (selectedDayProblem) {
      showToast(selectedDayProblem);
      return;
    }
    if (draft.items.length >= 30) {
      showToast("한 코스에는 최대 30곳을 담을 수 있어요.");
      return;
    }
    setPlaces((current) => ({ ...current, [spot.id]: spot }));
    update({
      items: [
        ...draft.items,
        { kind: spot.kind, refId: spot.id, day, durationMin: spot.kind === "stay" ? 480 : 60 },
      ],
    });
    showToast(`${courseDayLabel(day, draft.startDate)}에 ${spot.name.ko} 추가했어요.`);
  };
  const patchItem = (index: number, change: Partial<PersonalCourseItem>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...change } : item));
    if (
      new Set(next.map((item) => `${item.day}:${item.kind}:${item.refId}`)).size !== next.length
    ) {
      showToast("그 날짜에 이미 같은 장소가 있어요.");
      return;
    }
    update({ items: next });
  };
  const move = (index: number, step: number) => {
    const next = [...items];
    const target = next[index + step];
    const current = next[index];
    if (!target || !current || target.day !== current.day) return;
    next[index] = target;
    next[index + step] = current;
    update({ items: next });
  };
  const save = () =>
    startSave(async () => {
      const result = await savePersonalCourseAction(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clearDraft();
      try {
        clearRecoveredSource(sessionStorage, ownerId, recoverySourceKey, recoverySourceVersion);
      } catch {
        /* DB 저장은 완료됐으므로 백업 삭제 실패는 초안 유지로 처리한다. */
      }
      setRecoverySourceKey(undefined);
      setRecoverySourceVersion(undefined);
      setDraftNotice("");
      setDraft(result.course);
      setDirty(false);
      showToast("내 코스를 저장했어요.");
      if (!draft.id) router.replace(`/my-courses/${result.course.id}`);
    });
  return (
    <div className="screen-enter personal-course-page">
      <UI.TopBar
        title="나만의 코스"
        right={
          <Link href="/saved" className="text-link">
            내 여행 <Icon.chevR />
          </Link>
        }
      />
      <fieldset className={`editor-controls editor-panel-${panel}`} disabled={!ready || saving}>
        <header className="page-heading">
          <div>
            <span className="eyebrow">장소를 담고, 나만의 순서로</span>
            <h1>{draft.id ? "내 여행을 다듬어볼까요?" : "나만의 여행 만들기"}</h1>
            <p>
              추천 코스를 바꾸거나 빈 일정부터 시작하세요. 저장한 코스는 내 계정에서만 볼 수 있어요.
            </p>
          </div>
        </header>
        {draftNotice && (
          <p className="notice" role="status">
            {draftNotice}
          </p>
        )}
        {olderDraft && (
          <div className="draft-recovery-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                try {
                  const href = prepareRecoveredDraft(
                    sessionStorage,
                    ownerId,
                    olderStorageKey,
                    olderDraft,
                    crypto.randomUUID(),
                  );
                  router.push(href);
                } catch {
                  setError(
                    "복구본을 임시 저장하지 못했어요. 이전 초안은 그대로 보관 중이니 다시 시도해 주세요.",
                  );
                }
              }}
            >
              이전 초안을 새 코스로 복구
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                try {
                  sessionStorage.removeItem(olderStorageKey);
                  setOlderDraft(null);
                  setDraftNotice("");
                } catch {
                  setError("이전 초안을 삭제하지 못했어요. 다시 시도해 주세요.");
                }
              }}
            >
              이전 초안 삭제
            </button>
          </div>
        )}
        <div className="personal-course-meta card">
          <label>
            코스 이름
            <input
              className="input"
              maxLength={60}
              placeholder="부모님과 여유로운 양구 여행"
              disabled={!ready}
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label>
            여행 메모
            <textarea
              className="input"
              maxLength={500}
              rows={2}
              placeholder="함께 가는 사람, 챙길 것, 예약할 곳…"
              disabled={!ready}
              value={draft.note}
              onChange={(e) => update({ note: e.target.value })}
            />
          </label>
          <fieldset className="personal-date-range" disabled={!ready}>
            <legend>
              여행 날짜 <span>미정이면 비워 두세요</span>
            </legend>
            <div className="personal-date-fields">
              <label>
                여행 시작일
                <input
                  className="input"
                  type="date"
                  min="0001-01-01"
                  max="9999-12-31"
                  value={draft.startDate ?? ""}
                  onChange={(event) => changeStartDate(event.target.value)}
                />
              </label>
              <label>
                여행 종료일
                <input
                  className="input"
                  type="date"
                  min={draft.startDate ?? "0001-01-01"}
                  max="9999-12-31"
                  value={draft.endDate ?? ""}
                  onChange={(event) => update({ endDate: event.target.value || undefined })}
                />
              </label>
            </div>
            <div className="personal-date-summary">
              <p>
                {dateCount ? `${dateCount}일 여행 · ` : "날짜 미정 · "}출발일을 바꾸면 장소의 일차와
                방문 순서는 그대로 유지돼요.
              </p>
              {(draft.startDate || draft.endDate) && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => update({ startDate: undefined, endDate: undefined })}
                >
                  날짜 미정으로
                </button>
              )}
            </div>
            {dateProblem && (
              <p role="alert" className="notice">
                {dateProblem}
              </p>
            )}
          </fieldset>
          <div className="personal-plan-options">
            <label>
              이동수단
              <Select
                aria-label="내 코스 이동수단"
                value={draft.transport}
                onChange={(e) =>
                  update({ transport: e.target.value as PersonalCourseInput["transport"] })
                }
              >
                <option value="car">자동차</option>
                <option value="transit">대중교통</option>
                <option value="walk">도보</option>
              </Select>
            </label>
            <label>
              하루 출발 시간
              <input
                className="input"
                type="time"
                value={draft.startTime}
                onChange={(e) => update({ startTime: e.target.value })}
              />
            </label>
          </div>
          <div className="personal-save-row desktop-plan-save">
            <span role="status">
              {dirty || !draft.id ? "아직 저장하지 않은 변경사항" : "저장된 코스"} ·{" "}
              {draft.items.length}/30곳
            </span>
            <button
              className="btn btn-primary"
              disabled={
                !ready ||
                saving ||
                !draft.items.length ||
                !draft.title.trim() ||
                Boolean(dateProblem)
              }
              onClick={save}
            >
              {saving ? "저장 중…" : "내 코스 저장"}
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </div>
        <div className="editor-mobile-tabs" role="tablist" aria-label="코스 편집 화면">
          <button
            role="tab"
            aria-selected={panel === "itinerary"}
            onClick={() => setPanel("itinerary")}
          >
            일정 <span>{draft.items.length}</span>
          </button>
          <button role="tab" aria-selected={panel === "search"} onClick={() => setPanel("search")}>
            + 장소 추가
          </button>
        </div>
        <div className="personal-course-layout">
          <section className="personal-itinerary" aria-label="내 코스 일정">
            <div className="section-heading">
              <h2>방문 순서</h2>
              <CourseDayInput
                label="편집할 날짜"
                value={day}
                onChange={setDay}
                startDate={draft.startDate}
                endDate={draft.endDate}
                navigation
                disabled={!ready}
              />
            </div>
            <p className="personal-day-label">{courseDayLabel(day, draft.startDate)}</p>
            {scheduledDays.length > 1 && (
              <div className="personal-day-shortcuts" aria-label="장소가 있는 날짜">
                {scheduledDays.map((value) => (
                  <button
                    type="button"
                    className={`chip${value === day ? " brand" : ""}`}
                    key={value}
                    aria-pressed={value === day}
                    onClick={() => setDay(value)}
                  >
                    {courseDayLabel(value, draft.startDate)}
                  </button>
                ))}
              </div>
            )}
            <fieldset className={dayTimeStyles.panel} disabled={!ready}>
              <label>
                이 날짜 출발 시간
                <input
                  className="input"
                  type="time"
                  value={selectedStartTime}
                  onChange={(event) => changeDayStartTime(event.target.value)}
                  aria-describedby="personal-day-start-help"
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!hasDayStartTime}
                onClick={() => changeDayStartTime("")}
              >
                기본 시간 사용
              </button>
              <p id="personal-day-start-help">
                {hasDayStartTime
                  ? "이 날짜에만 따로 정한 시간이 있어요. 다른 날짜에는 영향을 주지 않아요."
                  : `따로 정하지 않아 하루 출발 시간 ${draft.startTime}을 사용해요.`}
              </p>
            </fieldset>
            <p className="section-description">
              {selectedStartTime} 출발 ·{" "}
              {{ car: "자동차", transit: "대중교통", walk: "도보" }[draft.transport]} 이동
              추정이에요. 실제 길찾기·운행 시간은 출발 전 확인해 주세요.
            </p>
            <p className={dayTimeStyles.scheduleHint}>
              방문 예정 시각이 있으면 그때까지 여유를 두고, 이동이 늦어지면 도착도 늦춰요. 출발을
              앞당길 때는 각 장소의 예정 시각도 바꾸거나 비워 주세요.
            </p>
            <ol className="personal-stop-list">
              {items.map(
                (item, index) =>
                  item.day === day && (
                    <li key={`${item.day}:${item.kind}:${item.refId}`}>
                      <div className="personal-stop-heading">
                        <span className="route-order">
                          {items.slice(0, index + 1).filter((i) => i.day === day).length}
                        </span>
                        <strong>{places[item.refId]?.name.ko ?? "정보를 찾을 수 없는 장소"}</strong>
                        <button
                          className="icon-btn"
                          aria-label={`${places[item.refId]?.name.ko ?? item.refId} 제거`}
                          onClick={() => update({ items: items.filter((_, i) => i !== index) })}
                        >
                          <Icon.close />
                        </button>
                      </div>
                      {item.kind === "festival" && (
                        <NewTabLink
                          className="text-link"
                          href={`/festival/${item.refId.replace(/^festival-/, "")}`}
                        >
                          행사 일정·상세 확인
                        </NewTabLink>
                      )}
                      {places[item.refId]?.hasAccessibilityInfo && (
                        <NewTabLink className="text-link" href={`/spot/${item.refId}`}>
                          무장애 시설 안내 확인
                        </NewTabLink>
                      )}
                      <div className="personal-stop-controls">
                        <label>
                          방문 날짜
                          <CourseDayInput
                            label={`${places[item.refId]?.name.ko} 날짜`}
                            value={item.day}
                            onChange={(next) => patchItem(index, { day: next })}
                            startDate={draft.startDate}
                            endDate={draft.endDate}
                            disabled={!ready}
                          />
                        </label>
                        <label>
                          머무는 시간
                          <input
                            type="number"
                            min={15}
                            max={720}
                            step={15}
                            value={item.durationMin}
                            onChange={(e) =>
                              patchItem(index, { durationMin: Number(e.target.value) })
                            }
                          />
                          분
                        </label>
                        <div className="personal-order-buttons">
                          <button
                            className="icon-btn"
                            aria-label={`${places[item.refId]?.name.ko} 위로`}
                            disabled={items[index - 1]?.day !== day}
                            onClick={() => move(index, -1)}
                          >
                            ↑
                          </button>
                          <button
                            className="icon-btn"
                            aria-label={`${places[item.refId]?.name.ko} 아래로`}
                            disabled={items[index + 1]?.day !== day}
                            onClick={() => move(index, 1)}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                      <div className={dayTimeStyles.visitTime}>
                        <label>
                          방문 예정 시각(선택)
                          <input
                            className="input"
                            type="time"
                            aria-label={`${places[item.refId]?.name.ko ?? item.refId} 방문 예정 시각`}
                            value={item.notBeforeTime ?? ""}
                            onChange={(event) =>
                              patchItem(index, { notBeforeTime: event.target.value || undefined })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          aria-label={`${places[item.refId]?.name.ko ?? item.refId} 예정 시각 해제`}
                          disabled={!item.notBeforeTime}
                          onClick={() => patchItem(index, { notBeforeTime: undefined })}
                        >
                          시각 해제
                        </button>
                      </div>
                    </li>
                  ),
              )}
            </ol>
            {!items.some((item) => item.day === day) && (
              <div className="empty-state">
                <Icon.pin />
                <h3>{courseDayLabel(day, draft.startDate)}에 가볼 곳을 담아보세요</h3>
                <p>장소 추가에서 여행지를 찾아 일정을 채워보세요.</p>
                <button className="btn btn-primary mobile-only" onClick={() => setPanel("search")}>
                  가볼 곳 추가
                </button>
              </div>
            )}
            {mapData.tooLong && (
              <p role="status" className="notice">
                이 날의 일정이 길어요. 장소를 다음 날로 옮기거나 체류 시간을 줄여보세요.
              </p>
            )}
            <CourseMap stops={mapData.stops} legs={mapData.legs} day={day} />
          </section>
          <section className="personal-search card" aria-label="코스에 장소 추가">
            <div className="section-heading">
              <h2>가볼 곳 추가</h2>
              <CourseDayInput
                label="장소를 추가할 날짜"
                value={day}
                onChange={setDay}
                startDate={draft.startDate}
                endDate={draft.endDate}
                navigation
                disabled={!ready}
              />
            </div>
            <p className="personal-day-label">{courseDayLabel(day, draft.startDate)}에 추가해요</p>
            {selectedDayProblem && (
              <p role="alert" className="notice">
                {selectedDayProblem}
              </p>
            )}
            <Select
              aria-label="추가할 장소 종류"
              value={searchKind}
              onChange={(e) => {
                setSearchKind(e.target.value as CourseSearchKind);
                setQuery("");
                setAccessible(false);
              }}
            >
              <option value="spot">여행지</option>
              <option value="eat">음식점</option>
              <option value="stay">숙소</option>
            </Select>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                searchPage(1);
              }}
            >
              <div className="search-field">
                <Icon.search />
                <input
                  type="search"
                  aria-label="내 코스 여행지 검색"
                  disabled={!ready}
                  maxLength={100}
                  placeholder={`${{ spot: "여행지", eat: "음식점", stay: "숙소" }[searchKind]} 이름이나 지역 검색`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button className="btn btn-primary btn-sm" type="submit">
                  검색
                </button>
              </div>
              <Select
                aria-label="추가할 여행지 지역"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="">강원 전체</option>
                {GANGWON_REGIONS.map((r) => (
                  <option key={r.key} value={r.ko}>
                    {r.ko}
                  </option>
                ))}
              </Select>
              {searchKind === "spot" && (
                <label className="accessibility-filter">
                  <input
                    type="checkbox"
                    checked={accessible}
                    onChange={(e) => setAccessible(e.target.checked)}
                  />
                  무장애 안내 있는 곳
                </label>
              )}
            </form>
            {searchError && <p role="alert">{searchError}</p>}
            <p className="data-caption" aria-live="polite">
              {searching
                ? "장소를 찾고 있어요…"
                : `${results.total.toLocaleString()}곳 · Day ${day}에 추가`}
            </p>
            <div className="personal-search-results" aria-busy={searching}>
              {results.kind === searchKind &&
                results.items.map((spot) => {
                  const added = draft.items.some(
                    (item) => item.refId === spot.id && item.day === day,
                  );
                  return (
                    <article key={spot.id}>
                      <div>
                        <strong>{spot.name.ko}</strong>
                        <small>
                          {spot.region.ko} · {spot.type.ko}
                          {spot.hasAccessibilityInfo ? " · 무장애 안내" : ""}
                        </small>
                        {spot.kind === "spot" ? (
                          <NewTabLink href={`/spot/${spot.id}`} className="text-link">
                            상세 보기
                          </NewTabLink>
                        ) : (
                          <ExternalLink
                            href={`https://map.kakao.com/link/search/${encodeURIComponent(`${spot.region.ko} ${spot.name.ko}`)}`}
                            className="text-link"
                          >
                            카카오맵 · 영업·예약 정보
                          </ExternalLink>
                        )}
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={!ready || added || saving || Boolean(selectedDayProblem)}
                        aria-label={`${spot.name.ko} 추가`}
                        onClick={() => add(spot)}
                      >
                        {added ? "추가됨" : "+ 추가"}
                      </button>
                    </article>
                  );
                })}
            </div>
            {!results.items.length && <p>검색 결과가 없어요. 검색어나 지역 조건을 바꿔보세요.</p>}
            <nav className="places-pagination" aria-label="추가할 여행지 페이지">
              <button
                className="btn btn-secondary btn-sm"
                disabled={searching || results.page <= 1}
                onClick={() => searchPage(results.page - 1)}
              >
                이전
              </button>
              <span>
                {results.page} / {Math.max(1, Math.ceil(results.total / results.pageSize))}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={searching || results.page * results.pageSize >= results.total}
                onClick={() => searchPage(results.page + 1)}
              >
                다음
              </button>
            </nav>
          </section>
        </div>
        {draft.id && (
          <div className="personal-delete">
            {confirmDelete ? (
              <>
                <p>이 개인 코스를 삭제할까요?</p>
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                  취소
                </button>
                <button
                  className="btn btn-danger"
                  disabled={saving}
                  onClick={() =>
                    startSave(async () => {
                      const result = await deletePersonalCourseAction(draft.id!);
                      if (result.ok) {
                        clearDraft();
                        setDirty(false);
                        router.push("/saved");
                      } else setError("삭제하지 못했어요. 다시 시도해 주세요.");
                    })
                  }
                >
                  삭제 확인
                </button>
              </>
            ) : (
              <button className="text-link" onClick={() => setConfirmDelete(true)}>
                이 코스 삭제
              </button>
            )}
          </div>
        )}
        <div className="mobile-plan-save">
          <span>
            {draft.items.length}곳 ·{" "}
            {dirty
              ? draftCached
                ? "이 탭에 임시 저장됨"
                : "저장 전 변경사항"
              : draft.id
                ? "저장된 코스"
                : "새 코스"}
          </span>
          <button
            className="btn btn-primary"
            disabled={
              !ready || saving || !draft.items.length || !draft.title.trim() || Boolean(dateProblem)
            }
            onClick={save}
          >
            {saving ? "저장 중…" : "내 코스 저장"}
          </button>
        </div>
      </fieldset>
    </div>
  );
}
