"use client";
import { listProgress } from "@/lib/display-formats";
import { useUiText } from "@/components/use-ui-text";
import { Select } from "@/components/select";
import { InfiniteScroll } from "@/components/infinite-scroll";
import { searchPlacesAction } from "@/app/actions/search-places";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useHydrated } from "@/lib/use-hydrated";
import { useRouter } from "next/navigation";
import { localized } from "@/lib/i18n";
import { useAppState } from "@/components/app-shell";
import {
  GANGWON_REGIONS,
  PLACE_CATEGORIES,
  placeSearchParams,
  type PlaceSearchQuery,
  type PlaceSearchResult,
} from "@/domain/place-search";
import { UI, Icon } from "./_ui";
import { LocationMap } from "./location-map";

export function MapView({
  result,
  embedded = false,
}: {
  result: PlaceSearchResult;
  embedded?: boolean;
}) {
  const translateUi = useUiText();
  const ready = useHydrated();
  const { lang } = useAppState();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchWaiting, setSearchWaiting] = useState(false);
  const filterPending = useRef(false);
  const requestGeneration = useRef(0);
  const loadingRequest = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const draftFilters = useRef(result.query);
  const [displayFilters, setDisplayFilters] = useState(result.query);
  useEffect(() => setDisplayFilters(result.query), [result.query]);
  const lastMapButton = useRef<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState(result.query.q);
  const [selectedId, setSelectedId] = useState<string>();
  const [showMap, setShowMap] = useState(false);
  const [compactLayout, setCompactLayout] = useState(false);
  const mapBlocksLoading = compactLayout && showMap;
  const mapLoadingPaused = useRef(mapBlocksLoading);
  mapLoadingPaused.current = mapBlocksLoading;
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1099px)");
    const update = () => setCompactLayout(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mapBlocksLoading) return;
    // 모바일 지도 위치를 유지하는 동안 목록이 앞뒤로 계속 늘어나지 않게 한다.
    requestGeneration.current++;
    loadingRequest.current = false;
    setLoadingMore(false);
  }, [mapBlocksLoading]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const composing = useRef(false);
  const previousQuery = useRef(result.query.q);
  const mapRef = useRef<HTMLElement>(null);
  const filterKey = placeSearchParams(result.query).toString();
  const searchKey = `${lang}:${filterKey}`;
  const activeSearchKey = useRef(searchKey);
  activeSearchKey.current = searchKey;
  const [loaded, setLoaded] = useState({ key: searchKey, result, complete: false });
  const listing = loaded.key === searchKey ? loaded.result : result;
  const hasMore =
    !(loaded.key === searchKey && loaded.complete) &&
    listing.page < 500 &&
    listing.page * listing.pageSize < listing.total;
  useEffect(() => {
    requestGeneration.current++;
    loadingRequest.current = false;
    setLoadingMore(false);
    setLoadError(undefined);
    setLoaded({ key: searchKey, result, complete: false });
  }, [result, searchKey]);
  // 뒤로 가기로 검색 조건이 돌아와도 입력값과 결과를 일치시킨다.
  useEffect(() => {
    const previous = previousQuery.current;
    setQuery((current) => (current === previous ? result.query.q : current));
    previousQuery.current = result.query.q;
    setSelectedId(undefined);
    setShowMap(false);
  }, [filterKey, result.query.q]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      requestGeneration.current++;
    },
    [],
  );
  useEffect(() => {
    if (!pending && !timer.current && !composing.current) {
      draftFilters.current = result.query;
      filterPending.current = false;
      setSearchWaiting(false);
    }
  }, [pending, result.query]);
  const invalidateMore = () => {
    requestGeneration.current++;
    loadingRequest.current = false;
    filterPending.current = true;
    setSearchWaiting(true);
    setLoadingMore(false);
    setLoadError(undefined);
  };
  const navigate = (changes: PlaceSearchQuery) => {
    clearTimeout(timer.current);
    timer.current = undefined;
    invalidateMore();
    draftFilters.current = { ...draftFilters.current, q: query, page: 1, ...changes };
    setDisplayFilters(draftFilters.current);
    const params = placeSearchParams(draftFilters.current);
    if (params.toString() === filterKey) {
      filterPending.current = false;
      setSearchWaiting(false);
      return;
    }
    startTransition(() =>
      router.replace(`/discover?tab=places${params.size ? `&${params}` : ""}`, { scroll: false }),
    );
  };
  const search = (value: string) => {
    invalidateMore();
    setQuery(value);
    clearTimeout(timer.current);
    if (composing.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      navigate({ q: value });
    }, 350);
  };
  const loadMore = async () => {
    if (
      !ready ||
      pending ||
      filterPending.current ||
      mapLoadingPaused.current ||
      loadingRequest.current ||
      !hasMore
    )
      return;
    const generation = requestGeneration.current;
    const key = searchKey;
    const previousPage = listing.page;
    loadingRequest.current = true;
    setLoadingMore(true);
    setLoadError(undefined);
    try {
      const response = await searchPlacesAction({ ...result.query, page: previousPage + 1 });
      if (
        generation !== requestGeneration.current ||
        key !== activeSearchKey.current ||
        mapLoadingPaused.current
      )
        return;
      if (!response.ok) {
        setLoadError(response.error);
        return;
      }
      setLoaded((current) => {
        if (current.key !== key || current.result.page !== previousPage) return current;
        const seen = new Set(current.result.items.map((place) => place.id));
        const additional = response.result.items.filter((place) => {
          if (seen.has(place.id)) return false;
          seen.add(place.id);
          return true;
        });
        return {
          key,
          complete: additional.length === 0 || response.result.page <= previousPage,
          result: { ...response.result, items: [...current.result.items, ...additional] },
        };
      });
    } catch {
      if (
        generation === requestGeneration.current &&
        key === activeSearchKey.current &&
        !mapLoadingPaused.current
      )
        setLoadError("여행지를 더 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (generation === requestGeneration.current && key === activeSearchKey.current) {
        loadingRequest.current = false;
        setLoadingMore(false);
      }
    }
  };
  const selected = listing.items.find((p) => p.id === selectedId) ?? listing.items[0];
  return (
    <div className="screen-enter places-page">
      {!embedded && (
        <UI.TopBar
          title={translateUi("여행지 찾기")}
          right={
            <Link href="/discover" className="text-link">
              {translateUi("테마 코스 ")}
              <Icon.chevR />
            </Link>
          }
        />
      )}
      {!embedded && (
        <header className="page-heading">
          <div>
            <span className="eyebrow">{translateUi("강원 18개 시군의 여행지")}</span>
            <h1>{translateUi("어디로 떠나볼까요?")}</h1>
            <p>{translateUi("이름·지역·주소로 찾고, 마음에 드는 장소의 위치를 확인하세요.")}</p>
          </div>
        </header>
      )}
      <form
        className="places-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ q: query });
        }}
      >
        <div className="search-field">
          <Icon.search />
          <input
            type="search"
            aria-label={translateUi("관광지 검색")}
            disabled={!ready}
            placeholder={translateUi("속초 해변, 박수근미술관, 정동진…")}
            value={query}
            maxLength={100}
            onChange={(e) => search(e.target.value)}
            onCompositionStart={() => {
              invalidateMore();
              composing.current = true;
              clearTimeout(timer.current);
              timer.current = undefined;
            }}
            onCompositionEnd={(e) => {
              composing.current = false;
              search(e.currentTarget.value);
            }}
          />
          <button className="btn btn-primary btn-sm" disabled={!ready} type="submit">
            {translateUi("검색")}
          </button>
        </div>
        <label className="places-region">
          <span>{translateUi("지역")}</span>
          <Select
            aria-label={translateUi("여행지 지역")}
            value={displayFilters.region}
            onChange={(e) => navigate({ region: e.target.value })}
          >
            <option value="">{translateUi("강원 전체")}</option>
            {GANGWON_REGIONS.map((r) => (
              <option key={r.key} value={r.ko}>
                {translateUi(r.ko)}
              </option>
            ))}
          </Select>
        </label>
      </form>
      <details className="places-extra-filters">
        <summary>
          <Icon.filter />
          {translateUi(" 종류·무장애 조건")}
          {translateUi(displayFilters.category || displayFilters.accessibility ? " · 적용 중" : "")}
        </summary>
        <div className="places-categories" aria-label={translateUi("여행지 종류")}>
          {[{ id: "", label: "전체" }, ...PLACE_CATEGORIES].map((c) => (
            <button
              disabled={!ready}
              key={c.id}
              className={`chip${displayFilters.category === c.id ? " active" : ""}`}
              aria-pressed={displayFilters.category === c.id}
              onClick={() => navigate({ category: c.id })}
            >
              {translateUi(c.label)}
            </button>
          ))}
        </div>
        <label className="accessibility-filter">
          <input
            type="checkbox"
            disabled={!ready}
            checked={displayFilters.accessibility === "info"}
            onChange={(e) => navigate({ accessibility: e.target.checked ? "info" : "" })}
          />
          {translateUi(" ")}
          {translateUi("무장애 안내 있는 곳")}
        </label>
      </details>
      <div className="results-heading">
        <h2 aria-live="polite">
          {pending || searchWaiting ? (
            translateUi("여행지를 찾고 있어요…")
          ) : (
            <>
              {translateUi("여행지 ")}
              <span>
                {listing.total.toLocaleString(lang)}
                {lang === "ko" ? "곳" : ""}
              </span>
            </>
          )}
        </h2>
        {(result.query.q ||
          result.query.region ||
          result.query.category ||
          result.query.accessibility) && (
          <button
            className="text-link"
            disabled={!ready}
            onClick={() => {
              setQuery("");
              navigate({ q: "", region: "", category: "", accessibility: "" });
            }}
          >
            {translateUi("검색 초기화")}
          </button>
        )}
      </div>
      <div className="places-layout" aria-busy={pending || searchWaiting}>
        <section className="places-results" aria-label={translateUi("관광지 검색 결과")}>
          {listing.items.length ? (
            <>
              <div className="places-grid">
                {listing.items.map((p) => (
                  <article
                    key={p.id}
                    className={`place-card${selected?.id === p.id ? " is-selected" : ""}`}
                  >
                    {selected?.id === p.id && (
                      <span className="place-selection-mark" aria-hidden="true">
                        ✓
                      </span>
                    )}
                    <button
                      className="place-card-select"
                      disabled={!ready}
                      aria-label={translateUi(`${localized(p.name, lang)} 지도 보기`)}
                      aria-pressed={selected?.id === p.id}
                      onClick={(e) => {
                        lastMapButton.current = e.currentTarget;
                        setSelectedId(p.id);
                        setShowMap(true);
                        if (window.innerWidth < 1100)
                          requestAnimationFrame(() =>
                            mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                          );
                      }}
                    >
                      <span className="place-card-photo">
                        <UI.Placeholder
                          h={148}
                          label={translateUi(localized(p.name, lang))}
                          src={p.imageUrl}
                        />
                      </span>
                      <span className="place-card-body">
                        <span className="eyebrow">
                          {translateUi(localized(p.region, lang))} ·{" "}
                          {translateUi(localized(p.type, lang))}
                        </span>
                        <strong className="place-card-title">
                          {translateUi(localized(p.name, lang))}
                        </strong>
                        {p.hasAccessibilityInfo && (
                          <span className="accessibility-badge">{translateUi("무장애 안내")}</span>
                        )}
                        <span className="place-card-address">
                          {translateUi(p.address || `${localized(p.region, lang)}의 여행 명소`)}
                        </span>
                      </span>
                    </button>
                    <div className="place-card-actions">
                      <Link href={`/spot/${p.id}`} className="text-link">
                        {translateUi("상세 보기 ")}
                        <Icon.chevR />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
              <InfiniteScroll
                id="places-load-more"
                hasMore={hasMore}
                loading={loadingMore}
                error={loadError}
                disabled={!ready || pending || searchWaiting || mapBlocksLoading}
                onLoadMore={loadMore}
                onRetry={loadMore}
                label={translateUi("여행지")}
                resetKey={searchKey}
                progressKey={`${listing.page}:${listing.items.length}`}
              >
                <span>{listProgress(listing.items.length, listing.total, "places", lang)}</span>
                {result.page > 1 && (
                  <Link
                    className="text-link"
                    href={`/discover?tab=places&${placeSearchParams({ ...result.query, page: 1 })}`}
                  >
                    {translateUi("첫 여행지부터 보기")}
                  </Link>
                )}
              </InfiniteScroll>
            </>
          ) : (
            <div className="empty-state">
              <Icon.search />
              <h2>{translateUi("검색 결과가 없어요")}</h2>
              <p>{translateUi("장소 이름을 짧게 입력하거나 지역·종류 필터를 풀어보세요.")}</p>
              <button
                className="btn btn-secondary"
                disabled={!ready}
                onClick={() => {
                  setQuery("");
                  navigate({ q: "", region: "", category: "", accessibility: "" });
                }}
              >
                {translateUi("전체 여행지 보기")}
              </button>
            </div>
          )}
          <p className="section-description">
            {translateUi(
              "관광정보·사진 제공: 한국관광공사 TourAPI. 방문 전 상세 화면에서 운영·예약 안내를 확인하세요.",
            )}
          </p>
        </section>
        <aside
          ref={mapRef}
          className={`places-map${showMap ? " is-open" : ""}`}
          aria-label={translateUi("선택한 여행지 위치")}
        >
          {selected && (
            <>
              <div className="places-map-heading">
                <div>
                  <span className="eyebrow">{translateUi("선택한 여행지")}</span>
                  <h2>{translateUi(localized(selected.name, lang))}</h2>
                </div>
                <button
                  className="btn btn-sm btn-secondary places-map-close"
                  onClick={() => {
                    setShowMap(false);
                    requestAnimationFrame(() => {
                      lastMapButton.current?.focus({ preventScroll: true });
                      lastMapButton.current?.scrollIntoView({ block: "center" });
                    });
                  }}
                >
                  {translateUi("지도 닫기")}
                </button>
              </div>
              {selected.lat !== undefined && selected.lon !== undefined ? (
                <LocationMap
                  lat={selected.lat}
                  lon={selected.lon}
                  name={localized(selected.name, lang)}
                />
              ) : (
                <p>{translateUi("위치 정보를 준비하고 있어요.")}</p>
              )}
              <p>{translateUi(selected.address)}</p>
              <Link className="btn btn-primary" href={`/spot/${selected.id}`}>
                {translateUi("사진·이용 안내 보기 ")}
                <Icon.chevR />
              </Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
