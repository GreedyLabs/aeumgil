"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  savePersonalCourseAction,
  deletePersonalCourseAction,
  searchCoursePlacesAction,
} from "@/app/actions/personal-course";
import { Select } from "@/components/select";
import { useAppState } from "@/components/app-shell";
import type { PersonalCourseInput, PersonalCourseItem } from "@/domain/personal-course";
import { orderPersonalItems } from "@/domain/personal-course";
import { GANGWON_REGIONS, type PlaceSearchResult } from "@/domain/place-search";
import type { Spot } from "@/domain/types";
import type { CourseMapStop, CourseRouteLeg } from "@/domain/course-map";
import { estimateDrive } from "@/domain/travel-time";
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
}: {
  initial: PersonalCourseInput;
  initialPlaces: Record<string, EditorPlace>;
  initialSearch: PlaceSearchResult;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const router = useRouter();
  const { showToast } = useAppState();
  const [draft, setDraft] = useState(initial);
  const [places, setPlaces] = useState(initialPlaces);
  const [dirty, setDirty] = useState(false);
  const [day, setDay] = useState(1);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
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
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const searchPage = (page: number) => {
    const seq = ++request.current;
    setSearchError("");
    startSearch(async () => {
      try {
        const result = await searchCoursePlacesAction({
          q: query,
          region,
          accessibility: accessible ? "info" : "",
          page,
        });
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
  }, [query, region, accessible]);
  const items = useMemo(() => orderPersonalItems(draft.items), [draft.items]);
  const mapData = useMemo(() => {
    const today = items.filter((item) => item.day === day);
    const stops: CourseMapStop[] = [];
    const legs: CourseRouteLeg[] = [];
    let minutes = 9 * 60 + 30;
    for (const item of today) {
      const place = places[item.refId];
      if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue;
      const previous = stops.at(-1);
      if (previous) {
        const estimate = estimateDrive(previous, { lat: place.lat!, lon: place.lon! }, "car");
        if (!estimate) continue;
        minutes += estimate.driveMinutes;
        legs.push({
          day,
          fromId: previous.id,
          toId: place.id,
          minutes: estimate.driveMinutes,
          distanceKm: estimate.distanceKm,
          source: "approx",
        });
      }
      const time =
        minutes < 24 * 60
          ? `${Math.floor(minutes / 60)
              .toString()
              .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`
          : "일정 조정 필요";
      stops.push({
        id: place.id,
        name: place.name.ko,
        lat: place.lat!,
        lon: place.lon!,
        kind: item.kind === "festival" ? "spot" : item.kind,
        time,
      });
      minutes += item.durationMin;
    }
    return { stops, legs, tooLong: minutes > 21 * 60 };
  }, [items, places, day]);
  const add = (spot: Spot) => {
    if (draft.items.length >= 30) {
      showToast("한 코스에는 최대 30곳을 담을 수 있어요.");
      return;
    }
    setPlaces((current) => ({ ...current, [spot.id]: spot }));
    update({ items: [...draft.items, { kind: "spot", refId: spot.id, day, durationMin: 60 }] });
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
      <fieldset className="editor-controls" disabled={!ready || saving}>
        <header className="page-heading">
          <div>
            <span className="eyebrow">장소를 담고, 나만의 순서로</span>
            <h1>{draft.id ? "내 여행을 다듬어볼까요?" : "나만의 여행 만들기"}</h1>
            <p>
              추천 코스를 바꾸거나 빈 일정부터 시작하세요. 저장한 코스는 내 계정에서만 볼 수 있어요.
            </p>
          </div>
        </header>
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
          <div className="personal-save-row">
            <span role="status">
              {dirty || !draft.id ? "아직 저장하지 않은 변경사항" : "저장된 코스"} ·{" "}
              {draft.items.length}/30곳
            </span>
            <button
              className="btn btn-primary"
              disabled={saving || !draft.items.length || !draft.title.trim()}
              onClick={save}
            >
              {saving ? "저장 중…" : "내 코스 저장"}
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </div>
        <div className="personal-course-layout">
          <section className="personal-itinerary" aria-label="내 코스 일정">
            <div className="section-heading">
              <h2>방문 순서</h2>
              <Select
                aria-label="편집할 날짜"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    Day {value}
                  </option>
                ))}
              </Select>
            </div>
            <p className="section-description">
              선택한 날짜에 장소를 추가해요. 이동은 오전 9:30 출발·자동차 기준 추정입니다.
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
                        <Link
                          className="text-link"
                          target="_blank"
                          href={`/festival/${item.refId.replace(/^festival-/, "")}`}
                        >
                          행사 일정·상세 확인 ↗
                        </Link>
                      )}
                      {places[item.refId]?.hasAccessibilityInfo && (
                        <Link className="text-link" href={`/spot/${item.refId}`} target="_blank">
                          무장애 시설 안내 확인 ↗
                        </Link>
                      )}
                      <div className="personal-stop-controls">
                        <Select
                          aria-label={`${places[item.refId]?.name.ko} 날짜`}
                          value={item.day}
                          onChange={(e) => patchItem(index, { day: Number(e.target.value) })}
                        >
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={value}>
                              Day {value}
                            </option>
                          ))}
                        </Select>
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
                    </li>
                  ),
              )}
            </ol>
            {!items.some((item) => item.day === day) && (
              <div className="empty-state">
                <Icon.pin />
                <h3>Day {day}에 가볼 곳을 담아보세요</h3>
                <p>아래 검색에서 원하는 여행지를 추가하세요.</p>
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
            <h2>가볼 곳 추가</h2>
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
                  placeholder="장소 이름이나 지역 검색"
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
              <label className="accessibility-filter">
                <input
                  type="checkbox"
                  checked={accessible}
                  onChange={(e) => setAccessible(e.target.checked)}
                />
                무장애 안내 있는 곳
              </label>
            </form>
            {searchError && <p role="alert">{searchError}</p>}
            <p className="data-caption" aria-live="polite">
              {searching
                ? "장소를 찾고 있어요…"
                : `${results.total.toLocaleString()}곳 · Day ${day}에 추가`}
            </p>
            <div className="personal-search-results" aria-busy={searching}>
              {results.items.map((spot) => {
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
                      <Link href={`/spot/${spot.id}`} target="_blank" className="text-link">
                        상세 보기 ↗
                      </Link>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={added || saving}
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
      </fieldset>
    </div>
  );
}
