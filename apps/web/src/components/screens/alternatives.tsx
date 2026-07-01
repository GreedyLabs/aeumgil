"use client";

// AlternativeView — Phase 1b. 혼잡 분산형 대체지 제안.
import { useState } from "react";
import { localized, type LocalizedText } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { Spot } from "@/domain/types";

const { TopBar, Signal, Placeholder } = UI;

export interface LocalCommerceItem {
  id: string;
  name: LocalizedText;
  type: LocalizedText;
}

interface Props {
  original: Spot;
  alts: Spot[];
  localCommerce: LocalCommerceItem[];
}

export function AlternativeView({ original, alts, localCommerce }: Props) {
  const { lang } = useAppState();
  const { nav, back } = useAppNav();
  const [selected, setSelected] = useState(alts[0]?.id ?? "");

  const alt = alts.find((a) => a.id === selected) ?? alts[0] ?? original;

  return (
    <div className="screen-enter">
      <TopBar title={lang === "ko" ? "대체지 제안" : "Alternatives"} onBack={back} right={<div />} />

      <div style={{ padding: "4px 20px 16px" }}>
        <div style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, marginBottom: 4, letterSpacing: "0.04em" }}>
          ✦ {lang === "ko" ? "혼잡 분산 제안" : "Reroute suggestion"}
        </div>
        <h1 className="serif" style={{ fontSize: 26, margin: 0, lineHeight: 1.15 }}>
          {lang === "ko" ? (
            <>
              <strong style={{ fontFamily: "Pretendard Variable", fontWeight: 700 }}>{localized(original.name, lang)}</strong> 대신
              <br />
              이런 곳은 어떠세요?
            </>
          ) : (
            <>
              Try these
              <br />
              instead of <em>{localized(original.name, lang)}</em>
            </>
          )}
        </h1>
      </div>

      {/* 원래 계획 vs 대체 제안 */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="card" style={{ padding: 12, opacity: 0.7 }}>
            <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
              {lang === "ko" ? "원래 계획" : "Original"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{localized(original.name, lang)}</div>
            <Signal level={original.congestion} lang={lang} />
            <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 6, fontFamily: "SF Mono, monospace" }}>suitability {original.suitability}</div>
          </div>
          <div className="card" style={{ padding: 12, border: "2px solid var(--brand)", background: "var(--brand-soft)" }}>
            <div style={{ fontSize: 10, color: "var(--brand)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
              {lang === "ko" ? "대체 제안" : "Alternative"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{localized(alt.name, lang)}</div>
            <Signal level={alt.congestion} lang={lang} />
            <div style={{ fontSize: 10, color: "var(--brand)", marginTop: 6, fontFamily: "SF Mono, monospace" }}>
              suitability {alt.suitability} <span style={{ color: "var(--calm)" }}>↑{alt.suitability - original.suitability}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "22px 20px 10px" }}>
        <div className="section-label">{lang === "ko" ? "제안 장소" : "Suggested alternatives"}</div>
      </div>
      <div className="desk-2" style={{ padding: "0 20px", display: "grid", gap: 10 }}>
        {alts.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelected(a.id)}
            className="card"
            style={{ padding: 10, textAlign: "left", display: "flex", gap: 12, border: selected === a.id ? "2px solid var(--brand)" : "1px solid var(--line)" }}
          >
            <Placeholder label={localized(a.name, lang)} src={a.imageUrl} h={70} style={{ width: 80, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{localized(a.name, lang)}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>
                {localized(a.type, lang)} · {localized(a.region, lang)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Signal level={a.congestion} lang={lang} />
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {lang === "ko" ? "적합도" : "Fit"} {a.suitability}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "인근 로컬 상권" : "Local commerce nearby"}</div>
        <h2 className="section-title">{lang === "ko" ? "지역을 응원하는 선택" : "Support the area"}</h2>
      </div>
      <div className="hscroll">
        {localCommerce.map((it) => (
          <div key={it.id} className="card" style={{ width: 160, padding: 0 }}>
            <Placeholder label="local" id={it.id} h={70} />
            <div style={{ padding: "8px 12px 12px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>{localized(it.name, lang)}</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{localized(it.type, lang)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "22px 20px 24px", display: "flex", gap: 10 }}>
        <button className="btn btn-secondary" onClick={back}>
          {lang === "ko" ? "취소" : "Cancel"}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => nav("spot", { spotId: selected })}>
          <Icon.refresh /> {lang === "ko" ? "이 대체지로 바꾸기" : "Swap in"}
        </button>
      </div>
    </div>
  );
}
