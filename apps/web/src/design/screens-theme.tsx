// @ts-nocheck
"use client";
import React from "react";
import { Icon } from "./icons";
import * as UI from "./ui";
import { DATA } from "./data";
import * as SCREENS_A from "./screens-home";

const { useState: uS2, useEffect: uE2, useMemo } = React;
const { Placeholder: PH, Signal: Sg, Chip: Ch, TopBar: TB, ThemeHueBg: HB } = UI;
const { SpotRow, t: _t } = SCREENS_A;

// ─────────────────────────────────────────────
// MATCHING SIMULATION (natural language → theme)
// ─────────────────────────────────────────────
function matchTheme(query) {
  const q = (query || '').toLowerCase();
  const scores = {};
  DATA.KEYWORD_MATCH.forEach(rule => {
    rule.keywords.forEach(kw => {
      if (q.includes(kw.toLowerCase())) {
        scores[rule.themeId] = (scores[rule.themeId] || 0) + 1;
      }
    });
  });
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primaryId = sorted[0]?.[0] || 'quiet-inland';
  const altIds = DATA.THEMES.filter(t => t.id !== primaryId).slice(0, 3).map(t => t.id);
  return { primaryId, altIds };
}

function MatchingScreen({ query, onDone, lang }) {
  const [step, setStep] = uS2(0);
  const steps = lang === 'ko'
    ? ['입력 이해 중...', '혼잡도·날씨·교통 확인 중...', '강원도 테마 매칭 중...']
    : ['Understanding...', 'Checking conditions...', 'Matching Gangwon themes...'];

  uE2(() => {
    const timers = steps.map((_, i) => setTimeout(() => setStep(i + 1), (i + 1) * 600));
    const done = setTimeout(() => {
      const { primaryId, altIds } = matchTheme(query);
      onDone(primaryId, altIds);
    }, steps.length * 600 + 300);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, []);

  return (
    <div className="screen-enter" style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32, minHeight: '80vh' }}>
      <div>
        <div className="section-label">{lang === 'ko' ? '테마 매칭' : 'Matching'}</div>
        <h1 className="serif" style={{ fontSize: 30, margin: 0, lineHeight: 1.15 }}>
          {lang === 'ko' ? '“' + query + '”' : '"' + query + '"'}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 12 }}>
          {lang === 'ko' ? '준비된 강원도 테마 중 가장 잘 맞는 코스를 찾고 있어요.' : 'Finding the best curated theme...'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', opacity: i <= step ? 1 : 0.35, transition: 'opacity .3s' }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: '2px solid ' + (i < step ? 'var(--brand)' : 'var(--line-2)'),
              background: i < step ? 'var(--brand)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {i < step && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>}
              {i === step && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', animation: 'pulse-dot 1s ease-in-out infinite' }}/>}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// THEME RESULT — matched theme intro
// ─────────────────────────────────────────────
function ThemeResultScreen({ themeId, altIds, query, onNav, lang, onBack }) {
  const theme = DATA.THEMES.find(t => t.id === themeId);
  const alts = altIds ? altIds.map(id => DATA.THEMES.find(t => t.id === id)).filter(Boolean) : DATA.THEMES.filter(x => x.id !== themeId);
  const course = DATA.COURSES[themeId];

  return (
    <div className="screen-enter">
      <TB title={lang === 'ko' ? '매칭 결과' : 'Match'} onBack={onBack}
        right={<button className="icon-btn"><Icon.share/></button>}/>

      <div style={{ padding: '8px 20px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600, marginBottom: 6 }}>
          {lang === 'ko' ? '✦ 가장 잘 맞는 테마' : '✦ Best match'}
        </div>
        {query && (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic', marginBottom: 10 }}>
            "{query}"
          </div>
        )}
        <h1 className="serif" style={{ fontSize: 34, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {_t(theme, '', lang)}
        </h1>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 360 }}>
          {lang === 'ko' ? theme.blurb_ko : theme.blurb_en}
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <HB hue={theme.hue} h={200} themeId={theme.id}>
          <div style={{ position: 'absolute', inset: 0, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: 100, fontWeight: 600 }}>{theme.tag_ko}</span>
              <Sg level="calm" lang={lang}/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12 }}>
              <div style={{ minWidth: 0 }}><div style={{ opacity: 0.7 }}>{lang === 'ko' ? '기간' : 'Duration'}</div><div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap' }}>{theme.duration}</div></div>
              <div style={{ minWidth: 0 }}><div style={{ opacity: 0.7 }}>{lang === 'ko' ? '장소' : 'Spots'}</div><div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap' }}>{theme.spots}</div></div>
              <div style={{ minWidth: 0 }}><div style={{ opacity: 0.7 }}>{lang === 'ko' ? '페이스' : 'Pace'}</div><div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{theme.pace}</div></div>
            </div>
          </div>
        </HB>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          {theme.mood_ko.map(m => <Ch key={m} brand>{m}</Ch>)}
        </div>

        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={() => onNav('course', { themeId })}>
          {lang === 'ko' ? '코스 자세히 보기' : 'See the course'} <Icon.chevR style={{ color: 'currentColor' }}/>
        </button>
      </div>

      {/* Alternative themes */}
      <div style={{ padding: '28px 20px 12px' }}>
        <div className="section-label">{lang === 'ko' ? '다른 테마도 볼까요' : 'Other themes'}</div>
        <h2 className="section-title">{lang === 'ko' ? '비슷한 분위기' : 'Similar moods'}</h2>
      </div>
      <div className="hscroll" style={{ paddingLeft: 20, paddingRight: 20, margin: 0 }}>
        {alts.map(th => (
          <button key={th.id} onClick={() => onNav('theme', { themeId: th.id })}
            className="card" style={{ width: 200, textAlign: 'left', padding: 0 }}>
            <HB hue={th.hue} h={110} themeId={th.id}/>
            <div style={{ padding: '10px 14px 14px' }}>
              <div className="serif" style={{ fontSize: 17 }}>{_t(th, '', lang)}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{th.duration}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COURSE DETAIL — timeline with congestion
// ─────────────────────────────────────────────
function CourseScreen({ themeId, onNav, lang, onBack }) {
  const theme = DATA.THEMES.find(t => t.id === themeId);
  const course = DATA.COURSES[themeId];
  const [day, setDay] = uS2(1);
  const items = course ? course.items.filter(it => it.day === day) : [];

  const busy = items.some(it => it.spot && DATA.SPOTS[it.spot]?.congestion === 'busy');

  return (
    <div className="screen-enter">
      <TB title={lang === 'ko' ? '코스 상세' : 'Course'} onBack={onBack}
        right={<><button className="icon-btn"><Icon.bookmark/></button><button className="icon-btn"><Icon.share/></button></>}/>

      <div style={{ padding: '4px 20px 14px' }}>
        <div className="section-label" style={{ color: `oklch(0.48 0.1 ${theme.hue})` }}>{theme.tag_ko} · {_t(theme, 'region', lang) || theme.region_ko}</div>
        <h1 className="serif" style={{ fontSize: 28, margin: '2px 0 8px', lineHeight: 1.15 }}>
          {_t(course, 'title', lang)}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          {lang === 'ko' ? `${course.day_count}일 · ${theme.pace} · ${theme.spots}개 장소` : `${course.day_count}d · ${theme.pace}`}
        </div>
      </div>

      {/* Congestion banner */}
      {busy && (
        <div style={{ margin: '0 20px 14px', padding: 14, background: 'var(--moderate-bg)', border: '1px solid color-mix(in oklab, var(--moderate) 25%, transparent)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--moderate)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {lang === 'ko' ? '혼잡 분산 제안' : 'Reroute suggested'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
            {lang === 'ko' ? '혼잡 장소가 포함된 코스예요. 같은 테마의 한적한 대체지로 바꿔볼 수 있어요.' : 'This course includes a busy spot. We can swap in a quieter alternative.'}
          </div>
          <button className="btn btn-sm btn-secondary" style={{ marginTop: 10 }} onClick={() => onNav('alternative', { themeId })}>
            <Icon.refresh/> {lang === 'ko' ? '대체지 보기' : 'See alternatives'}
          </button>
        </div>
      )}

      {/* Day tabs */}
      {course.day_count > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '0 20px 10px' }}>
          {Array.from({ length: course.day_count }).map((_, i) => {
            const d = i + 1;
            return (
              <button key={d} onClick={() => setDay(d)} className={'chip' + (day === d ? ' active' : '')}>
                {lang === 'ko' ? `Day ${d}` : `Day ${d}`}
              </button>
            );
          })}
          <div style={{ flex: 1 }}/>
          <button className="chip"><Icon.filter/> {lang === 'ko' ? '조건' : 'Tune'}</button>
        </div>
      )}

      {/* Timeline */}
      <div style={{ padding: '4px 20px 0', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 46, top: 8, bottom: 8, width: 1.5, background: 'var(--line-2)' }}/>
        {items.map((it, i) => (
          <CourseItem key={i} item={it} lang={lang} onNav={onNav} isLast={i === items.length - 1}/>
        ))}
      </div>

      <div style={{ padding: '22px 20px 32px', display: 'flex', gap: 10 }}>
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} onClick={() => onNav('saved')}><Icon.bookmark/> {lang === 'ko' ? '내 여행에 저장' : 'Save trip'}</button>
      </div>
    </div>
  );
}

function CourseItem({ item, lang, onNav, isLast }) {
  if (item.spot) {
    const s = DATA.SPOTS[item.spot];
    return (
      <div style={{ display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 16 }}>
        <div style={{ width: 30, textAlign: 'center', paddingTop: 16, fontSize: 11, color: 'var(--ink-3)', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'SF Mono, monospace', fontWeight: 600 }}>{item.time}</div>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--surface)', border: '2.5px solid var(--brand)', margin: '8px auto 0' }}/>
        </div>
        <button onClick={() => onNav('spot', { spotId: s.id })} className="card" style={{ flex: 1, padding: 12, textAlign: 'left', display: 'flex', gap: 12 }}>
          <PH label={_t(s, 'name', lang)} id={s.id} h={68} style={{ width: 80, borderRadius: 10, flexShrink: 0 }}/>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{_t(s, 'name', lang)}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{_t(s, 'type', lang)} · {item.stay} {lang === 'ko' ? '분' : 'min'}</div>
            </div>
            <Sg level={s.congestion} lang={lang}/>
          </div>
        </button>
      </div>
    );
  }
  if (item.eat) {
    const e = DATA.EATS.find(x => x.id === item.eat);
    return (
      <div style={{ display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 16 }}>
        <div style={{ width: 30, textAlign: 'center', paddingTop: 12, fontSize: 11, color: 'var(--ink-3)', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'SF Mono, monospace', fontWeight: 600 }}>{item.time}</div>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', margin: '6px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.utensils/></div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-elev)', borderRadius: 'var(--r-md)', border: '1px dashed var(--line-2)' }}>
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{lang === 'ko' ? '식사' : 'Meal'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{e.name_ko}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{e.type_ko} · {e.price} · ★ {e.rating}</div>
        </div>
      </div>
    );
  }
  if (item.stay) {
    const s = DATA.STAYS.find(x => x.id === item.stay);
    return (
      <div style={{ display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 16 }}>
        <div style={{ width: 30, textAlign: 'center', paddingTop: 12, fontSize: 11, color: 'var(--ink-3)', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'SF Mono, monospace', fontWeight: 600 }}>{item.time}</div>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand)', margin: '6px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.bed/></div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-elev)', borderRadius: 'var(--r-md)', border: '1px dashed var(--line-2)' }}>
          <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{lang === 'ko' ? '숙박' : 'Stay'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{s.name_ko}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.type_ko} · {s.price_ko}</div>
        </div>
      </div>
    );
  }
  return null;
}

export { MatchingScreen, ThemeResultScreen, CourseScreen, matchTheme };
