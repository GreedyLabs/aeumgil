// @ts-nocheck
"use client";
import React from "react";
import { Icon } from "./icons";
import * as UI from "./ui";
import { DATA } from "./data";

const { useState, useEffect, useRef } = React;
const { Placeholder, Signal, Chip, TopBar, TabBar, ThemeHueBg } = UI;

// t() — language helper
const t = (obj, key, lang) => obj[`${key}_${lang}`] ?? obj[`${key}_ko`] ?? obj[key];

// ─────────────────────────────────────────────
// HOME — two layouts controlled by homeLayout tweak
// ─────────────────────────────────────────────
function HomeScreen({ onNav, onPrompt, lang, homeLayout }) {
  const [prompt, setPrompt] = useState('');
  const { SAMPLE_PROMPTS, THEMES } = DATA;

  const submit = (text) => {
    const query = (text || prompt).trim();
    if (!query) return;
    onPrompt(query);
  };

  return (
    <div className="screen-enter" style={{ paddingBottom: 24 }}>
      {/* Full-bleed hero with rotating background */}
      <HeroBackground
        lang={lang}
        prompt={prompt}
        setPrompt={setPrompt}
        submit={submit}
        samplePrompts={SAMPLE_PROMPTS}
      />

      {/* Conditions strip */}
      <div style={{ padding: '24px 18px 6px' }}>
        <div className="section-label">{lang === 'ko' ? '오늘의 강원도' : 'Gangwon today'}</div>
        <div className="card" style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <ConditionStat icon={<Icon.sun/>} label={lang === 'ko' ? '맑음 12°C' : 'Clear 12°C'} sub={lang === 'ko' ? '체감 10°C' : 'Feels 10°C'}/>
          <ConditionStat icon={<Icon.wind/>} label={lang === 'ko' ? '공기 좋음' : 'Air good'} sub="PM 18"/>
          <ConditionStat icon={<Icon.car/>} label={lang === 'ko' ? '원활' : 'Clear'} sub={lang === 'ko' ? '영동고속 ↑' : 'Yeongdong ↑'}/>
        </div>
      </div>

      {/* Themes - two layouts */}
      <div style={{ padding: '24px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>{lang === 'ko' ? '큐레이티드 테마' : 'Curated themes'}</div>
            <h2 className="section-title">{lang === 'ko' ? '강원도 특화 코스' : 'Signature Gangwon'}</h2>
          </div>
          <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--brand)' }}>
            {lang === 'ko' ? '전체' : 'All'} <Icon.chevR style={{ verticalAlign: 'middle' }}/>
          </button>
        </div>
      </div>

      {homeLayout === 'themes-first' ? (
        <div className="desk-2" style={{ padding: '0 18px', display: 'grid', gap: 12 }}>
          {THEMES.map(th => <ThemeCardBig key={th.id} theme={th} lang={lang} onClick={() => onNav('theme', { themeId: th.id })}/>)}
        </div>
      ) : (
        <div className="hscroll">
          {THEMES.map(th => <ThemeCardSmall key={th.id} theme={th} lang={lang} onClick={() => onNav('theme', { themeId: th.id })}/>)}
        </div>
      )}

      {/* Suggested spots by condition */}
      <div style={{ padding: '24px 18px 0' }}>
        <div className="section-label">{lang === 'ko' ? '지금 가기 좋은' : 'Best right now'}</div>
        <h2 className="section-title" style={{ marginBottom: 12 }}>
          {lang === 'ko' ? '덜 붐비는 곳부터' : 'Quieter spots first'}
        </h2>
        <div className="desk-2" style={{ display: 'grid', gap: 10 }}>
          {['woljeongsa-trail', 'sacheon-beach', 'dongmyeong-port'].map(id => {
            const s = DATA.SPOTS[id];
            return <SpotRow key={id} spot={s} lang={lang} onClick={() => onNav('spot', { spotId: id })}/>;
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Hero Background — 전체 뒷배경 + 검색 (AllTrails 스타일)
// ─────────────────────────────────────────────
function HeroBackground({ lang, prompt, setPrompt, submit, samplePrompts }) {
  const slides = [
    { id: 'seorak-gwongeum', caption_ko: '설악산 · 권금성', caption_en: 'Seoraksan · Gwongeumseong' },
    { id: 'woljeongsa-trail', caption_ko: '오대산 · 월정사 선재길', caption_en: 'Odaesan · Seonjae Trail' },
    { id: 'sacheon-beach', caption_ko: '강릉 · 사천진 해변', caption_en: 'Gangneung · Sacheonjin Beach' },
  ];
  const [active, setActive] = useState(0);
  const userTouchedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      if (userTouchedRef.current) return;
      setActive(a => (a + 1) % slides.length);
    }, 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  const go = (i) => {
    userTouchedRef.current = true;
    setActive((i + slides.length) % slides.length);
  };

  return (
    <div style={{ position: 'relative', height: 440, marginBottom: 4, overflow: 'hidden' }}>
      {/* Rotating background layers */}
      {slides.map((s, i) => (
        <div key={s.id} style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${UI.imgFor(s.id)})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: active === i ? 1 : 0,
          transition: 'opacity 1.2s ease',
        }}/>
      ))}
      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.7) 100%)',
      }}/>

      {/* Top label */}
      <div style={{ position: 'absolute', top: 16, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
        <div style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, opacity: 0.92 }}>
          {lang === 'ko' ? '에움길' : '에움길'}
        </div>
        <div style={{ fontSize: 11, opacity: 0.75, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon.pin/> {lang === 'ko' ? slides[active].caption_ko : slides[active].caption_en}
        </div>
      </div>

      {/* Hero content */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px', color: '#fff' }}>
        <h1 className="serif" style={{ fontSize: 38, margin: 0, lineHeight: 1.05, letterSpacing: '-0.02em', textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
          {lang === 'ko' ? (<>오늘은<br/>어떤 강원도가<br/>좋으세요?</>) : (<>How should<br/>Gangwon feel<br/>today?</>)}
        </h1>

        {/* Pill search bar (light) */}
        <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.98)', borderRadius: 100, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.25)' }}>
          <Icon.sparkle style={{ color: 'var(--brand)', flexShrink: 0 }}/>
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder={lang === 'ko' ? '예) 조용한 여행' : 'e.g., A quiet trip'}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--ink)', minWidth: 0 }}
          />
          <button onClick={() => submit()} style={{
            width: 32, height: 32, flexShrink: 0, borderRadius: '50%',
            background: 'var(--brand)', color: '#fff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon.search style={{ width: 16, height: 16 }}/>
          </button>
        </div>

        {/* Sample prompts (white chips on overlay) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          {samplePrompts.slice(0, 3).map((p, i) => (
            <button key={i} onClick={() => submit(p[lang])} style={{
              fontSize: 12, padding: '6px 12px', borderRadius: 100,
              background: 'rgba(255,255,255,0.18)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.35)', backdropFilter: 'blur(8px)',
            }}>
              {p[lang].length > 22 ? p[lang].slice(0, 20) + '…' : p[lang]}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom pagination bars (AllTrails style) */}
      <div style={{ position: 'absolute', bottom: 16, right: 20, display: 'flex', gap: 6, alignItems: 'center' }}>
        {slides.map((_, i) => (
          <button key={i} onClick={() => go(i)} style={{
            width: active === i ? 24 : 14, height: 3, borderRadius: 100,
            background: active === i ? '#fff' : 'rgba(255,255,255,0.45)',
            border: 'none', padding: 0, transition: 'width .3s, background .3s',
          }}/>
        ))}
      </div>
    </div>
  );
}

function ConditionStat({ icon, label, sub }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)' }}>{icon}<span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span></div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Theme cards — 3 variants
// ─────────────────────────────────────────────
function ThemeCardSmall({ theme, lang, onClick, variant = 'default' }) {
  if (variant === 'minimal') {
    return (
      <button onClick={onClick} style={{
        width: 220, textAlign: 'left', padding: 18,
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)', display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `oklch(0.58 0.09 ${theme.hue})` }}/>
        <div className="serif" style={{ fontSize: 22, lineHeight: 1.15 }}>{t(theme, '', lang)}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{theme.duration} · {theme.spots} {lang === 'ko' ? '장소' : 'spots'}</div>
      </button>
    );
  }
  return (
    <button onClick={onClick} style={{ width: 220, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ThemeHueBg hue={theme.hue} h={140} themeId={theme.id}>
        <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>{theme.tag_ko}</div>
          <Signal level={theme.id === 'mountain-trek' || theme.id === 'east-sea-sunrise' ? 'moderate' : 'calm'} lang={lang}/>
        </div>
      </ThemeHueBg>
      <div>
        <div className="serif" style={{ fontSize: 20, lineHeight: 1.2 }}>{t(theme, '', lang)}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{theme.duration} · {theme.spots} {lang === 'ko' ? '장소' : 'spots'}</div>
      </div>
    </button>
  );
}

function ThemeCardBig({ theme, lang, onClick }) {
  return (
    <button onClick={onClick} className="card" style={{ textAlign: 'left', padding: 0, display: 'block' }}>
      <ThemeHueBg hue={theme.hue} h={170} themeId={theme.id}>
        <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)', fontWeight: 600, background: 'rgba(0,0,0,0.25)', padding: '4px 8px', borderRadius: 100 }}>{theme.tag_ko}</span>
          <Signal level={theme.id === 'mountain-trek' ? 'moderate' : 'calm'} lang={lang}/>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px', background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)', color: '#fff' }}>
          <div className="serif" style={{ fontSize: 24, lineHeight: 1.15 }}>{t(theme, '', lang)}</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{t(theme, 'subtitle', lang)}</div>
        </div>
      </ThemeHueBg>
      <div style={{ padding: '12px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', gap: 12 }}>
          <span><Icon.clock style={{ verticalAlign: '-3px', marginRight: 4 }}/>{theme.duration}</span>
          <span><Icon.pin style={{ verticalAlign: '-3px', marginRight: 4 }}/>{theme.region_ko}</span>
          <span><Icon.route style={{ verticalAlign: '-3px', marginRight: 4 }}/>{theme.spots}</span>
        </div>
        <Icon.chevR style={{ color: 'var(--ink-3)' }}/>
      </div>
    </button>
  );
}

function ThemeCardLayered({ theme, lang, onClick }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', width: 260, display: 'flex', flexDirection: 'column', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ fontSize: 11, color: `oklch(0.45 0.1 ${theme.hue})`, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{theme.tag_ko}</div>
        <div className="serif" style={{ fontSize: 22, lineHeight: 1.15, marginTop: 4 }}>{t(theme, '', lang)}</div>
      </div>
      <ThemeHueBg hue={theme.hue} h={100} themeId={theme.id}/>
      <div style={{ padding: '10px 16px 14px', fontSize: 12, color: 'var(--ink-3)' }}>
        {theme.duration} · {theme.spots} {lang === 'ko' ? '장소' : 'spots'}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// SPOT ROW (home list + theme course)
// ─────────────────────────────────────────────
function SpotRow({ spot, lang, onClick }) {
  return (
    <button onClick={onClick} className="card" style={{ padding: 10, display: 'flex', gap: 12, alignItems: 'stretch', textAlign: 'left' }}>
      <Placeholder label={t(spot, 'name', lang)} id={spot.id} h={70} style={{ width: 80, borderRadius: 12, flexShrink: 0 }}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(spot, 'name', lang)}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{t(spot, 'type', lang)} · {t(spot, 'region', lang)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Signal level={spot.congestion} lang={lang}/>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            <Icon.star style={{ color: 'var(--accent)', verticalAlign: '-2px' }}/> {spot.rating}
          </span>
        </div>
      </div>
    </button>
  );
}

export { HomeScreen, ThemeCardSmall, ThemeCardBig, ThemeCardLayered, SpotRow, t };
