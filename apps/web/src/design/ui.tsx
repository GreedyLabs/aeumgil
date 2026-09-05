// @ts-nocheck
"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icons";
import { Avatar } from "@/components/screens/avatar";

// ─────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────

function Placeholder({ label, h = 160, dark = false, style, id, src: explicitSrc, overlay = false, priority = false, children }) {
  const [failed, setFailed] = useState(false);
  const src = !failed ? explicitSrc : null;
  return (
    <div style={{
      height: h, width: '100%', position: 'relative', overflow: 'hidden',
      borderRadius: style?.borderRadius,
      background: `linear-gradient(145deg, var(--brand-soft), var(--bg-elev))`,
      ...style,
    }}>
      {src && <Image src={src} alt={label || "관광지 사진"} priority={priority} fill sizes="(max-width: 599px) 100vw, (max-width: 1100px) 50vw, 600px" style={{ objectFit: "cover" }} onError={() => setFailed(true)} />}
      {overlay && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)' }}/>}
      {!src && label && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
          <Icon.pin style={{ width: 28, height: 28, opacity: .4 }} aria-label={`${label} 사진 준비 중`} />
        </div>
      )}
      {children}
    </div>
  );
}

function Signal({ level, lang = 'ko' }) {
  const labels = {
    calm: { ko: '여유', en: 'Calm' },
    moderate: { ko: '보통', en: 'Moderate' },
    busy: { ko: '혼잡', en: 'Busy' },
  };
  return <span className={'signal ' + level}>{labels[level][lang]}</span>;
}

function Chip({ children, active, brand, onClick }) {
  const cls = ['chip', active && 'active', brand && 'brand'].filter(Boolean).join(' ');
  return onClick ? <button className={cls} onClick={onClick}>{children}</button> : <span className={cls}>{children}</span>;
}

function TopBar({ title, onBack, right, elev = false }) {
  return (
    <div className={'topbar' + (elev ? ' elev' : '')}>
      {onBack
        ? <button className="icon-btn" onClick={onBack} aria-label="뒤로가기"><Icon.back/></button>
        : <Link href="/" className="icon-btn" aria-label="홈으로"><Icon.home/></Link>}
      <p className="topbar-title">{title}</p>
      <div style={{ display: 'flex', gap: 4 }}>{right || <Link href="/profile" className="icon-btn" aria-label="내 정보"><Icon.user/></Link>}</div>
    </div>
  );
}

function TabBar({ active, onNav, lang = 'ko' }) {
  const items = [
    { id: 'home', ko: '홈', en: 'Home', icon: Icon.home },
    { id: 'discover', ko: '탐색', en: 'Discover', icon: Icon.discover },
    { id: 'saved', ko: '저장', en: 'Saved', icon: Icon.saved },
    { id: 'profile', ko: '내 정보', en: 'Profile', icon: Icon.user },
  ];
  return (
    <nav className="tabbar" aria-label="주 메뉴">
      {items.map(it => {
        const I = it.icon;
        return (
          <button key={it.id}
            className={'tab' + (active === it.id ? ' active' : '')}
            aria-current={active === it.id ? 'page' : undefined} onClick={() => onNav(it.id)}>
            <I/>
            <span>{it[lang]}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ThemeHueBg({ hue, children, h, themeId, src, label }) {
  return (
    <div className="theme-visual" style={{
      height: h, width: '100%', position: 'relative', overflow: 'hidden',
      background: `radial-gradient(circle at 30% 20%, oklch(0.55 0.12 ${hue}) 0%, oklch(0.3 0.08 ${hue}) 70%)`,
    }}>
      {src && <Placeholder src={src} label={label} h="100%" />}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, color-mix(in oklch, oklch(0.38 0.08 ${hue}) 25%, transparent) 0%, rgba(0,0,0,0.45) 100%)`,
      }}/>
      {!src && <div className="theme-landscape" aria-hidden="true" />}
      {children}
    </div>
  );
}

// ──────────────────────────────
// Desktop sidebar nav (≥900px) — replaces bottom TabBar
// ──────────────────────────────
function Sidebar({ ready = true, active, onNav, lang = 'ko', isMember, user, onLogin, collapsed, onToggle }) {
  const items = [
    { id: 'home', ko: '홈', en: 'Home', icon: Icon.home },
    { id: 'discover', ko: '탐색', en: 'Discover', icon: Icon.discover },
    { id: 'saved', ko: '저장', en: 'Saved', icon: Icon.saved },
    { id: 'profile', ko: '내 정보', en: 'Profile', icon: Icon.user },
  ];
  return (
    <aside className={'desktop-nav' + (collapsed ? ' is-collapsed' : '')}>
      <div className="dnav-header">
        <button className="dnav-toggle" disabled={!ready} onClick={onToggle} aria-expanded={!collapsed} aria-controls="desktop-menu" aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'} title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/><path d={collapsed ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'}/></svg></button>
        <Link href="/" className="dnav-brand" aria-label="에움길 홈"><span className="dnav-brand-text">에움길</span></Link>
      </div>
      <div className="dnav-label">나의 강원 여행</div>
      <nav className="dnav-items" id="desktop-menu" aria-label="주 메뉴">
        {items.map(it => {
          const I = it.icon;
          return (
            <button key={it.id} className={'dnav-item' + (active === it.id ? ' active' : '')} aria-label={it[lang]} title={collapsed ? it[lang] : undefined} aria-current={active === it.id ? 'page' : undefined} onClick={() => onNav(it.id)}>
              <I/><span>{it[lang]}</span>
            </button>
          );
        })}
      </nav>
      <div className="dnav-note"><Icon.sparkle /><p>사람 많은 곳을 벗어나<br />나에게 맞는 강원도를 만나세요.</p><Link href="/doc?type=sources">여행 정보의 기준 <Icon.chevR /></Link></div>
      <div className="dnav-foot">
        {isMember && user ? (
          <button className="dnav-user" aria-label={`${user.name} · 내 정보`} title={collapsed ? user.name : undefined} onClick={() => onNav('profile')}>
            <Avatar src={user.avatar || ""} name={user.name} className="avatar-md" size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>나의 여행 기록</div>
            </div>
          </button>
        ) : (
          <button className="btn btn-primary btn-block btn-sm" aria-label={lang === 'ko' ? '로그인' : 'Sign in'} title={collapsed ? '로그인' : undefined} onClick={onLogin}>
            <Icon.user style={{ width: 16, height: 16 }}/><span>{lang === 'ko' ? '로그인' : 'Sign in'}</span>
          </button>
        )}
        <div className="dnav-copy">에움길 · Made by GreedyLabs</div>
      </div>
    </aside>
  );
}

export { Placeholder, Signal, Chip, TopBar, TabBar, Sidebar, ThemeHueBg };
