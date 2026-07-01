"use client";

// LoginView — Phase 4(부분). 소셜 로그인(mock). 실제 OAuth 는 Phase 4 본편(Auth.js).
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { Brand as BrandMod } from "@/design/brand-logos";
import { Icon } from "./_ui";
import type { AuthProvider } from "@/domain/types";

const Brand = BrandMod as Record<string, React.ComponentType>;

const REASON_COPY: Record<string, { ko: string; en: string }> = {
  save: { ko: "저장하려면 로그인이 필요해요", en: "Sign in to save places" },
  course: { ko: "내 코스를 만들려면 로그인이 필요해요", en: "Sign in to build your course" },
  review: { ko: "리뷰를 남기려면 로그인이 필요해요", en: "Sign in to write a review" },
  onboarding: { ko: "관심사를 저장하려면 로그인이 필요해요", en: "Sign in to save your preferences" },
  profile: { ko: "내 여행 기록을 보려면 로그인하세요", en: "Sign in to see your trips" },
};

export function LoginView({ providers, reason }: { providers: AuthProvider[]; reason?: string }) {
  const { lang, login } = useAppState();
  const { back } = useAppNav();
  const reasonCopy = reason && REASON_COPY[reason] ? REASON_COPY[reason]![lang] : null;

  return (
    <div className="auth-hero">
      <div
        className="auth-hero-bg"
        style={{
          background: "radial-gradient(circle at 28% 18%, oklch(0.62 0.12 135) 0%, transparent 34%), linear-gradient(145deg, oklch(0.3 0.08 145) 0%, oklch(0.18 0.05 210) 72%)",
        }}
      />
      <div className="auth-hero-scrim" />

      <div className="auth-top">
        <button className="icon-btn" style={{ color: "#fff" }} onClick={back} aria-label="close">
          <Icon.close />
        </button>
        <div style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap" }}>
          에움길
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div className="auth-headline">
        <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.8)", fontWeight: 700, marginBottom: 12 }}>
          GANGWON
        </div>
        <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, color: "#fff", margin: 0, letterSpacing: "-0.02em", textShadow: "0 2px 24px rgba(0,0,0,0.4)" }}>
          {lang === "ko" ? (
            <>
              붐비지 않는
              <br />
              강원도를
              <br />
              저장하세요
            </>
          ) : (
            <>
              Save the
              <br />
              quiet side of
              <br />
              Gangwon
            </>
          )}
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", marginTop: 14, lineHeight: 1.5, maxWidth: 300 }}>
          {lang === "ko"
            ? "관심 테마와 다녀온 곳을 기억하고, 혼잡도에 맞는 코스를 추천해 드려요."
            : "We remember your themes and trips, and route around the crowds."}
        </p>
      </div>

      <div className="auth-sheet">
        {reasonCopy && (
          <div className="auth-reason">
            <Icon.sparkle style={{ width: 16, height: 16, color: "var(--brand)", flexShrink: 0 }} />
            <span>{reasonCopy}</span>
          </div>
        )}

        <div style={{ display: "grid", gap: 9 }}>
          {providers.map((p) => {
            const Logo = Brand[p.id];
            return (
              <button
                key={p.id}
                onClick={() => login(p.id)}
                className="social-btn"
                style={{ background: p.bg, color: p.fg, border: `1px solid ${p.border === "transparent" ? "transparent" : p.border}` }}
              >
                <span className="social-logo">{Logo && <Logo />}</span>
                <span className="social-label">{localized(p.label, lang)}</span>
              </button>
            );
          })}
        </div>

        <button className="auth-skip" onClick={back}>
          {lang === "ko" ? "로그인 없이 둘러보기" : "Browse without signing in"}
        </button>

        <p className="auth-terms">
          {lang === "ko" ? (
            <>
              가입 시 <b>이용약관</b> 및 <b>개인정보처리방침</b>에<br />
              동의하는 것으로 간주됩니다.
            </>
          ) : (
            <>
              By continuing you agree to our <b>Terms</b> and <b>Privacy Policy</b>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
