"use client";

// MapView — 혼잡도 지도(스타일라이즈 배경 + 실데이터 마커).
// 좌표·혼잡도는 서버 page 에서 실데이터(스팟 좌표 + Phase 3 혼잡 모델)로 내려온다(§4.2).
import { localized, type LocalizedText } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { Congestion } from "@/domain/types";

const { TopBar } = UI;

export interface MapPoi {
  id: string;
  name: LocalizedText;
  lat: number;
  lon: number;
  congestion: Congestion;
}

// 마커 배치 여백(%) — 라벨이 화면 가장자리에 잘리지 않게 데이터 범위를 안쪽으로 사상.
const PAD_X = 14;
const PAD_Y = 12;
// 라벨 겹침 판정 임계(%) — 이 안에 들어오면 아래로 밀어낸다.
const NEAR_X = 20;
const NEAR_Y = 5;

/**
 * lat/lon → 화면 %(x,y) 선형 사상.
 * 스팟 데이터 범위(바운딩박스)를 화면에 펼치고, 근접 스팟(예: 속초시장↔동명항)의
 * 라벨 겹침은 뒤쪽 마커를 아래로 밀어 완화한다. 상대 위치(동해안=오른쪽)는 유지된다.
 */
function projectPois(pois: MapPoi[]): Array<MapPoi & { x: number; y: number }> {
  if (pois.length === 0) return [];
  const lats = pois.map((p) => p.lat);
  const lons = pois.map((p) => p.lon);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);
  const latRange = latMax - latMin || 1;
  const lonRange = lonMax - lonMin || 1;

  const placed = pois.map((p) => ({
    ...p,
    x: PAD_X + ((p.lon - lonMin) / lonRange) * (100 - PAD_X * 2),
    y: PAD_Y + ((latMax - p.lat) / latRange) * (100 - PAD_Y * 2),
  }));

  placed.sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 1; i < placed.length; i++) {
    for (let j = 0; j < i; j++) {
      const cur = placed[i]!;
      const prev = placed[j]!;
      if (Math.abs(cur.x - prev.x) < NEAR_X && cur.y - prev.y < NEAR_Y) {
        cur.y = prev.y + NEAR_Y;
      }
    }
  }
  return placed;
}

export function MapView({ pois }: { pois: MapPoi[] }) {
  const { lang } = useAppState();
  const { nav } = useAppNav();
  const markers = projectPois(pois);

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

        {markers.map((m) => (
          <button
            key={m.id}
            onClick={() => nav("spot", { spotId: m.id })}
            style={{ position: "absolute", left: `${m.x}%`, top: `${m.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <div style={{ padding: "5px 10px 5px 6px", background: "var(--surface)", borderRadius: 100, boxShadow: "var(--shadow-md)", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: `var(--${m.congestion})` }} />
              {localized(m.name, lang)}
            </div>
          </button>
        ))}

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
