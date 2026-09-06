// @ts-nocheck
"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icons";
import { Avatar } from "@/components/screens/avatar";
import { uiText } from "@/lib/i18n";
import { useLanguage } from "@/components/language-context";
import { LanguagePicker } from "@/components/language-picker";

// ─────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────

function Placeholder({
  label,
  h = 160,
  dark = false,
  style,
  id,
  src: explicitSrc,
  overlay = false,
  priority = false,
  children,
}) {
  const lang = useLanguage();
  const [failed, setFailed] = useState(false);
  const src = !failed ? explicitSrc : null;
  return (
    <div
      style={{
        height: h,
        width: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: style?.borderRadius,
        background: `linear-gradient(145deg, var(--brand-soft), var(--bg-elev))`,
        ...style,
      }}
    >
      {src && (
        <Image
          src={src}
          alt={label || uiText("관광지 사진", lang)}
          priority={priority}
          fill
          sizes="(max-width: 599px) 100vw, (max-width: 1100px) 50vw, 600px"
          style={{ objectFit: "cover" }}
          onError={() => setFailed(true)}
        />
      )}
      {overlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      )}
      {!src && label && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--brand)",
          }}
        >
          <Icon.pin
            style={{ width: 28, height: 28, opacity: 0.4 }}
            aria-label={`${label} · ${uiText("사진 준비 중", lang)}`}
          />
        </div>
      )}
      {children}
    </div>
  );
}

function Signal({ level, lang = "ko" }) {
  const labels = {
    calm: { ko: "여유", en: "Calm" },
    moderate: { ko: "보통", en: "Moderate" },
    busy: { ko: "혼잡", en: "Busy" },
  };
  return <span className={"signal " + level}>{uiText(labels[level].ko, lang)}</span>;
}

function Chip({ children, active, brand, onClick }) {
  const cls = ["chip", active && "active", brand && "brand"].filter(Boolean).join(" ");
  return onClick ? (
    <button className={cls} onClick={onClick}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  );
}

function TopBar({ title, onBack, right, elev = false }) {
  const lang = useLanguage();
  return (
    <div className={"topbar" + (elev ? " elev" : "")}>
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label={uiText("뒤로가기", lang)}>
          <Icon.back />
        </button>
      ) : (
        <Link href="/" className="icon-btn" aria-label={uiText("홈으로", lang)}>
          <Icon.home />
        </Link>
      )}
      <p className="topbar-title">{typeof title === "string" ? uiText(title, lang) : title}</p>
      <div style={{ display: "flex", gap: 4 }}>
        {right || (
          <Link href="/profile" className="icon-btn" aria-label={uiText("내 정보", lang)}>
            <Icon.user />
          </Link>
        )}
      </div>
    </div>
  );
}

function TabBar({ ready = true, active, onNav, lang = "ko" }) {
  const items = [
    { id: "home", ko: "홈", en: "Home", icon: Icon.home },
    { id: "discover", ko: "탐색", en: "Discover", icon: Icon.discover },
    { id: "saved", ko: "내 여행", en: "My trips", icon: Icon.saved },
    { id: "profile", ko: "내 정보", en: "Profile", icon: Icon.user },
  ];
  return (
    <nav className="tabbar" aria-label={uiText("주 메뉴", lang)}>
      {items.map((it) => {
        const I = it.icon;
        return (
          <button
            disabled={!ready}
            key={it.id}
            className={"tab" + (active === it.id ? " active" : "")}
            aria-current={active === it.id ? "page" : undefined}
            onClick={() => onNav(it.id)}
          >
            <I />
            <span>{uiText(it.ko, lang)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ThemeHueBg({ hue, children, h, themeId, src, label }) {
  return (
    <div
      className="theme-visual"
      style={{
        height: h,
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background: `radial-gradient(circle at 30% 20%, oklch(0.55 0.12 ${hue}) 0%, oklch(0.3 0.08 ${hue}) 70%)`,
      }}
    >
      {src && <Placeholder src={src} label={label} h="100%" />}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, color-mix(in oklch, oklch(0.38 0.08 ${hue}) 25%, transparent) 0%, rgba(0,0,0,0.45) 100%)`,
        }}
      />
      {!src && <div className="theme-landscape" aria-hidden="true" />}
      {children}
    </div>
  );
}

// ──────────────────────────────
// Desktop sidebar nav (≥900px) — replaces bottom TabBar
// ──────────────────────────────
function Sidebar({
  ready = true,
  active,
  onNav,
  lang = "ko",
  onLanguageChange,
  isMember,
  user,
  onLogin,
  collapsed,
  onToggle,
}) {
  const items = [
    { id: "home", ko: "홈", en: "Home", icon: Icon.home },
    { id: "discover", ko: "탐색", en: "Discover", icon: Icon.discover },
    { id: "saved", ko: "내 여행", en: "My trips", icon: Icon.saved },
    { id: "profile", ko: "내 정보", en: "Profile", icon: Icon.user },
  ];
  return (
    <aside className={"desktop-nav" + (collapsed ? " is-collapsed" : "")}>
      <div className="dnav-header">
        <button
          className="dnav-toggle"
          disabled={!ready}
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls="desktop-menu"
          aria-label={uiText(collapsed ? "사이드바 펼치기" : "사이드바 접기", lang)}
          title={uiText(collapsed ? "사이드바 펼치기" : "사이드바 접기", lang)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M9 4v16" />
            <path d={collapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"} />
          </svg>
        </button>
        <Link href="/" className="dnav-brand" aria-label={uiText("에움길 홈", lang)}>
          <span className="dnav-brand-text">에움길</span>
        </Link>
      </div>
      <div className="dnav-label">{uiText("나의 강원 여행", lang)}</div>
      <nav className="dnav-items" id="desktop-menu" aria-label={uiText("주 메뉴", lang)}>
        {items.map((it) => {
          const I = it.icon;
          return (
            <button
              disabled={!ready}
              key={it.id}
              className={"dnav-item" + (active === it.id ? " active" : "")}
              aria-label={uiText(it.ko, lang)}
              title={collapsed ? uiText(it.ko, lang) : undefined}
              aria-current={active === it.id ? "page" : undefined}
              onClick={() => onNav(it.id)}
            >
              <I />
              <span>{uiText(it.ko, lang)}</span>
            </button>
          );
        })}
      </nav>
      <div className="dnav-note">
        <Icon.sparkle />
        <p>{uiText("사람 많은 곳을 벗어나 나에게 맞는 강원도를 만나세요.", lang)}</p>
        <Link href="/doc?type=sources">
          {uiText("여행 정보의 기준", lang)} <Icon.chevR />
        </Link>
      </div>
      <div className="dnav-foot">
        <LanguagePicker lang={lang} onChange={onLanguageChange} compact={collapsed} />
        {isMember && user ? (
          <button
            className="dnav-user"
            aria-label={`${user.name} · ${uiText("내 정보", lang)}`}
            title={collapsed ? user.name : undefined}
            onClick={() => onNav("profile")}
          >
            <Avatar src={user.avatar || ""} name={user.name} className="avatar-md" size={36} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {uiText("나의 여행 기록", lang)}
              </div>
            </div>
          </button>
        ) : (
          <button
            className="btn btn-primary btn-block btn-sm"
            aria-label={uiText("로그인", lang)}
            title={collapsed ? uiText("로그인", lang) : undefined}
            onClick={onLogin}
          >
            <Icon.user style={{ width: 16, height: 16 }} />
            <span>{uiText("로그인", lang)}</span>
          </button>
        )}
        <div className="dnav-copy">에움길 · Made by GreedyLabs</div>
      </div>
    </aside>
  );
}

export { Placeholder, Signal, Chip, TopBar, TabBar, Sidebar, ThemeHueBg };
