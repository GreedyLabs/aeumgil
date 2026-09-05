"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { localized } from "@/lib/i18n";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import { ThemeCard } from "./theme-card";
import type { Theme } from "@/domain/types";

export function DiscoverView({
  themes,
  festivals,
  visitors,
}: {
  themes: Theme[];
  festivals?: ReactNode;
  visitors?: ReactNode;
}) {
  const { lang } = useAppState();
  const [mode, setMode] = useState<"themes" | "festivals" | "visitors">("themes");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const regions = [...new Set(themes.flatMap((theme) => theme.region.ko.split(" · ")))];
  const filtered = themes.filter((theme) => {
    const text = [theme.title, theme.subtitle, theme.region, theme.tag, ...theme.mood]
      .map((t) => localized(t, lang))
      .join(" ")
      .toLowerCase();
    return (
      text.includes(query.trim().toLowerCase()) &&
      (!region || theme.region.ko.split(" · ").includes(region))
    );
  });

  return (
    <div className="screen-enter discover-page">
      <UI.TopBar
        title="탐색"
        right={
          <Link className="icon-btn" aria-label="혼잡도 지도 보기" href="/map">
            <Icon.map />
          </Link>
        }
      />
      <header className="page-heading">
        <div>
          <span className="eyebrow">취향 따라 떠나는 강원</span>
          <h1>어떤 여행을 찾고 있나요?</h1>
          <p>바다부터 숲, 골목의 맛까지. 마음이 가는 테마로 시작하세요.</p>
        </div>
        <Link href="/" className="btn btn-secondary">
          <Icon.sparkle /> 나에게 맞는 여행 찾기
        </Link>
      </header>
      <div className="browse-tabs" aria-label="탐색 종류">
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
      {mode === "visitors" ? (
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
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="filter-list" aria-label="여행 지역">
              {["", ...regions].map((r) => (
                <button
                  key={r}
                  className={`chip${region === r ? " active" : ""}`}
                  aria-pressed={region === r}
                  onClick={() => setRegion(r)}
                >
                  {r || "강원 전체"}
                </button>
              ))}
            </div>
          </section>
          <div className="results-heading">
            <h2>
              강원도 특화 테마 <span>{filtered.length}</span>
            </h2>
            <span>준비된 코스에 여행 조건을 더해보세요</span>
          </div>
          {filtered.length ? (
            <div className="theme-grid">
              {filtered.map((theme) => (
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
        </>
      )}
    </div>
  );
}
