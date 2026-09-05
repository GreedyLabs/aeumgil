"use client";
import { Select } from "@/components/select";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
  const { lang } = useAppState();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const draftFilters = useRef(result.query);
  const [displayFilters, setDisplayFilters] = useState(result.query);
  useEffect(() => setDisplayFilters(result.query), [result.query]);
  const lastMapButton = useRef<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState(result.query.q);
  const [selectedId, setSelectedId] = useState<string>();
  const [showMap, setShowMap] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const composing = useRef(false);
  const previousQuery = useRef(result.query.q);
  const mapRef = useRef<HTMLElement>(null);
  const searchKey = placeSearchParams(result.query).toString();
  // 뒤로 가기로 검색 조건이 돌아와도 입력값과 결과를 일치시킨다.
  useEffect(() => {
    const previous = previousQuery.current;
    setQuery((current) => (current === previous ? result.query.q : current));
    previousQuery.current = result.query.q;
    setSelectedId(undefined);
    setShowMap(false);
  }, [searchKey, result.query.q]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!pending) draftFilters.current = result.query;
  }, [pending, result.query]);
  const navigate = (changes: PlaceSearchQuery) => {
    clearTimeout(timer.current);
    draftFilters.current = { ...draftFilters.current, q: query, page: 1, ...changes };
    setDisplayFilters(draftFilters.current);
    const params = placeSearchParams(draftFilters.current);
    startTransition(() =>
      router.replace(`/discover?tab=places${params.size ? `&${params}` : ""}`, { scroll: false }),
    );
  };
  const search = (value: string) => {
    setQuery(value);
    clearTimeout(timer.current);
    if (composing.current) return;
    timer.current = setTimeout(() => navigate({ q: value }), 350);
  };
  const selected = result.items.find((p) => p.id === selectedId) ?? result.items[0];
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return (
    <div className="screen-enter places-page">
      {!embedded && (
        <UI.TopBar
          title="여행지 찾기"
          right={
            <Link href="/discover" className="text-link">
              테마 코스 <Icon.chevR />
            </Link>
          }
        />
      )}
      {!embedded && (
        <header className="page-heading">
          <div>
            <span className="eyebrow">강원 18개 시군의 여행지</span>
            <h1>어디로 떠나볼까요?</h1>
            <p>이름·지역·주소로 찾고, 마음에 드는 장소의 위치를 확인하세요.</p>
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
            aria-label="관광지 검색"
            placeholder="속초 해변, 박수근미술관, 정동진…"
            value={query}
            maxLength={100}
            onChange={(e) => search(e.target.value)}
            onCompositionStart={() => {
              composing.current = true;
              clearTimeout(timer.current);
            }}
            onCompositionEnd={(e) => {
              composing.current = false;
              search(e.currentTarget.value);
            }}
          />
          <button className="btn btn-primary btn-sm" type="submit">
            검색
          </button>
        </div>
        <label className="places-region">
          <span>지역</span>
          <Select
            aria-label="여행지 지역"
            value={displayFilters.region}
            onChange={(e) => navigate({ region: e.target.value })}
          >
            <option value="">강원 전체</option>
            {GANGWON_REGIONS.map((r) => (
              <option key={r.key} value={r.ko}>
                {r.ko}
              </option>
            ))}
          </Select>
        </label>
      </form>
      <div className="places-categories" aria-label="여행지 종류">
        {[{ id: "", label: "전체" }, ...PLACE_CATEGORIES].map((c) => (
          <button
            key={c.id}
            className={`chip${displayFilters.category === c.id ? " active" : ""}`}
            aria-pressed={displayFilters.category === c.id}
            onClick={() => navigate({ category: c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>
      <label className="accessibility-filter">
        <input
          type="checkbox"
          checked={displayFilters.accessibility === "info"}
          onChange={(e) => navigate({ accessibility: e.target.checked ? "info" : "" })}
        />{" "}
        무장애 안내 있는 곳
      </label>
      <div className="results-heading">
        <h2 aria-live="polite">
          {pending ? (
            "여행지를 찾고 있어요…"
          ) : (
            <>
              여행지 <span>{result.total.toLocaleString()}곳</span>
            </>
          )}
        </h2>
        {(result.query.q ||
          result.query.region ||
          result.query.category ||
          result.query.accessibility) && (
          <button
            className="text-link"
            onClick={() => {
              setQuery("");
              navigate({ q: "", region: "", category: "", accessibility: "" });
            }}
          >
            검색 초기화
          </button>
        )}
      </div>
      <div className="places-layout" aria-busy={pending}>
        <section className="places-results" aria-label="관광지 검색 결과">
          {result.items.length ? (
            <>
              <div className="places-grid">
                {result.items.map((p) => (
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
                      aria-label={`${localized(p.name, lang)} 지도 보기`}
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
                        <UI.Placeholder h={148} label={localized(p.name, lang)} src={p.imageUrl} />
                      </span>
                      <span className="place-card-body">
                        <span className="eyebrow">
                          {localized(p.region, lang)} · {localized(p.type, lang)}
                        </span>
                        <strong className="place-card-title">{localized(p.name, lang)}</strong>
                        {p.hasAccessibilityInfo && (
                          <span className="accessibility-badge">무장애 안내</span>
                        )}
                        <span className="place-card-address">
                          {p.address || `${localized(p.region, lang)}의 여행 명소`}
                        </span>
                      </span>
                    </button>
                    <div className="place-card-actions">
                      <Link href={`/spot/${p.id}`} className="text-link">
                        상세 보기 <Icon.chevR />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
              <nav className="places-pagination" aria-label="여행지 페이지">
                <button
                  className="btn btn-secondary"
                  disabled={result.page <= 1 || pending}
                  onClick={() => navigate({ page: result.page - 1 })}
                >
                  이전
                </button>
                <span>
                  {result.page} / {pages} 페이지
                </span>
                <button
                  className="btn btn-secondary"
                  disabled={result.page >= pages || pending}
                  onClick={() => navigate({ page: result.page + 1 })}
                >
                  다음
                </button>
              </nav>
            </>
          ) : (
            <div className="empty-state">
              <Icon.search />
              <h2>검색 결과가 없어요</h2>
              <p>장소 이름을 짧게 입력하거나 지역·종류 필터를 풀어보세요.</p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setQuery("");
                  navigate({ q: "", region: "", category: "", accessibility: "" });
                }}
              >
                전체 여행지 보기
              </button>
            </div>
          )}
          <p className="section-description">
            관광정보·사진 제공: 한국관광공사 TourAPI. 방문 전 상세 화면에서 운영·예약 안내를
            확인하세요.
          </p>
        </section>
        <aside
          ref={mapRef}
          className={`places-map${showMap ? " is-open" : ""}`}
          aria-label="선택한 여행지 위치"
        >
          {selected && (
            <>
              <div className="places-map-heading">
                <div>
                  <span className="eyebrow">선택한 여행지</span>
                  <h2>{localized(selected.name, lang)}</h2>
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
                  지도 닫기
                </button>
              </div>
              {selected.lat !== undefined && selected.lon !== undefined ? (
                <LocationMap
                  lat={selected.lat}
                  lon={selected.lon}
                  name={localized(selected.name, lang)}
                />
              ) : (
                <p>위치 정보를 준비하고 있어요.</p>
              )}
              <p>{selected.address}</p>
              <Link className="btn btn-primary" href={`/spot/${selected.id}`}>
                사진·이용 안내 보기 <Icon.chevR />
              </Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
