"use client";

// DiscoverView — Phase 1b. 전체 테마 그리드.
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { Theme } from "@/domain/types";

const { TopBar, Signal, ThemeHueBg } = UI;

export function DiscoverView({ themes }: { themes: Theme[] }) {
  const { lang } = useAppState();
  const { nav } = useAppNav();

  return (
    <div className="screen-enter">
      <TopBar
        title={lang === "ko" ? "탐색" : "Discover"}
        right={
          <button className="icon-btn">
            <Icon.filter />
          </button>
        }
      />
      <div style={{ padding: "4px 20px 14px" }}>
        <h1 className="serif" style={{ fontSize: 28, margin: 0, lineHeight: 1.15 }}>
          {lang === "ko" ? "강원도 특화 테마" : "Gangwon themes"}
        </h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6 }}>
          {lang === "ko" ? `${themes.length}개 코스 · 혼잡도 실시간` : `${themes.length} curated courses`}
        </div>
      </div>
      <div className="desk-2" style={{ padding: "0 20px 24px", display: "grid", gap: 12 }}>
        {themes.map((th) => (
          <button
            key={th.id}
            onClick={() => nav("theme", { themeId: th.id })}
            className="card"
            style={{ padding: 0, textAlign: "left", display: "flex", overflow: "hidden" }}
          >
            <div style={{ width: 120, flexShrink: 0, position: "relative" }}>
              <ThemeHueBg hue={th.hue} h={106} themeId={th.id}>
                <div
                  style={{ position: "absolute", bottom: 8, left: 10, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", fontWeight: 700, background: "rgba(0,0,0,0.3)", padding: "3px 7px", borderRadius: 100 }}
                >
                  {localized(th.tag, lang)}
                </div>
              </ThemeHueBg>
            </div>
            <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 18, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {localized(th.title, lang)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {localized(th.subtitle, lang)}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", fontSize: 10.5, color: "var(--ink-3)", flexWrap: "wrap" }}>
                <Signal level={th.id === "mountain-trek" ? "moderate" : "calm"} lang={lang} />
                <span style={{ whiteSpace: "nowrap" }}>· {localized(th.duration, lang)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
