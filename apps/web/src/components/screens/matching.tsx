"use client";

// ─────────────────────────────────────────────
// MatchingView — Phase 1b 매칭 애니메이션 화면
//
// 매칭 결과(primaryId/altIds)는 서버(app/result/page.tsx)에서
// getRepository().matchThemes(q) 로 계산해 props 로 받는다.
// (기존 design 의 화면-내부 matchTheme 중복 로직 제거 → repository 로 일원화)
// ─────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";

interface MatchingViewProps {
  query: string;
  primaryId: string;
  altIds: string[];
}

export function MatchingView({ query, primaryId, altIds }: MatchingViewProps) {
  const { lang } = useAppState();
  const { nav } = useAppNav();
  const [step, setStep] = useState(0);

  const steps =
    lang === "ko"
      ? ["입력 이해 중...", "혼잡도·날씨·교통 확인 중...", "강원도 테마 매칭 중..."]
      : ["Understanding...", "Checking conditions...", "Matching Gangwon themes..."];

  useEffect(() => {
    const timers = steps.map((_, i) => setTimeout(() => setStep(i + 1), (i + 1) * 600));
    const done = setTimeout(
      () => nav("theme", { themeId: primaryId, altIds, query }),
      steps.length * 600 + 300,
    );
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="screen-enter"
      style={{ padding: "40px 24px", display: "flex", flexDirection: "column", gap: 32, minHeight: "80vh" }}
    >
      <div>
        <div className="section-label">{lang === "ko" ? "테마 매칭" : "Matching"}</div>
        <h1 className="serif" style={{ fontSize: 30, margin: 0, lineHeight: 1.15 }}>
          {`“${query}”`}
        </h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 12 }}>
          {lang === "ko"
            ? "준비된 강원도 테마 중 가장 잘 맞는 코스를 찾고 있어요."
            : "Finding the best curated theme..."}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {steps.map((s, i) => (
          <div
            key={i}
            style={{ display: "flex", gap: 12, alignItems: "center", opacity: i <= step ? 1 : 0.35, transition: "opacity .3s" }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "2px solid " + (i < step ? "var(--brand)" : "var(--line-2)"),
                background: i < step ? "var(--brand)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {i < step && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
              {i === step && (
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)", animation: "pulse-dot 1s ease-in-out infinite" }} />
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
