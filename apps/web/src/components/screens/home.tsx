"use client";
import { Select } from "@/components/select";
import { ThemeQueryInput } from "@/components/theme-query-input";

import Link from "next/link";
import { useHydrated } from "@/lib/use-hydrated";
import { GANGWON_REGIONS } from "@/domain/place-search";
import { ThemeCard } from "./theme-card";
import { useState, type FormEvent, type ReactNode } from "react";
import { localized, type Lang } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { INTENT_QUERY_MAX_LENGTH } from "@/domain/matching";
import type { SamplePrompt, Spot, Theme } from "@/domain/types";
import { UI, Icon } from "./_ui";

const { Placeholder, Signal } = UI;

export function HomeView({
  themes,
  prompts,
  bestSpots,
  traffic,
}: {
  themes: Theme[];
  prompts: SamplePrompt[];
  bestSpots: Spot[];
  traffic: ReactNode;
}) {
  const ready = useHydrated();
  const { lang } = useAppState();
  const { nav } = useAppNav();
  const [region, setRegion] = useState("");
  const [prompt, setPrompt] = useState("");
  const submit = (text: string) => {
    const query = text.trim();
    if (query) nav("matching", { query });
  };
  const hero = bestSpots.find((s) => s.imageUrl);
  return (
    <div className="screen-enter home-page">
      <header className="home-heading">
        <Link href="/" className="mobile-brand">
          에움길
        </Link>
        <span>강원에서 찾는 나만의 여유</span>
        <Link href="/discover?tab=places" className="text-link">
          <Icon.search /> 여행지 찾기
        </Link>
      </header>
      <section className="home-hero">
        {hero && (
          <div className="home-hero-image">
            <Placeholder priority src={hero.imageUrl} label={localized(hero.name, lang)} h="100%" />
          </div>
        )}
        <div className="home-hero-shade" />
        <div className="home-hero-content">
          <div className="hero-eyebrow">조금 돌아가도, 더 좋은 여행</div>
          <h1 className="serif">
            오늘은 어떤
            <br />
            강원도가 좋으세요?
          </h1>
          <p>
            여행의 기분을 알려주세요.
            <br className="mobile-only" /> 어울리는 테마와 동선을 찾아드려요.
          </p>
          <form
            className="intent-search"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submit(prompt);
            }}
          >
            <Icon.sparkle />
            <ThemeQueryInput
              aria-label="여행 목적"
              disabled={!ready}
              value={prompt}
              maxLength={INTENT_QUERY_MAX_LENGTH}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="예) 속초에서 부모님과 바다 보고 시장 구경"
            />
            <button
              type="submit"
              className="btn btn-primary"
              aria-label="여행 추천 받기"
              disabled={!ready || !prompt.trim()}
            >
              테마 찾기 <Icon.chevR />
            </button>
          </form>
          <div className="prompt-chips">
            {prompts.slice(0, 3).map((p) => (
              <button
                disabled={!ready}
                key={p.text.ko}
                onClick={() => submit(localized(p.text, lang))}
              >
                {localized(p.text, lang)}
              </button>
            ))}
          </div>
        </div>
        {hero && (
          <div className="hero-caption">
            {localized(hero.name, lang)}
            {hero.imageUrl?.includes("visitkorea.or.kr") ? " · 사진 제공: 한국관광공사" : ""}
          </div>
        )}
      </section>
      <section className="page-section">
        <div className="section-heading">
          <div>
            <div className="section-label">어디부터 시작할지 고민된다면</div>
            <h2 className="section-title">먼저 만나볼 세 가지 여행</h2>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => nav("discover")}>
            전체 보기 <Icon.chevR />
          </button>
        </div>
        <div className="theme-grid">
          {themes.slice(0, 3).map((theme) => (
            <ThemeCard key={theme.id} theme={theme} lang={lang} />
          ))}
        </div>
        {themes.length === 0 && (
          <p className="empty-message">추천 테마를 준비하고 있어요. 잠시 후 다시 방문해 주세요.</p>
        )}
      </section>
      <section className="page-section home-region-entry">
        <div>
          <h2 className="section-title">가고 싶은 지역이 있나요?</h2>
          <p className="section-description">지역을 고르면 명소와 위치를 함께 살펴볼 수 있어요.</p>
        </div>
        <div className="home-region-controls">
          <Select
            className="input"
            aria-label="가보고 싶은 지역"
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
          <Link
            className="btn btn-secondary"
            href={`/discover?tab=places${region ? `&region=${encodeURIComponent(region)}` : ""}`}
          >
            여행지 탐색 <Icon.chevR />
          </Link>
        </div>
      </section>
      {traffic}
      <footer className="page-section home-footer">
        <span>에움길 · 강원특별자치도 테마 여행</span>
        <div>
          <Link href="/doc?type=sources">데이터 출처</Link>
          <Link href="/doc?type=privacy">개인정보처리방침</Link>
        </div>
      </footer>
    </div>
  );
}

export function SpotRow({ spot, lang, onClick }: { spot: Spot; lang: Lang; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card spot-row">
      <Placeholder
        label={localized(spot.name, lang)}
        src={spot.imageUrl}
        h={80}
        style={{ width: 90, borderRadius: 12, flexShrink: 0 }}
      />
      <div className="spot-row-body">
        <strong>{localized(spot.name, lang)}</strong>
        <span>
          {localized(spot.type, lang)} · {localized(spot.region, lang)}
        </span>
        <Signal level={spot.congestion} lang={lang} />
      </div>
      <Icon.chevR />
    </button>
  );
}
