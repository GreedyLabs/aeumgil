"use client";

// ThemeResultView — Phase 1b. 매칭된 테마 소개. 데이터는 서버에서 주입.
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { Theme } from "@/domain/types";

const { TopBar, Signal, Chip, ThemeHueBg } = UI;

interface Props {
  theme: Theme;
  alts: Theme[];
  query: string;
}

export function ThemeResultView({ theme, alts, query }: Props) {
  const { lang } = useAppState();
  const { nav, back } = useAppNav();

  return (
    <div className="screen-enter">
      <TopBar
        title={lang === "ko" ? "매칭 결과" : "Match"}
        onBack={back}
        right={
          <button className="icon-btn">
            <Icon.share />
          </button>
        }
      />

      <div style={{ padding: "8px 20px 16px" }}>
        <div style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, marginBottom: 6 }}>
          {lang === "ko" ? "✦ 가장 잘 맞는 테마" : "✦ Best match"}
        </div>
        {query && (
          <div style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "italic", marginBottom: 10 }}>
            {`"${query}"`}
          </div>
        )}
        <h1 className="serif" style={{ fontSize: 34, margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {localized(theme.title, lang)}
        </h1>
        <div style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 10, maxWidth: 360 }}>
          {localized(theme.blurb, lang)}
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>
        <ThemeHueBg hue={theme.hue} h={200} themeId={theme.id}>
          <div
            style={{ position: "absolute", inset: 0, padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span
                style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 100, fontWeight: 600 }}
              >
                {localized(theme.tag, lang)}
              </span>
              <Signal level="calm" lang={lang} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, fontSize: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ opacity: 0.7 }}>{lang === "ko" ? "기간" : "Duration"}</div>
                <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap" }}>{localized(theme.duration, lang)}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ opacity: 0.7 }}>{lang === "ko" ? "장소" : "Spots"}</div>
                <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap" }}>{theme.spotCount}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ opacity: 0.7 }}>{lang === "ko" ? "페이스" : "Pace"}</div>
                <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {localized(theme.pace, lang)}
                </div>
              </div>
            </div>
          </div>
        </ThemeHueBg>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
          {theme.mood.map((m) => (
            <Chip key={m.ko} brand>
              {localized(m, lang)}
            </Chip>
          ))}
        </div>

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 18 }}
          onClick={() => nav("course", { themeId: theme.id })}
        >
          {lang === "ko" ? "코스 자세히 보기" : "See the course"} <Icon.chevR style={{ color: "currentColor" }} />
        </button>
      </div>

      <div style={{ padding: "28px 20px 12px" }}>
        <div className="section-label">{lang === "ko" ? "다른 테마도 볼까요" : "Other themes"}</div>
        <h2 className="section-title">{lang === "ko" ? "비슷한 분위기" : "Similar moods"}</h2>
      </div>
      <div className="hscroll" style={{ paddingLeft: 20, paddingRight: 20, margin: 0 }}>
        {alts.map((th) => (
          <button
            key={th.id}
            onClick={() => nav("theme", { themeId: th.id })}
            className="card"
            style={{ width: 200, textAlign: "left", padding: 0 }}
          >
            <ThemeHueBg hue={th.hue} h={110} themeId={th.id} />
            <div style={{ padding: "10px 14px 14px" }}>
              <div className="serif" style={{ fontSize: 17 }}>
                {localized(th.title, lang)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{localized(th.duration, lang)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
