// @ts-nocheck
"use client";

import React from "react";
import { Icon } from "./icons";
import * as UI from "./ui";
import { DATA } from "./data";
import * as SCREENS_A from "./screens-home";

const { useState: uS3 } = React;
const { Placeholder: PH3, Signal: Sg3, Chip: Ch3, TopBar: TB3, ThemeHueBg: HB3 } = UI;
const { t: _t3, SpotRow: SR3 } = SCREENS_A;

// ─────────────────────────────────────────────
// SPOT DETAIL — congestion + suitability + alternatives CTA
// ─────────────────────────────────────────────
function SpotScreen({ spotId, onNav, lang, onBack, congestionViz = 'signal', saved, onToggleSave, onAddCourse }) {
  const s = DATA.SPOTS[spotId];
  if (!s) return null;
  const alts = DATA.ALT_SPOTS[spotId];
  const isSaved = saved && saved.has ? saved.has(spotId) : false;

  const suitabilityLabel = s.suitability >= 80 ? (lang === 'ko' ? '매우 적합' : 'Excellent') :
                           s.suitability >= 65 ? (lang === 'ko' ? '적합' : 'Good') :
                           (lang === 'ko' ? '재고 권장' : 'Reconsider');

  return (
    <div className="screen-enter">
      {/* Hero */}
      <div style={{ position: 'relative' }}>
        <PH3 label={_t3(s, 'name', lang)} id={s.id} h={260} overlay/>
        <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between' }}>
          <button className="icon-btn filled" onClick={onBack}><Icon.back/></button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="icon-btn filled"><Icon.share/></button>
            <button className="icon-btn filled" onClick={() => onToggleSave && onToggleSave(spotId)} style={isSaved ? { color: 'var(--brand)' } : null}>{isSaved ? <Icon.bookmarkFill/> : <Icon.bookmark/>}</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 20px 12px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', rowGap: 4 }}>
          <span className="tag" style={{ whiteSpace: 'nowrap' }}>{_t3(s, 'type', lang)}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{_t3(s, 'region', lang)}</span>
        </div>
        <h1 className="serif" style={{ fontSize: 30, margin: '0 0 6px', lineHeight: 1.1 }}>{_t3(s, 'name', lang)}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
          <span><Icon.star style={{ color: 'var(--accent)', verticalAlign: '-2px' }}/> {s.rating} <span style={{ color: 'var(--ink-3)' }}>({s.reviews.toLocaleString()})</span></span>
          <span style={{ color: 'var(--line-2)' }}>·</span>
          <span><Icon.clock style={{ verticalAlign: '-3px' }}/> {s.duration_ko}</span>
        </div>
      </div>

      {/* Congestion + suitability */}
      <div style={{ padding: '6px 20px 0' }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div className="section-label" style={{ marginBottom: 2 }}>{lang === 'ko' ? '지금 이 시각' : 'Right now'}</div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{suitabilityLabel}</div>
            </div>
            <Sg3 level={s.congestion} lang={lang}/>
          </div>

          {/* Suitability bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>
              <span>{lang === 'ko' ? '방문 적합성' : 'Suitability'}</span>
              <span style={{ fontFamily: 'SF Mono, monospace', color: 'var(--ink-2)' }}>{s.suitability}/100</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg)', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${s.suitability}%`, background: `linear-gradient(90deg, var(--${s.congestion === 'calm' ? 'calm' : s.congestion === 'moderate' ? 'moderate' : 'busy'}), color-mix(in oklab, var(--${s.congestion === 'calm' ? 'calm' : s.congestion === 'moderate' ? 'moderate' : 'busy'}) 80%, #000))`, borderRadius: 100 }}/>
            </div>
          </div>

          {/* Hour-by-hour strip */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.06em' }}>
              {lang === 'ko' ? '시간대별 혼잡' : 'By hour'}
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 48 }}>
              {[22, 28, 38, 55, 68, 82, 95, 78, 62, 48, 40, 32].map((v, i) => {
                const lvl = v > 75 ? 'busy' : v > 50 ? 'moderate' : 'calm';
                const isNow = i === 6;
                return (
                  <div key={i} style={{
                    flex: 1,
                    height: `${v}%`,
                    background: `var(--${lvl})`,
                    opacity: isNow ? 1 : 0.65,
                    borderRadius: 3,
                    outline: isNow ? '1.5px solid var(--ink)' : 'none',
                    outlineOffset: 1,
                    minHeight: 4,
                  }}/>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'SF Mono, monospace', color: 'var(--ink-4)', marginTop: 4 }}>
              <span>9</span><span>11</span><span>13</span><span>15</span><span>17</span><span>19</span>
            </div>
          </div>

          {/* Conditions row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 2, letterSpacing: '0.04em' }}>{lang === 'ko' ? '날씨' : 'Weather'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-2)' }}><Icon.sun/><span style={{ fontSize: 13, fontWeight: 600 }}>{s.weather.temp}°C</span></div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{_t3(s.weather, 'desc', lang)}</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 2, letterSpacing: '0.04em' }}>{lang === 'ko' ? '대기질' : 'Air'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-2)' }}><Icon.wind/><span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.air}</span></div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>PM 18</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 2, letterSpacing: '0.04em' }}>{lang === 'ko' ? '교통' : 'Traffic'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-2)' }}><Icon.car/><span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.traffic_ko}</span></div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{lang === 'ko' ? '인근 도로' : 'Roads'}</div>
            </div>
          </div>
        </div>
      </div>

      {s.desc_ko && (
        <div style={{ padding: '18px 20px 0' }}>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>{s.desc_ko}</div>
        </div>
      )}

      <div style={{ padding: '16px 20px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {s.tags_ko.map(tg => <Ch3 key={tg}>{tg}</Ch3>)}
      </div>

      {/* Alt spots CTA */}
      {alts && (
        <div style={{ padding: '22px 20px 0' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid color-mix(in oklab, var(--brand) 18%, var(--line))' }}>
            <div style={{ padding: '14px 16px', background: 'var(--brand-soft)' }}>
              <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {lang === 'ko' ? '비슷한 분위기, 덜 붐빔' : 'Same vibe, less busy'}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>
                {lang === 'ko' ? '같은 테마를 유지하면서도 쾌적하게 즐길 수 있는 대체지를 제안해요.' : 'Alternatives with the same theme and feel.'}
              </div>
            </div>
            <button onClick={() => onNav('alternative', { spotId })} style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', fontSize: 14, fontWeight: 600, color: 'var(--brand)' }}>
              <span><Icon.refresh/> {lang === 'ko' ? `대체지 ${alts.length}곳 보기` : `See ${alts.length} alternatives`}</span>
              <Icon.chevR/>
            </button>
          </div>
        </div>
      )}

      {/* Nearby eats & stays */}
      <div style={{ padding: '24px 20px 0' }}>
        <div className="section-label">{lang === 'ko' ? '근처' : 'Nearby'}</div>
        <h2 className="section-title">{lang === 'ko' ? '음식점 · 숙박' : 'Eats & stays'}</h2>
      </div>
      <div className="hscroll">
        {DATA.EATS.slice(0, 3).map(e => (
          <div key={e.id} className="card" style={{ width: 170, padding: 0 }}>
            <PH3 label="eats" id={e.id} h={80}/>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}><Icon.utensils/>{e.type_ko}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, lineHeight: 1.25 }}>{e.name_ko}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{e.price} · ★{e.rating}</div>
            </div>
          </div>
        ))}
        {DATA.STAYS.slice(0, 2).map(st => (
          <div key={st.id} className="card" style={{ width: 170, padding: 0 }}>
            <PH3 label="stays" id={st.id} h={80}/>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}><Icon.bed/>{st.type_ko}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, lineHeight: 1.25 }}>{st.name_ko}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{st.price_ko}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 20px 24px', display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary"><Icon.map/></button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onAddCourse && onAddCourse(spotId)}><Icon.plus/> {lang === 'ko' ? '내 코스에 추가' : 'Add to course'}</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ALTERNATIVE — congestion redistribution
// ─────────────────────────────────────────────
function AlternativeScreen({ spotId, themeId, onNav, lang, onBack }) {
  const ctxId = spotId || (themeId === 'east-sea-sunrise' ? 'anmok-beach' : themeId === 'market-local' ? 'sokcho-market' : 'seorak-gwongeum');
  const original = DATA.SPOTS[ctxId];
  const altIds = DATA.ALT_SPOTS[ctxId] || ['sacheon-beach', 'dongmyeong-port'];
  const [selected, setSel] = uS3(altIds[0]);
  const alt = DATA.SPOTS[selected];

  return (
    <div className="screen-enter">
      <TB3 title={lang === 'ko' ? '대체지 제안' : 'Alternatives'} onBack={onBack} right={<div/>}/>

      <div style={{ padding: '4px 20px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.04em' }}>
          ✦ {lang === 'ko' ? '혼잡 분산 제안' : 'Reroute suggestion'}
        </div>
        <h1 className="serif" style={{ fontSize: 26, margin: 0, lineHeight: 1.15 }}>
          {lang === 'ko' ? <><strong style={{ fontFamily: 'Pretendard Variable', fontWeight: 700 }}>{original.name_ko}</strong> 대신<br/>이런 곳은 어떠세요?</> : <>Try these<br/>instead of <em>{original.name_en}</em></>}
        </h1>
      </div>

      {/* Original vs alternative comparison */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card" style={{ padding: 12, opacity: 0.7 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>{lang === 'ko' ? '원래 계획' : 'Original'}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{original.name_ko}</div>
            <Sg3 level={original.congestion} lang={lang}/>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 6, fontFamily: 'SF Mono, monospace' }}>suitability {original.suitability}</div>
          </div>
          <div className="card" style={{ padding: 12, border: '2px solid var(--brand)', background: 'var(--brand-soft)' }}>
            <div style={{ fontSize: 10, color: 'var(--brand)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{lang === 'ko' ? '대체 제안' : 'Alternative'}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{alt.name_ko}</div>
            <Sg3 level={alt.congestion} lang={lang}/>
            <div style={{ fontSize: 10, color: 'var(--brand)', marginTop: 6, fontFamily: 'SF Mono, monospace' }}>suitability {alt.suitability} <span style={{ color: 'var(--calm)' }}>↑{alt.suitability - original.suitability}</span></div>
          </div>
        </div>
      </div>

      {/* Alt options list */}
      <div style={{ padding: '22px 20px 10px' }}>
        <div className="section-label">{lang === 'ko' ? '제안 장소' : 'Suggested alternatives'}</div>
      </div>
      <div className="desk-2" style={{ padding: '0 20px', display: 'grid', gap: 10 }}>
        {altIds.map(id => {
          const a = DATA.SPOTS[id];
          return (
            <button key={id} onClick={() => setSel(id)} className="card"
              style={{ padding: 10, textAlign: 'left', display: 'flex', gap: 12, border: selected === id ? '2px solid var(--brand)' : '1px solid var(--line)' }}>
              <PH3 label={a.name_ko} id={a.id} h={70} style={{ width: 80, borderRadius: 10, flexShrink: 0 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{a.name_ko}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>{a.type_ko} · {a.region_ko}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sg3 level={a.congestion} lang={lang}/>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{lang === 'ko' ? '적합도' : 'Fit'} {a.suitability}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Nearby local commerce */}
      <div style={{ padding: '24px 20px 0' }}>
        <div className="section-label">{lang === 'ko' ? '인근 로컬 상권' : 'Local commerce nearby'}</div>
        <h2 className="section-title">{lang === 'ko' ? '지역을 응원하는 선택' : 'Support the area'}</h2>
      </div>
      <div className="hscroll">
        {DATA.EATS.slice(0, 3).concat(DATA.STAYS.slice(0, 2)).map((it, i) => (
          <div key={i} className="card" style={{ width: 160, padding: 0 }}>
            <PH3 label="local" id={it.id} h={70}/>
            <div style={{ padding: '8px 12px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>{it.name_ko}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{it.type_ko}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '22px 20px 24px', display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onBack}>{lang === 'ko' ? '취소' : 'Cancel'}</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onNav('spot', { spotId: selected })}>
          <Icon.refresh/> {lang === 'ko' ? '이 대체지로 바꾸기' : 'Swap in'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SAVED / BOOKMARK
// ─────────────────────────────────────────────
function SavedScreen({ onNav, lang }) {
  const saved = ['quiet-inland', 'east-sea-sunrise'];
  return (
    <div className="screen-enter">
      <TB3 title={lang === 'ko' ? '내 여행' : 'My trips'} right={<button className="icon-btn"><Icon.plus/></button>}/>
      <div style={{ padding: '4px 20px 12px' }}>
        <div className="section-label">{lang === 'ko' ? '저장된 테마' : 'Saved themes'}</div>
        <h2 className="section-title">{lang === 'ko' ? `${saved.length}개 코스` : `${saved.length} courses`}</h2>
      </div>

      <div className="desk-2" style={{ padding: '0 20px', display: 'grid', gap: 14 }}>
        {saved.map(id => {
          const th = DATA.THEMES.find(t => t.id === id);
          const cs = DATA.COURSES[id];
          return (
            <button key={id} onClick={() => onNav('theme', { themeId: id })} className="card" style={{ padding: 0, textAlign: 'left' }}>
              <HB3 hue={th.hue} h={130} themeId={th.id}>
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  <Icon.bookmarkFill style={{ color: '#fff' }}/>
                </div>
                <div style={{ position: 'absolute', bottom: 12, left: 14, color: '#fff' }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85 }}>{th.tag_ko}</div>
                  <div className="serif" style={{ fontSize: 20, marginTop: 2 }}>{_t3(th, '', lang)}</div>
                </div>
              </HB3>
              <div style={{ padding: '12px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {_t3(cs, 'title', lang)} · <span style={{ fontFamily: 'SF Mono, monospace' }}>Apr 24-25</span>
                </div>
                <Sg3 level="calm" lang={lang}/>
              </div>
            </button>
          );
        })}

        {/* Empty discover card */}
        <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-elev)', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-lg)' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 10 }}>
            {lang === 'ko' ? '더 많은 테마를 탐색해보세요' : 'Discover more themes'}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNav('home')}>
            <Icon.sparkle/> {lang === 'ko' ? '추천 받기' : 'Get matched'}
          </button>
        </div>
      </div>

      {/* Recently viewed */}
      <div style={{ padding: '26px 20px 12px' }}>
        <div className="section-label">{lang === 'ko' ? '최근 본 장소' : 'Recently viewed'}</div>
      </div>
      <div className="desk-2" style={{ padding: '0 20px 24px', display: 'grid', gap: 8 }}>
        {['sacheon-beach', 'woljeongsa-trail', 'dongmyeong-port'].map(id => {
          const s = DATA.SPOTS[id];
          return <SR3 key={id} spot={s} lang={lang} onClick={() => onNav('spot', { spotId: id })}/>;
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAP (simple stylized) — stub so tab works
// ─────────────────────────────────────────────
function MapScreen({ onNav, lang }) {
  return (
    <div className="screen-enter" style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <TB3 title={lang === 'ko' ? '지도' : 'Map'} right={<button className="icon-btn filled"><Icon.filter/></button>}/>
      <div style={{ flex: 1, position: 'relative', background: 'linear-gradient(180deg, oklch(0.94 0.03 155), oklch(0.88 0.04 160))', borderTop: '1px solid var(--line)', overflow: 'hidden' }}>
        {/* topo lines */}
        <svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, opacity: 0.25 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <path key={i} d={`M -20 ${60 + i * 42} Q 100 ${40 + i * 42}, 200 ${80 + i * 42} T 420 ${60 + i * 42}`} fill="none" stroke="oklch(0.35 0.05 155)" strokeWidth="0.7"/>
          ))}
        </svg>
        {/* coast line on right */}
        <svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
          <path d="M 330 -10 Q 310 150, 340 300 T 320 620 L 420 620 L 420 -10 Z" fill="oklch(0.82 0.05 220)" opacity="0.35"/>
        </svg>

        {/* POIs */}
        {[
          { id: 'woljeongsa-trail', x: 32, y: 48, lvl: 'calm' },
          { id: 'daegwallyeong-sheep', x: 40, y: 34, lvl: 'moderate' },
          { id: 'seorak-gwongeum', x: 62, y: 20, lvl: 'busy' },
          { id: 'dongmyeong-port', x: 72, y: 28, lvl: 'calm' },
          { id: 'sokcho-market', x: 68, y: 34, lvl: 'busy' },
          { id: 'anmok-beach', x: 78, y: 58, lvl: 'busy' },
          { id: 'sacheon-beach', x: 76, y: 52, lvl: 'calm' },
          { id: 'jumunjin-cafe', x: 74, y: 64, lvl: 'moderate' },
          { id: 'ojukheon', x: 58, y: 62, lvl: 'moderate' },
        ].map(m => (
          <button key={m.id} onClick={() => onNav('spot', { spotId: m.id })}
            style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%, -50%)' }}>
            <div style={{ padding: '5px 10px 5px 6px', background: 'var(--surface)', borderRadius: 100, boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${m.lvl})` }}/>
              {DATA.SPOTS[m.id].name_ko}
            </div>
          </button>
        ))}

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'var(--surface)', borderRadius: 12, padding: '10px 12px', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>{lang === 'ko' ? '혼잡도' : 'Congestion'}</div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
            {['calm', 'moderate', 'busy'].map(l => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--${l})` }}/>
                <span style={{ color: 'var(--ink-2)' }}>{l === 'calm' ? (lang === 'ko' ? '여유' : 'Calm') : l === 'moderate' ? (lang === 'ko' ? '보통' : 'Mod') : (lang === 'ko' ? '혼잡' : 'Busy')}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DISCOVER — all themes grid
// ─────────────────────────────────────────────
function DiscoverScreen({ onNav, lang, themeVariant }) {
  return (
    <div className="screen-enter">
      <TB3 title={lang === 'ko' ? '탐색' : 'Discover'} right={<button className="icon-btn"><Icon.filter/></button>}/>
      <div style={{ padding: '4px 20px 14px' }}>
        <h1 className="serif" style={{ fontSize: 28, margin: 0, lineHeight: 1.15 }}>
          {lang === 'ko' ? '강원도 특화 테마' : 'Gangwon themes'}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>
          {lang === 'ko' ? `${DATA.THEMES.length}개 코스 · 혼잡도 실시간` : `${DATA.THEMES.length} curated courses`}
        </div>
      </div>
      <div className="desk-2" style={{ padding: '0 20px 24px', display: 'grid', gap: 12 }}>
        {DATA.THEMES.map(th => (
          <button key={th.id} onClick={() => onNav('theme', { themeId: th.id })} className="card" style={{ padding: 0, textAlign: 'left', display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: 120, flexShrink: 0, position: 'relative' }}>
              <HB3 hue={th.hue} h={106} themeId={th.id}>
                <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', fontWeight: 700, background: 'rgba(0,0,0,0.3)', padding: '3px 7px', borderRadius: 100 }}>{th.tag_ko}</div>
              </HB3>
            </div>
            <div style={{ padding: '12px 14px', flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 18, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{_t3(th, '', lang)}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{_t3(th, 'subtitle', lang)}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', fontSize: 10.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
                <Sg3 level={th.id === 'mountain-trek' ? 'moderate' : 'calm'} lang={lang}/>
                <span style={{ whiteSpace: 'nowrap' }}>· {th.duration}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export { SpotScreen, AlternativeScreen, SavedScreen, MapScreen, DiscoverScreen };
