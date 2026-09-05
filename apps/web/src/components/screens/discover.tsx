"use client";
import { Select } from "@/components/select";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { localized } from "@/lib/i18n";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import { ThemeCard } from "./theme-card";
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
  const { lang } = useAppState();
  const router = useRouter();
  const mode = activeTab;
  const setMode = (tab: string) => router.push(`/discover?tab=${tab}`, { scroll: false });
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(18);
  const [region, setRegion] = useState("");
  const regions = [...new Set(themes.flatMap((theme) => theme.region.ko.split(" · ")))];
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
      (!region || theme.region.ko.split(" · ").includes(region))
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
          <h1>어떤 여행을 찾고 있나요?</h1>
          <p>코스부터 고르거나, 가고 싶은 장소부터 찾아보세요. 동선은 코스에서 함께 확인해요.</p>
        </div>
        <Link href="/" className="btn btn-secondary">
          <Icon.sparkle /> 나에게 맞는 여행 찾기
        </Link>
      </header>
      <div className="browse-tabs" aria-label="탐색 종류">
        <button aria-pressed={mode === "places"} onClick={() => setMode("places")}>
          여행지 찾기
        </button>
        <button aria-pressed={mode === "themes"} onClick={() => setMode("themes")}>
          테마 코스
        </button>
        <button aria-pressed={mode === "festivals"} onClick={() => setMode("festivals")}>
          다가오는 행사
        </button>
        <button aria-pressed={mode === "visitors"} onClick={() => setMode("visitors")}>
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
          <section className="explore-toolbar" aria-label="테마 검색과 지역 필터">
            <div className="search-field">
              <Icon.search />
              <input
                aria-label="테마 검색"
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
          </section>
          <div className="results-heading">
            <h2>
              강원도 특화 테마 <span>{filtered.length}</span>
            </h2>
            <span>준비된 코스에 여행 조건을 더해보세요</span>
          </div>
          {filtered.length > visible && (
            <p className="section-description">
              먼저 {visible}개 코스를 보여드려요. 지역이나 검색어로 좁혀보세요.
            </p>
          )}
          {filtered.length ? (
            <div className="theme-grid">
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
                }}
              >
                검색 초기화
              </button>
            </div>
          )}
          {filtered.length > visible && (
            <button className="btn btn-secondary" onClick={() => setVisible((v) => v + 18)}>
              코스 더 보기 ({visible} / {filtered.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}
