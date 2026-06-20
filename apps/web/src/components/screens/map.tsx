"use client";

// MapView — Phase 1b. 혼잡도 지도(스타일라이즈). Phase 3 에서 실 좌표·혼잡도 연동.
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { Spot } from "@/domain/types";

const { TopBar } = UI;

// POI 배치(시안). 좌표·혼잡도는 Phase 3 에서 실데이터로 대체.
const POIS = [
  { id: "woljeongsa-trail", x: 32, y: 48, lvl: "calm" },
  { id: "daegwallyeong-sheep", x: 40, y: 34, lvl: "moderate" },
  { id: "seorak-gwongeum", x: 62, y: 20, lvl: "busy" },
  { id: "dongmyeong-port", x: 72, y: 28, lvl: "calm" },
  { id: "sokcho-market", x: 68, y: 34, lvl: "busy" },
  { id: "anmok-beach", x: 78, y: 58, lvl: "busy" },
  { id: "sacheon-beach", x: 76, y: 52, lvl: "calm" },
  { id: "jumunjin-cafe", x: 74, y: 64, lvl: "moderate" },
  { id: "ojukheon", x: 58, y: 62, lvl: "moderate" },
];

export function MapView({ spots }: { spots: Record<string, Spot> }) {
  const { lang } = useAppState();
  const { nav } = useAppNav();

  return (
    <div className="screen-enter" style={{ minHeight: "calc(100vh - 60px)", display: "flex", flexDirection: "column" }}>
      <TopBar
        title={lang === "ko" ? "지도" : "Map"}
        right={
          <button className="icon-btn filled">
            <Icon.filter />
          </button>
        }
      />
      <div style={{ flex: 1, position: "relative", background: "linear-gradient(180deg, oklch(0.94 0.03 155), oklch(0.88 0.04 160))", borderTop: "1px solid var(--line)", overflow: "hidden" }}>
        <svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, opacity: 0.25 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <path key={i} d={`M -20 ${60 + i * 42} Q 100 ${40 + i * 42}, 200 ${80 + i * 42} T 420 ${60 + i * 42}`} fill="none" stroke="oklch(0.35 0.05 155)" strokeWidth="0.7" />
          ))}
        </svg>
        <svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
          <path d="M 330 -10 Q 310 150, 340 300 T 320 620 L 420 620 L 420 -10 Z" fill="oklch(0.82 0.05 220)" opacity="0.35" />
        </svg>

        {POIS.map((m) => {
          const spot = spots[m.id];
          if (!spot) return null;
          return (
            <button
              key={m.id}
              onClick={() => nav("spot", { spotId: m.id })}
              style={{ position: "absolute", left: `${m.x}%`, top: `${m.y}%`, transform: "translate(-50%, -50%)" }}
            >
              <div style={{ padding: "5px 10px 5px 6px", background: "var(--surface)", borderRadius: 100, boxShadow: "var(--shadow-md)", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: `var(--${m.lvl})` }} />
                {localized(spot.name, lang)}
              </div>
            </button>
          );
        })}

        <div style={{ position: "absolute", bottom: 16, left: 16, background: "var(--surface)", borderRadius: 12, padding: "10px 12px", boxShadow: "var(--shadow-md)" }}>
          <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
            {lang === "ko" ? "혼잡도" : "Congestion"}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
            {["calm", "moderate", "busy"].map((l) => (
              <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--${l})` }} />
                <span style={{ color: "var(--ink-2)" }}>
                  {l === "calm" ? (lang === "ko" ? "여유" : "Calm") : l === "moderate" ? (lang === "ko" ? "보통" : "Mod") : lang === "ko" ? "혼잡" : "Busy"}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
