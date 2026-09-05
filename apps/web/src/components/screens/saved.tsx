"use client";

// SavedView — Phase 1b. 저장된 테마·추천 장소. (저장 목록은 Phase 4 에서 DB 연동)
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { SpotRow } from "./home";
import { UI, Icon } from "./_ui";
import type { Congestion, Course, Spot, Theme } from "@/domain/types";

const { TopBar, Signal, ThemeHueBg } = UI;

interface SavedTheme {
  theme: Theme;
  course: Course | null;
  /** 저장 일자 (ISO "YYYY-MM-DD") */
  savedAt: string;
  /** 대표 스팟의 현재 혼잡 (코스 미생성 시 null → Signal 미표시) */
  congestion: Congestion | null;
}

interface Props {
  saved: SavedTheme[];
  recentSpots: Spot[];
}

export function SavedView({ saved, recentSpots }: Props) {
  const { lang } = useAppState();
  const { nav } = useAppNav();

  return (
    <div className="screen-enter saved-page">
      <TopBar
        title={lang === "ko" ? "내 여행" : "My trips"}
        right={
          <button className="icon-btn" aria-label="새 여행 찾기" onClick={() => nav("discover")}>
            <Icon.plus />
          </button>
        }
      />
      <div style={{ padding: "4px 20px 12px" }}>
        <div className="section-label">{lang === "ko" ? "저장된 테마" : "Saved themes"}</div>
        <h1 className="section-title">저장한 여행 <span style={{color:"var(--brand)"}}>{saved.length}</span></h1>
      </div>

      <div className="desk-2" style={{ padding: "0 20px", display: "grid", gap: 14 }}>
        {saved.map(({ theme: th, course: cs, savedAt, congestion }) => (
          <button key={th.id} onClick={() => nav("theme", { themeId: th.id })} className="card" style={{ padding: 0, textAlign: "left" }}>
            <ThemeHueBg hue={th.hue} h={130} themeId={th.id} src={th.imageUrl} label={th.imageLabel && localized(th.imageLabel, lang)}>
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <Icon.bookmarkFill style={{ color: "#fff" }} />
              </div>
              <div style={{ position: "absolute", bottom: 12, left: 14, color: "#fff" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85 }}>{localized(th.tag, lang)}</div>
                <div className="serif" style={{ fontSize: 20, marginTop: 2 }}>
                  {localized(th.title, lang)}
                </div>
              </div>
            </ThemeHueBg>
            <div style={{ padding: "12px 16px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {cs ? <>{localized(cs.title, lang)} · </> : null}
                <span style={{ fontFamily: "SF Mono, monospace" }}>{savedAt.replaceAll("-", ".")}</span>
              </div>
              {congestion ? <Signal level={congestion} lang={lang} /> : null}
            </div>
          </button>
        ))}

        <div style={{ padding: 24, textAlign: "center", background: "var(--bg-elev)", border: "1px dashed var(--line-2)", borderRadius: "var(--r-lg)" }}>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 10 }}>
            {lang === "ko" ? "더 많은 테마를 탐색해보세요" : "Discover more themes"}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => nav("home")}>
            <Icon.sparkle /> {lang === "ko" ? "추천 받기" : "Get matched"}
          </button>
        </div>
      </div>

      <div style={{ padding: "26px 20px 12px" }}>
        <div className="section-label">{lang === "ko" ? "추천 장소" : "Recently viewed"}</div>
      </div>
      <div className="desk-2" style={{ padding: "0 20px 24px", display: "grid", gap: 8 }}>
        {recentSpots.map((s) => (
          <SpotRow key={s.id} spot={s} lang={lang} onClick={() => nav("spot", { spotId: s.id })} />
        ))}
      </div>
    </div>
  );
}
