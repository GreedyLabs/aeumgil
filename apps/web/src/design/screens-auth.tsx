// @ts-nocheck
"use client";
import React from "react";
import { Icon } from "./icons";
import { Brand } from "./brand-logos";
import * as UI from "./ui";
import { DATA } from "./data";

// ─────────────────────────────────────────────
// AUTH — Login (social) + Onboarding
// ─────────────────────────────────────────────
const { useState: uSa } = React;
const tA = (obj, key, lang) => obj[`${key}_${lang}`] ?? obj[`${key}_ko`] ?? obj[key];

const REASON_COPY = {
  save: { ko: '저장하려면 로그인이 필요해요', en: 'Sign in to save places' },
  course: { ko: '내 코스를 만들려면 로그인이 필요해요', en: 'Sign in to build your course' },
  review: { ko: '리뷰를 남기려면 로그인이 필요해요', en: 'Sign in to write a review' },
  profile: { ko: '내 여행 기록을 보려면 로그인하세요', en: 'Sign in to see your trips' },
};

// ─────────────────────────────────────────────
// LOGIN — full-bleed hero + vertical social buttons
// ─────────────────────────────────────────────
function LoginScreen({ lang, reason, onLogin, onSkip, onClose }) {
  const reasonCopy = reason && REASON_COPY[reason] ? REASON_COPY[reason][lang] : null;

  return (
    <div className="auth-hero">
      {/* Background */}
      <div className="auth-hero-bg" style={{ backgroundImage: `url(${UI.imgFor('woljeongsa-trail')})` }}/>
      <div className="auth-hero-scrim"/>

      {/* Top bar */}
      <div className="auth-top">
        <button className="icon-btn" style={{ color: '#fff' }} onClick={onClose} aria-label="close"><Icon.close/></button>
        <div style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>
          {lang === 'ko' ? '에움길' : '에움길'}
        </div>
        <div style={{ width: 36 }}/>
      </div>

      {/* Headline */}
      <div className="auth-headline">
        <div style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', fontWeight: 700, marginBottom: 12 }}>
          GANGWON
        </div>
        <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, color: '#fff', margin: 0, letterSpacing: '-0.02em', textShadow: '0 2px 24px rgba(0,0,0,0.4)' }}>
          {lang === 'ko' ? (<>붐비지 않는<br/>강원도를<br/>저장하세요</>) : (<>Save the<br/>quiet side of<br/>Gangwon</>)}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', marginTop: 14, lineHeight: 1.5, maxWidth: 300 }}>
          {lang === 'ko'
            ? '관심 테마와 다녀온 곳을 기억하고, 혼잡도에 맞는 코스를 추천해 드려요.'
            : 'We remember your themes and trips, and route around the crowds.'}
        </p>
      </div>

      {/* Bottom sheet */}
      <div className="auth-sheet">
        {reasonCopy && (
          <div className="auth-reason">
            <Icon.sparkle style={{ width: 16, height: 16, color: 'var(--brand)', flexShrink: 0 }}/>
            <span>{reasonCopy}</span>
          </div>
        )}

        <div style={{ display: 'grid', gap: 9 }}>
          {DATA.PROVIDERS.map(p => {
            const Logo = Brand[p.id];
            return (
              <button key={p.id} onClick={() => onLogin(p.id)} className="social-btn"
                style={{ background: p.bg, color: p.fg, border: `1px solid ${p.border === 'transparent' ? 'transparent' : p.border}` }}>
                <span className="social-logo"><Logo/></span>
                <span className="social-label">{tA(p, 'label', lang)}</span>
              </button>
            );
          })}
        </div>

        <button className="auth-skip" onClick={onSkip}>
          {lang === 'ko' ? '로그인 없이 둘러보기' : 'Browse without signing in'}
        </button>

        <p className="auth-terms">
          {lang === 'ko'
            ? <>가입 시 <b>이용약관</b> 및 <b>개인정보처리방침</b>에<br/>동의하는 것으로 간주됩니다.</>
            : <>By continuing you agree to our <b>Terms</b> and <b>Privacy Policy</b>.</>}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ONBOARDING — 3 steps (interests → pace/companion → done)
// ─────────────────────────────────────────────
function OnboardingScreen({ lang, onDone, onSkip }) {
  const [step, setStep] = uSa(0);
  const [interests, setInterests] = uSa(['quiet-inland']);
  const [pace, setPace] = uSa('calm');
  const [companion, setCompanion] = uSa('couple');

  const toggleInterest = (id) => setInterests(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const steps = 3;
  const next = () => step < steps - 1 ? setStep(step + 1) : onDone({ interests, pace, companion });

  const canNext = step === 0 ? interests.length > 0 : true;

  return (
    <div className="screen-enter" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* progress */}
      <div className="onb-top">
        <button className="onb-back" onClick={() => step === 0 ? onSkip() : setStep(step - 1)}>
          {step === 0 ? <Icon.close/> : <Icon.back/>}
        </button>
        <div className="onb-progress">
          {Array.from({ length: steps }).map((_, i) => (
            <span key={i} className={'onb-dot' + (i <= step ? ' on' : '')}/>
          ))}
        </div>
        <button className="onb-skip" onClick={onSkip}>{lang === 'ko' ? '건너뛰기' : 'Skip'}</button>
      </div>

      <div style={{ flex: 1, padding: '8px 22px 0', overflowY: 'auto' }}>
        {step === 0 && (
          <div className="onb-step">
            <div className="onb-kicker">{lang === 'ko' ? '01 · 관심사' : '01 · Interests'}</div>
            <h1 className="serif onb-title">{lang === 'ko' ? '어떤 강원도에\n끌리세요?' : 'What draws you\nto Gangwon?'}</h1>
            <p className="onb-sub">{lang === 'ko' ? '관심 테마를 골라주세요. 추천에 반영돼요. (복수 선택)' : 'Pick the themes you like — we tailor picks to them.'}</p>
            <div className="onb-grid">
              {DATA.THEMES.map(th => {
                const on = interests.includes(th.id);
                return (
                  <button key={th.id} className={'onb-card' + (on ? ' on' : '')} onClick={() => toggleInterest(th.id)}>
                    <div className="onb-card-img" style={{ backgroundImage: `url(${UI.imgFor('theme:' + th.id)})` }}/>
                    <div className="onb-card-scrim"/>
                    {on && <span className="onb-check"><Icon.check style={{ width: 14, height: 14 }}/></span>}
                    <div className="onb-card-body">
                      <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85 }}>{th.tag_ko}</div>
                      <div className="serif" style={{ fontSize: 16, lineHeight: 1.1, marginTop: 2 }}>{tA(th, '', lang)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onb-step">
            <div className="onb-kicker">{lang === 'ko' ? '02 · 여행 스타일' : '02 · Style'}</div>
            <h1 className="serif onb-title">{lang === 'ko' ? '어떻게\n여행하세요?' : 'How do you\ntravel?'}</h1>
            <p className="onb-sub">{lang === 'ko' ? '페이스에 맞춰 혼잡한 곳을 거르거나 더해드려요.' : 'We pace your route by how busy you like it.'}</p>

            <div className="onb-sect-label">{lang === 'ko' ? '여행 페이스' : 'Pace'}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {DATA.PACES.map(p => (
                <button key={p.id} className={'onb-row' + (pace === p.id ? ' on' : '')} onClick={() => setPace(p.id)}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{tA(p, '', lang)}</div>
                    {p.desc_ko && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{p.desc_ko}</div>}
                  </div>
                  <span className="onb-radio">{pace === p.id && <Icon.check style={{ width: 13, height: 13 }}/>}</span>
                </button>
              ))}
            </div>

            <div className="onb-sect-label" style={{ marginTop: 22 }}>{lang === 'ko' ? '누구와 함께' : 'With whom'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DATA.COMPANIONS.map(c => (
                <button key={c.id} className={'chip' + (companion === c.id ? ' active' : '')} onClick={() => setCompanion(c.id)} style={{ padding: '10px 16px', fontSize: 14 }}>
                  {tA(c, '', lang)}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onb-step" style={{ textAlign: 'center', paddingTop: 32 }}>
            <div className="onb-done-mark"><Icon.check style={{ width: 30, height: 30 }}/></div>
            <h1 className="serif onb-title" style={{ textAlign: 'center', whiteSpace: 'normal' }}>{lang === 'ko' ? '준비됐어요' : "You're set"}</h1>
            <p className="onb-sub" style={{ textAlign: 'center', margin: '8px auto 0', maxWidth: 280 }}>
              {lang === 'ko'
                ? '관심사와 여행 스타일을 반영해 강원도를 추천해 드릴게요.'
                : "We'll tailor Gangwon to your themes and pace."}
            </p>
            <div className="onb-summary">
              <div className="onb-sum-row">
                <span>{lang === 'ko' ? '관심 테마' : 'Themes'}</span>
                <b>{interests.map(id => DATA.THEMES.find(t => t.id === id)?.tag_ko).filter(Boolean).join(' · ') || '—'}</b>
              </div>
              <div className="onb-sum-row">
                <span>{lang === 'ko' ? '페이스' : 'Pace'}</span>
                <b>{tA(DATA.PACES.find(p => p.id === pace), '', lang)}</b>
              </div>
              <div className="onb-sum-row">
                <span>{lang === 'ko' ? '동행' : 'With'}</span>
                <b>{tA(DATA.COMPANIONS.find(c => c.id === companion), '', lang)}</b>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="onb-cta">
        <button className="btn btn-primary btn-block" disabled={!canNext} style={{ opacity: canNext ? 1 : 0.45 }} onClick={next}>
          {step < steps - 1
            ? (lang === 'ko' ? '다음' : 'Next')
            : (lang === 'ko' ? '강원도 둘러보기' : 'Explore Gangwon')}
        </button>
      </div>
    </div>
  );
}

export { LoginScreen, OnboardingScreen };
