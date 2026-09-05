"use client";

import Link from "next/link";
import { ThemeCard } from "./theme-card";
import { useState, type FormEvent, type ReactNode } from "react";
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { INTENT_QUERY_MAX_LENGTH } from "@/domain/matching";
import type { SamplePrompt, Spot, Theme } from "@/domain/types";
import { UI, Icon } from "./_ui";

const { Placeholder, Signal } = UI;
type Lang = "ko" | "en";

export function HomeView({
  themes,
  prompts,
  bestSpots,
  conditions,
}: {
  themes: Theme[];
  prompts: SamplePrompt[];
  bestSpots: Spot[];
  conditions?: ReactNode;
}) {
  const { lang } = useAppState();
  const { nav } = useAppNav();
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
        <Link href="/map" className="text-link">
          <Icon.map /> 지도로 둘러보기
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
            <input
              aria-label="여행 목적"
              value={prompt}
              maxLength={INTENT_QUERY_MAX_LENGTH}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="예) 부모님과 한적한 바다 여행"
              enterKeyHint="search"
            />
            <button
              type="submit"
              className="icon-btn"
              aria-label="여행 추천 받기"
              disabled={!prompt.trim()}
            >
              <Icon.search />
            </button>
          </form>
          <div className="prompt-chips">
            {prompts.slice(0, 3).map((p) => (
              <button key={p.text.ko} onClick={() => submit(localized(p.text, lang))}>
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
      {conditions}
      <section className="page-section">
        <div className="section-heading">
          <div>
            <div className="section-label">취향 따라 떠나는</div>
            <h2 className="section-title">강원도 테마 여행</h2>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => nav("discover")}>
            전체 보기 <Icon.chevR />
          </button>
        </div>
        <div className="theme-grid">
          {themes.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} lang={lang} />
          ))}
        </div>
        {themes.length === 0 && (
          <p className="empty-message">추천 테마를 준비하고 있어요. 잠시 후 다시 방문해 주세요.</p>
        )}
      </section>
      <section className="page-section">
        <div className="section-label">예상 혼잡도를 살펴보고</div>
        <h2 className="section-title">여유로운 곳부터</h2>
        <p className="section-description">
          시간대·요일·계절에 따른 추정이에요. 실제 현장 상황은 다를 수 있어요.
        </p>
        <div className="spot-grid">
          {bestSpots.map((spot) => (
            <SpotRow
              key={spot.id}
              spot={spot}
              lang={lang}
              onClick={() => nav("spot", { spotId: spot.id })}
            />
          ))}
        </div>
      </section>
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
