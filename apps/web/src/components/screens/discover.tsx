"use client";
import { Select } from "@/components/select";
import { InfiniteScroll } from "@/components/infinite-scroll";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useHydrated } from "@/lib/use-hydrated";
import { useRouter } from "next/navigation";
import { localized } from "@/lib/i18n";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import { ThemeCard } from "./theme-card";
import { COURSE_DAY_CHOICES, inferCourseOptions } from "@/domain/course-options";
import type { Theme } from "@/domain/types";

export function DiscoverView({
  themes,
  festivals,
  visitors,
  places,
  activeTab = "themes",
}: {
  themes: Theme[];
  festivals?: ReactNode;
  visitors?: ReactNode;
  places?: ReactNode;
  activeTab?: string;
}) {
  const ready = useHydrated();
  const { lang } = useAppState();
  const router = useRouter();
  const mode = activeTab;
  const setMode = (tab: string) => router.push(`/discover?tab=${tab}`, { scroll: false });
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(18);
  const [region, setRegion] = useState("");
  const [days, setDays] = useState("");
  const regions = [...new Set(themes.flatMap((theme) => theme.region.ko.split(" · ")))].sort(
    (a, b) => a.localeCompare(b, "ko"),
  );
  const filtered = themes.filter((theme) => {
    const text = [theme.title, theme.subtitle, theme.region, theme.tag, ...theme.mood]
      .map((t) => localized(t, lang))
      .join(" ")
      .toLowerCase();
    return (
      query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .every((term) => text.replace(/\s+/g, "").includes(term)) &&
      (!region || theme.region.ko.split(" · ").includes(region)) &&
      (!days || inferCourseOptions(theme.duration.ko).days === Number(days))
    );
  });

  return (
    <div className="screen-enter discover-page">
      <UI.TopBar
        title="탐색"
        right={
          <Link className="icon-btn" aria-label="여행지 찾기" href="/discover?tab=places">
            <Icon.map />
          </Link>
        }
      />
      <header className="page-heading">
        <div>
          <span className="eyebrow">취향 따라 떠나는 강원</span>
          <h1>
            {{
              places: "가고 싶은 곳을 찾아보세요",
              themes: "마음에 드는 코스부터",
              festivals: "여행에 특별한 하루를 더해요",
              visitors: "지역별 여행 흐름",
            }[mode] ?? "강원 여행 탐색"}
          </h1>
          <p>
            {
              {
                places: "장소와 위치를 비교하고 내 여행에 담아보세요.",
                themes: "도착부터 귀가까지, 여행 기간에 맞는 코스를 골라보세요.",
                festivals: "행사 일정과 주변 여행지를 함께 살펴보세요.",
                visitors: "지난 방문 추이로 여행 지역을 비교해보세요.",
              }[mode]
            }
          </p>
        </div>
        <Link href="/" className="btn btn-secondary discover-match-link">
          <Icon.sparkle /> 나에게 맞는 여행 찾기
        </Link>
      </header>
      <div className="browse-tabs" aria-label="탐색 종류">
        <button
          disabled={!ready}
          aria-pressed={mode === "places"}
          onClick={() => setMode("places")}
        >
          여행지 찾기
        </button>
        <button
          disabled={!ready}
          aria-pressed={mode === "themes"}
          onClick={() => setMode("themes")}
        >
          테마 코스
        </button>
        <button
          disabled={!ready}
          aria-pressed={mode === "festivals"}
          onClick={() => setMode("festivals")}
        >
          다가오는 행사
        </button>
        <button
          disabled={!ready}
          aria-pressed={mode === "visitors"}
          onClick={() => setMode("visitors")}
        >
          지역 방문 통계
        </button>
      </div>
      {mode === "places" ? (
        places
      ) : mode === "visitors" ? (
        visitors
      ) : mode === "festivals" ? (
        festivals
      ) : (
        <>
          <section className="explore-toolbar" aria-label="테마 검색과 지역·기간 필터">
            <div className="search-field">
              <Icon.search />
              <input
                aria-label="테마 검색"
                disabled={!ready}
                type="search"
                placeholder="바다, 숲, 시장…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(18);
                }}
              />
            </div>
            <label className="places-region">
              <span>지역</span>
              <Select
                aria-label="테마 지역"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setVisible(18);
                }}
              >
                <option value="">강원 전체</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </label>
            <label className="places-region">
              <span>기간</span>
              <Select
                aria-label="테마 여행 기간"
                value={days}
                onChange={(event) => {
                  setDays(event.target.value);
                  setVisible(18);
                }}
              >
                <option value="">전체 기간</option>
                {COURSE_DAY_CHOICES.map((day) => (
                  <option key={day} value={day}>
                    {day === 1 ? "당일" : `${day - 1}박 ${day}일`}
                  </option>
                ))}
              </Select>
            </label>
          </section>
          <div className="results-heading">
            <h2>
              강원도 특화 테마 <span>{filtered.length}</span>
            </h2>
            <span>준비된 코스에 여행 조건을 더해보세요</span>
          </div>
          {filtered.length > visible && (
            <p className="section-description">
              아래로 내려가면 다음 코스가 이어져요. 지역이나 기간으로 좁혀보세요.
            </p>
          )}
          {filtered.length ? (
            <div className="theme-grid" id="theme-results">
              {filtered.slice(0, visible).map((theme) => (
                <ThemeCard key={theme.id} theme={theme} lang={lang} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Icon.search />
              <h2>찾는 테마가 아직 없어요</h2>
              <p>다른 검색어나 지역으로 살펴보세요.</p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setQuery("");
                  setRegion("");
                  setDays("");
                }}
              >
                검색 초기화
              </button>
            </div>
          )}
          {filtered.length > 0 && (
            <InfiniteScroll
              id="theme-scroll-boundary"
              label="테마 코스"
              hasMore={filtered.length > visible}
              disabled={!ready}
              resetKey={JSON.stringify([query, region, days, lang])}
              progressKey={visible}
              onLoadMore={() => setVisible((v) => Math.min(v + 18, filtered.length))}
            >
              {filtered.length}개 중 {Math.min(visible, filtered.length)}개 코스를 보고 있어요
            </InfiniteScroll>
          )}
        </>
      )}
    </div>
  );
}
