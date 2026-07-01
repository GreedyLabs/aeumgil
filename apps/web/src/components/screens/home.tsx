"use client";

// ─────────────────────────────────────────────
// HomeView — Phase 1b 도메인 데이터 소비형 홈 화면
//
// 데이터는 서버(app/page.tsx)에서 getRepository() 로 페치해 props 로 받는다.
// design/screens-home.tsx(HomeScreen, flat DATA 직접 읽기)를 대체.
// UI 프리미티브(ThemeHueBg/Signal/Placeholder/Icon)는 데이터 비의존이라 그대로 재사용.
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import { Icon as IconMod } from "@/design/icons";
import * as UIMod from "@/design/ui";
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import type { SamplePrompt, Spot, Theme } from "@/domain/types";

// design 의 UI 프리미티브/아이콘은 @ts-nocheck 으로 타입이 없으므로 any 로 취급.
// (이 파일의 도메인 데이터 흐름은 정상적으로 타입 검사된다.)
const UI = UIMod as any;
const Icon = IconMod as any;
const { Placeholder, Signal, ThemeHueBg } = UI;

interface HomeViewProps {
  themes: Theme[];
  prompts: SamplePrompt[];
  bestSpots: Spot[];
}

export function HomeView({ themes, prompts, bestSpots }: HomeViewProps) {
  const { lang, tweaks } = useAppState();
  const { nav } = useAppNav();
  const [prompt, setPrompt] = useState("");

  const submit = (text?: string) => {
    const query = (text ?? prompt).trim();
    if (!query) return;
    nav("matching", { query });
  };

  return (
    <div className="screen-enter" style={{ paddingBottom: 24 }}>
      <HeroBackground
        lang={lang}
        prompt={prompt}
        setPrompt={setPrompt}
        submit={submit}
        prompts={prompts}
      />

      {/* 오늘의 강원도 — 컨디션 요약 (Phase 3에서 실데이터로 대체) */}
      <div style={{ padding: "24px 18px 6px" }}>
        <div className="section-label">{lang === "ko" ? "오늘의 강원도" : "Gangwon today"}</div>
        <div
          className="card"
          style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}
        >
          <ConditionStat
            icon={<Icon.sun />}
            label={lang === "ko" ? "맑음 12°C" : "Clear 12°C"}
            sub={lang === "ko" ? "체감 10°C" : "Feels 10°C"}
          />
          <ConditionStat icon={<Icon.wind />} label={lang === "ko" ? "공기 좋음" : "Air good"} sub="PM 18" />
          <ConditionStat
            icon={<Icon.car />}
            label={lang === "ko" ? "원활" : "Clear"}
            sub={lang === "ko" ? "영동고속 ↑" : "Yeongdong ↑"}
          />
        </div>
      </div>

      {/* 큐레이티드 테마 */}
      <div style={{ padding: "24px 18px 0" }}>
        <div
          style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}
        >
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>
              {lang === "ko" ? "큐레이티드 테마" : "Curated themes"}
            </div>
            <h2 className="section-title">{lang === "ko" ? "강원도 특화 코스" : "Signature Gangwon"}</h2>
          </div>
          <button className="btn-ghost" style={{ fontSize: 12, color: "var(--brand)" }}>
            {lang === "ko" ? "전체" : "All"} <Icon.chevR style={{ verticalAlign: "middle" }} />
          </button>
        </div>
      </div>

      {tweaks.homeLayout === "themes-first" ? (
        <div className="desk-2" style={{ padding: "0 18px", display: "grid", gap: 12 }}>
          {themes.map((th) => (
            <ThemeCardBig
              key={th.id}
              theme={th}
              lang={lang}
              onClick={() => nav("theme", { themeId: th.id })}
            />
          ))}
        </div>
      ) : (
        <div className="hscroll">
          {themes.map((th) => (
            <ThemeCardSmall
              key={th.id}
              theme={th}
              lang={lang}
              onClick={() => nav("theme", { themeId: th.id })}
            />
          ))}
        </div>
      )}

      {/* 지금 가기 좋은 — 덜 붐비는 곳 */}
      <div style={{ padding: "24px 18px 0" }}>
        <div className="section-label">{lang === "ko" ? "지금 가기 좋은" : "Best right now"}</div>
        <h2 className="section-title" style={{ marginBottom: 12 }}>
          {lang === "ko" ? "덜 붐비는 곳부터" : "Quieter spots first"}
        </h2>
        <div className="desk-2" style={{ display: "grid", gap: 10 }}>
          {bestSpots.map((s) => (
            <SpotRow key={s.id} spot={s} lang={lang} onClick={() => nav("spot", { spotId: s.id })} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────
interface HeroProps {
  lang: "ko" | "en";
  prompt: string;
  setPrompt: (v: string) => void;
  submit: (text?: string) => void;
  prompts: SamplePrompt[];
}

const HERO_SLIDES = [
  {
    id: "seorak-gwongeum",
    imageUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80&auto=format",
    ko: "설악산 · 권금성",
    en: "Seoraksan · Gwongeumseong",
  },
  {
    id: "woljeongsa-trail",
    imageUrl: "https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=1200&q=80&auto=format",
    ko: "오대산 · 월정사 선재길",
    en: "Odaesan · Seonjae Trail",
  },
  {
    id: "sacheon-beach",
    imageUrl: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80&auto=format",
    ko: "강릉 · 사천진 해변",
    en: "Gangneung · Sacheonjin Beach",
  },
];

function HeroBackground({ lang, prompt, setPrompt, submit, prompts }: HeroProps) {
  const [active, setActive] = useState(0);
  const userTouchedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (userTouchedRef.current) return;
      setActive((a) => (a + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const go = (i: number) => {
    userTouchedRef.current = true;
    setActive((i + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  const caption = HERO_SLIDES[active] ?? HERO_SLIDES[0]!;

  return (
    <div style={{ position: "relative", height: 440, marginBottom: 4, overflow: "hidden" }}>
      {HERO_SLIDES.map((s, i) => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${s.imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: active === i ? 1 : 0,
            transition: "opacity 1.2s ease",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 20,
          right: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#fff",
        }}
      >
        <div
          style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, opacity: 0.92 }}
        >
          에움길
        </div>
        <div style={{ fontSize: 11, opacity: 0.75, display: "flex", alignItems: "center", gap: 5 }}>
          <Icon.pin /> {lang === "ko" ? caption.ko : caption.en}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 22px",
          color: "#fff",
        }}
      >
        <h1
          className="serif"
          style={{
            fontSize: 38,
            margin: 0,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            textShadow: "0 2px 20px rgba(0,0,0,0.4)",
          }}
        >
          {lang === "ko" ? (
            <>
              오늘은
              <br />
              어떤 강원도가
              <br />
              좋으세요?
            </>
          ) : (
            <>
              How should
              <br />
              Gangwon feel
              <br />
              today?
            </>
          )}
        </h1>

        <div
          style={{
            marginTop: 20,
            background: "rgba(255,255,255,0.98)",
            borderRadius: 100,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
          }}
        >
          <Icon.sparkle style={{ color: "var(--brand)", flexShrink: 0 }} />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={lang === "ko" ? "예) 조용한 여행" : "e.g., A quiet trip"}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              color: "var(--ink)",
              minWidth: 0,
            }}
          />
          <button
            onClick={() => submit()}
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: "50%",
              background: "var(--brand)",
              color: "#fff",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon.search style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
          {prompts.slice(0, 3).map((p, i) => {
            const text = localized(p.text, lang);
            return (
              <button
                key={i}
                onClick={() => submit(text)}
                style={{
                  fontSize: 12,
                  padding: "6px 12px",
                  borderRadius: 100,
                  background: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.35)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {text.length > 22 ? text.slice(0, 20) + "…" : text}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 16, right: 20, display: "flex", gap: 6, alignItems: "center" }}>
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            style={{
              width: active === i ? 24 : 14,
              height: 3,
              borderRadius: 100,
              background: active === i ? "#fff" : "rgba(255,255,255,0.45)",
              border: "none",
              padding: 0,
              transition: "width .3s, background .3s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ConditionStat({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)" }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ── 테마 카드 ──────────────────────────────
type Lang = "ko" | "en";

function calmOrModerate(themeId: string, includeEastSea: boolean): "calm" | "moderate" {
  if (themeId === "mountain-trek") return "moderate";
  if (includeEastSea && themeId === "east-sea-sunrise") return "moderate";
  return "calm";
}

function ThemeCardBig({ theme, lang, onClick }: { theme: Theme; lang: Lang; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card" style={{ textAlign: "left", padding: 0, display: "block" }}>
      <ThemeHueBg hue={theme.hue} h={170} themeId={theme.id}>
        <div style={{ position: "absolute", top: 12, left: 14, right: 14, display: "flex", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.9)",
              fontWeight: 600,
              background: "rgba(0,0,0,0.25)",
              padding: "4px 8px",
              borderRadius: 100,
            }}
          >
            {localized(theme.tag, lang)}
          </span>
          <Signal level={calmOrModerate(theme.id, false)} lang={lang} />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "14px 16px",
            background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)",
            color: "#fff",
          }}
        >
          <div className="serif" style={{ fontSize: 24, lineHeight: 1.15 }}>
            {localized(theme.title, lang)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{localized(theme.subtitle, lang)}</div>
        </div>
      </ThemeHueBg>
      <div style={{ padding: "12px 16px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 12 }}>
          <span>
            <Icon.clock style={{ verticalAlign: "-3px", marginRight: 4 }} />
            {localized(theme.duration, lang)}
          </span>
          <span>
            <Icon.pin style={{ verticalAlign: "-3px", marginRight: 4 }} />
            {localized(theme.region, lang)}
          </span>
          <span>
            <Icon.route style={{ verticalAlign: "-3px", marginRight: 4 }} />
            {theme.spotCount}
          </span>
        </div>
        <Icon.chevR style={{ color: "var(--ink-3)" }} />
      </div>
    </button>
  );
}

function ThemeCardSmall({ theme, lang, onClick }: { theme: Theme; lang: Lang; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 220, textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
      <ThemeHueBg hue={theme.hue} h={140} themeId={theme.id}>
        <div style={{ position: "absolute", bottom: 10, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "end" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>
            {localized(theme.tag, lang)}
          </div>
          <Signal level={calmOrModerate(theme.id, true)} lang={lang} />
        </div>
      </ThemeHueBg>
      <div>
        <div className="serif" style={{ fontSize: 20, lineHeight: 1.2 }}>
          {localized(theme.title, lang)}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
          {localized(theme.duration, lang)} · {theme.spotCount} {lang === "ko" ? "장소" : "spots"}
        </div>
      </div>
    </button>
  );
}

// ── 스팟 행 ────────────────────────────────
export function SpotRow({ spot, lang, onClick }: { spot: Spot; lang: Lang; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card" style={{ padding: 10, display: "flex", gap: 12, alignItems: "stretch", textAlign: "left" }}>
      <Placeholder label={localized(spot.name, lang)} src={spot.imageUrl} h={70} style={{ width: 80, borderRadius: 12, flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {localized(spot.name, lang)}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
            {localized(spot.type, lang)} · {localized(spot.region, lang)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Signal level={spot.congestion} lang={lang} />
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
            <Icon.star style={{ color: "var(--accent)", verticalAlign: "-2px" }} /> {spot.rating}
          </span>
        </div>
      </div>
    </button>
  );
}
