// @ts-nocheck
"use client";
import React from "react";
import { Icon } from "./icons";

// ─────────────────────────────────────────────
// Image source — Unsplash Source by keyword
// ─────────────────────────────────────────────
const IMG_BY_ID = {
  // Spots
  'anmok-beach': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=70&auto=format',
  'sacheon-beach': 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=600&q=70&auto=format',
  'ojukheon': 'https://images.unsplash.com/photo-1578664182354-e3878aa30da4?w=600&q=70&auto=format',
  'daegwallyeong-sheep': 'https://images.unsplash.com/photo-1484557985045-edf25e08da73?w=600&q=70&auto=format',
  'woljeongsa-trail': 'https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=600&q=70&auto=format',
  'seorak-gwongeum': 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=70&auto=format',
  'sokcho-market': 'https://images.unsplash.com/photo-1555992336-03a23c7b20ee?w=600&q=70&auto=format',
  'dongmyeong-port': 'https://images.unsplash.com/photo-1516575869224-4de7cfca79c4?w=600&q=70&auto=format',
  'jumunjin-cafe': 'https://images.unsplash.com/photo-1501426026826-31c667bdf23d?w=600&q=70&auto=format',
  // Eats
  'e1': 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=400&q=70&auto=format',
  'e2': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=70&auto=format',
  'e3': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=70&auto=format',
  'e4': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=400&q=70&auto=format',
  // Stays
  's1': 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=400&q=70&auto=format',
  's2': 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&q=70&auto=format',
  's3': 'https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=400&q=70&auto=format',
  // Themes
  'theme:quiet-inland': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=70&auto=format',
  'theme:east-sea-sunrise': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=70&auto=format',
  'theme:mountain-trek': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=70&auto=format',
  'theme:market-local': 'https://images.unsplash.com/photo-1555992336-03a23c7b20ee?w=800&q=70&auto=format',
  'theme:cafe-viewpoint': 'https://images.unsplash.com/photo-1501426026826-31c667bdf23d?w=800&q=70&auto=format',
  'theme:family-experience': 'https://images.unsplash.com/photo-1484557985045-edf25e08da73?w=800&q=70&auto=format',
};
const imgFor = (id) => IMG_BY_ID[id] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=70&auto=format';

// ─────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────

function Placeholder({ label, h = 160, dark = false, style, id, overlay = false, children }) {
  const src = id ? imgFor(id) : null;
  return (
    <div style={{
      height: h, width: '100%', position: 'relative', overflow: 'hidden',
      borderRadius: style?.borderRadius,
      background: src
        ? `#2a2e2a url("${src}") center/cover no-repeat`
        : `repeating-linear-gradient(135deg, color-mix(in oklab, var(--brand) 12%, var(--bg-elev)) 0 10px, var(--bg-elev) 10px 22px)`,
      ...style,
    }}>
      {overlay && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)' }}/>}
      {!src && label && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
          <span className="ph-label" style={{ fontFamily: 'SF Mono, monospace', fontSize: 10, background: 'color-mix(in oklab, var(--bg) 85%, transparent)', padding: '4px 8px', borderRadius: 4, color: 'var(--ink-2)' }}>{label}</span>
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
  return <button className={cls} onClick={onClick}>{children}</button>;
}

function TopBar({ title, onBack, right, elev = false }) {
  return (
    <div className={'topbar' + (elev ? ' elev' : '')}>
      {onBack
        ? <button className="icon-btn" onClick={onBack}><Icon.back/></button>
        : <button className="icon-btn"><Icon.menu/></button>}
      <h1>{title}</h1>
      <div style={{ display: 'flex', gap: 4 }}>{right || <button className="icon-btn"><Icon.user/></button>}</div>
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
    <div className="tabbar">
      {items.map(it => {
        const I = it.icon;
        return (
          <button key={it.id}
            className={'tab' + (active === it.id ? ' active' : '')}
            onClick={() => onNav(it.id)}>
            <I/>
            <span>{it[lang]}</span>
          </button>
        );
      })}
    </div>
  );
}

function ThemeHueBg({ hue, children, h, themeId }) {
  const src = themeId ? imgFor('theme:' + themeId) : null;
  return (
    <div style={{
      height: h, width: '100%', position: 'relative', overflow: 'hidden',
      background: src
        ? `#222 url("${src}") center/cover no-repeat`
        : `radial-gradient(circle at 30% 20%, oklch(0.55 0.12 ${hue}) 0%, oklch(0.3 0.08 ${hue}) 70%)`,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: src
          ? `linear-gradient(180deg, color-mix(in oklch, oklch(0.38 0.08 ${hue}) 35%, transparent) 0%, rgba(0,0,0,0.55) 100%)`
          : 'transparent',
      }}/>
      {!src && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.07) 0 14px, transparent 14px 28px)` }}/>
      )}
      {children}
    </div>
  );
}

// ──────────────────────────────
// Desktop sidebar nav (≥900px) — replaces bottom TabBar
// ──────────────────────────────
function Sidebar({ active, onNav, lang = 'ko', isMember, user, onLogin }) {
  const items = [
    { id: 'home', ko: '홈', en: 'Home', icon: Icon.home },
    { id: 'discover', ko: '탐색', en: 'Discover', icon: Icon.discover },
    { id: 'saved', ko: '저장', en: 'Saved', icon: Icon.saved },
    { id: 'profile', ko: '내 정보', en: 'Profile', icon: Icon.user },
  ];
  return (
    <aside className="desktop-nav">
      <div className="dnav-brand serif">에움길</div>
      <nav className="dnav-items">
        {items.map(it => {
          const I = it.icon;
          return (
            <button key={it.id} className={'dnav-item' + (active === it.id ? ' active' : '')} onClick={() => onNav(it.id)}>
              <I/><span>{it[lang]}</span>
            </button>
          );
        })}
      </nav>
      <div className="dnav-foot">
        {isMember && user ? (
          <button className="dnav-user" onClick={() => onNav('profile')}>
            <img src={user.avatar} alt=""/>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user[`name_${lang}`] || user.name_ko}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Lv.{user.level} · {user[`grade_${lang}`] || user.grade_ko}</div>
            </div>
          </button>
        ) : (
          <button className="btn btn-primary btn-block btn-sm" onClick={onLogin}>
            <Icon.user style={{ width: 16, height: 16 }}/>{lang === 'ko' ? '로그인' : 'Sign in'}
          </button>
        )}
        <div className="dnav-copy">에움길 · Made by GreedyLabs</div>
      </div>
    </aside>
  );
}

export { Placeholder, Signal, Chip, TopBar, TabBar, Sidebar, ThemeHueBg, imgFor };
