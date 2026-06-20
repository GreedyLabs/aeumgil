// @ts-nocheck
"use client";
import React from "react";
import { Icon } from "./icons";
import * as UI from "./ui";
import { DATA } from "./data";

// ─────────────────────────────────────────────
// PROFILE / MY PAGE + edit + reviews + settings + docs
// ─────────────────────────────────────────────
const { useState: uSp } = React;
const { Signal: SgP, ThemeHueBg: HBp, Placeholder: PHp } = UI;
const tP = (obj, key, lang) => obj ? (obj[`${key}_${lang}`] ?? obj[`${key}_ko`] ?? obj[key]) : '';

const SAVED_THEME_IDS = ['quiet-inland', 'east-sea-sunrise', 'cafe-viewpoint'];

// ── shared bits ──────────────────────────────
function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-num">{value}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  );
}

function MenuRow({ icon, label, value, onClick, danger, last }) {
  return (
    <button className={'menu-row' + (last ? ' last' : '')} onClick={onClick}>
      <span className="menu-ic" style={danger ? { color: 'var(--busy)' } : null}>{icon}</span>
      <span className="menu-lbl" style={danger ? { color: 'var(--busy)' } : null}>{label}</span>
      {value && <span className="menu-val">{value}</span>}
      {!danger && <Icon.chevR style={{ color: 'var(--ink-4)', flexShrink: 0 }}/>}
    </button>
  );
}

function Switch({ on, onChange }) {
  return (
    <button className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="switch-knob"/>
    </button>
  );
}

function GradeBadge({ user, lang }) {
  return <span className="grade-badge">Lv.{user.level} · {tP(user, 'grade', lang)}</span>;
}

function InterestTags({ ids, lang }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {ids.map(id => {
        const th = DATA.THEMES.find(t => t.id === id);
        if (!th) return null;
        return <span key={id} className="chip brand"><Icon.leaf style={{ width: 13, height: 13 }}/>{tP(th, '', lang)}</span>;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFILE ROUTER
// ─────────────────────────────────────────────
function ProfileScreen({ lang, variant, isMember, user, onNav, onLogout }) {
  if (!isMember) return <ProfileGuest lang={lang} onNav={onNav}/>;
  return variant === 'list'
    ? <ProfileList lang={lang} user={user} onNav={onNav} onLogout={onLogout}/>
    : <ProfileStats lang={lang} user={user} onNav={onNav} onLogout={onLogout}/>;
}

// ── Variant A — stat-forward ─────────────────
function ProfileStats({ lang, user, onNav, onLogout }) {
  const reviews = DATA.REVIEWS.slice(0, 2);
  return (
    <div className="screen-enter">
      <div className="topbar">
        <div style={{ width: 36 }}/>
        <h1>{lang === 'ko' ? '내 정보' : 'Profile'}</h1>
        <button className="icon-btn" onClick={() => onNav('settings')}><Icon.gear/></button>
      </div>

      {/* Header */}
      <div style={{ padding: '6px 20px 0' }}>
        <div className="profile-head">
          <img className="avatar-lg" src={user.avatar} alt=""/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="serif" style={{ fontSize: 24, lineHeight: 1.15 }}>{tP(user, 'name', lang)}</span>
            </div>
            <div style={{ marginTop: 7 }}><GradeBadge user={user} lang={lang}/></div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNav('profileEdit')}><Icon.pencil style={{ width: 14, height: 14 }}/>{lang === 'ko' ? '편집' : 'Edit'}</button>
        </div>

        {/* Level progress */}
        <div className="level-bar-wrap">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginBottom: 5 }}>
            <span>{lang === 'ko' ? `다음 등급 · ${tP(user, 'nextGrade', lang)}` : `Next · ${tP(user, 'nextGrade', lang)}`}</span>
            <span className="mono">{user.levelProgress}%</span>
          </div>
          <div className="level-track"><div className="level-fill" style={{ width: `${user.levelProgress}%` }}/></div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '18px 20px 0' }}>
        <div className="stat-row">
          <StatCard value={user.stats.visits} label={lang === 'ko' ? '방문' : 'Visits'}/>
          <StatCard value={user.stats.saved} label={lang === 'ko' ? '저장 코스' : 'Saved'}/>
          <StatCard value={user.stats.regions} label={lang === 'ko' ? '다녀온 지역' : 'Regions'}/>
        </div>
      </div>

      {/* Interests */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div className="section-label" style={{ margin: 0 }}>{lang === 'ko' ? '관심 테마' : 'Interests'}</div>
          <button className="link-sm" onClick={() => onNav('profileEdit')}>{lang === 'ko' ? '수정' : 'Edit'}</button>
        </div>
        <InterestTags ids={user.interests} lang={lang}/>
      </div>

      {/* Saved courses */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="section-label" style={{ margin: 0 }}>{lang === 'ko' ? '저장한 코스' : 'Saved courses'}</div>
          <button className="link-sm" onClick={() => onNav('saved')}>{lang === 'ko' ? '전체' : 'All'}</button>
        </div>
      </div>
      <div className="hscroll">
        {SAVED_THEME_IDS.map(id => {
          const th = DATA.THEMES.find(t => t.id === id);
          return (
            <button key={id} onClick={() => onNav('theme', { themeId: id })} style={{ width: 180, textAlign: 'left' }}>
              <HBp hue={th.hue} h={108} themeId={th.id}>
                <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12, color: '#fff' }}>
                  <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85 }}>{th.tag_ko}</div>
                  <div className="serif" style={{ fontSize: 17, lineHeight: 1.1, marginTop: 1 }}>{tP(th, '', lang)}</div>
                </div>
              </HBp>
            </button>
          );
        })}
      </div>

      {/* Reviews preview */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div>
            <div className="section-label" style={{ margin: 0 }}>{lang === 'ko' ? '내가 쓴 리뷰' : 'My reviews'}</div>
            <h2 className="section-title" style={{ fontSize: 20, marginTop: 4 }}>{user.stats.reviews}{lang === 'ko' ? '개' : ''}</h2>
          </div>
          <button className="link-sm" onClick={() => onNav('reviews')}>{lang === 'ko' ? '전체보기' : 'See all'}</button>
        </div>
        <div className="desk-2" style={{ display: 'grid', gap: 10 }}>
          {reviews.map(rv => <ReviewCard key={rv.id} review={rv} lang={lang} onNav={onNav}/>)}
        </div>
      </div>

      {/* Menu */}
      <div style={{ padding: '24px 20px 28px' }}>
        <div className="menu-group">
          <MenuRow icon={<Icon.gear/>} label={lang === 'ko' ? '설정' : 'Settings'} onClick={() => onNav('settings')}/>
          <MenuRow icon={<Icon.headset/>} label={lang === 'ko' ? '고객센터' : 'Support'} onClick={() => onNav('doc', { doc: 'support' })}/>
          <MenuRow icon={<Icon.doc/>} label={lang === 'ko' ? '이용약관' : 'Terms'} onClick={() => onNav('doc', { doc: 'terms' })} last/>
        </div>
        <button className="logout-link" onClick={onLogout}><Icon.logout/>{lang === 'ko' ? '로그아웃' : 'Sign out'}</button>
      </div>
    </div>
  );
}

// ── Variant B — menu-list-forward ────────────
function ProfileList({ lang, user, onNav, onLogout }) {
  return (
    <div className="screen-enter">
      <div className="topbar">
        <div style={{ width: 36 }}/>
        <h1>{lang === 'ko' ? '내 정보' : 'Profile'}</h1>
        <button className="icon-btn" onClick={() => onNav('settings')}><Icon.gear/></button>
      </div>

      {/* Compact header → edit */}
      <div style={{ padding: '6px 20px 0' }}>
        <button className="profile-head-compact" onClick={() => onNav('profileEdit')}>
          <img className="avatar-md" src={user.avatar} alt=""/>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{tP(user, 'name', lang)}</div>
            <div style={{ marginTop: 4 }}><GradeBadge user={user} lang={lang}/></div>
          </div>
          <Icon.chevR style={{ color: 'var(--ink-4)' }}/>
        </button>

        {/* inline stat strip */}
        <div className="stat-strip">
          <button onClick={() => onNav('reviews')}><b>{user.stats.visits}</b><span>{lang === 'ko' ? '방문' : 'Visits'}</span></button>
          <span className="strip-div"/>
          <button onClick={() => onNav('saved')}><b>{user.stats.saved}</b><span>{lang === 'ko' ? '저장' : 'Saved'}</span></button>
          <span className="strip-div"/>
          <button onClick={() => onNav('reviews')}><b>{user.stats.reviews}</b><span>{lang === 'ko' ? '리뷰' : 'Reviews'}</span></button>
        </div>
      </div>

      {/* interests */}
      <div style={{ padding: '22px 20px 0' }}>
        <div className="section-label">{lang === 'ko' ? '관심 테마' : 'Interests'}</div>
        <InterestTags ids={user.interests} lang={lang}/>
      </div>

      {/* My trips group */}
      <div style={{ padding: '24px 20px 0' }}>
        <div className="section-label">{lang === 'ko' ? '내 여행' : 'My trips'}</div>
        <div className="menu-group">
          <MenuRow icon={<Icon.bookmark/>} label={lang === 'ko' ? '저장한 테마·코스' : 'Saved'} value={`${user.stats.saved}`} onClick={() => onNav('saved')}/>
          <MenuRow icon={<Icon.pin/>} label={lang === 'ko' ? '방문 기록' : 'Visit history'} value={`${user.stats.visits}`} onClick={() => onNav('reviews', { tab: 'visits' })}/>
          <MenuRow icon={<Icon.star/>} label={lang === 'ko' ? '내 리뷰' : 'My reviews'} value={`${user.stats.reviews}`} onClick={() => onNav('reviews')} last/>
        </div>
      </div>

      {/* Account group */}
      <div style={{ padding: '20px 20px 0' }}>
        <div className="section-label">{lang === 'ko' ? '계정' : 'Account'}</div>
        <div className="menu-group">
          <MenuRow icon={<Icon.pencil/>} label={lang === 'ko' ? '프로필 편집' : 'Edit profile'} onClick={() => onNav('profileEdit')}/>
          <MenuRow icon={<Icon.bell/>} label={lang === 'ko' ? '알림 설정' : 'Notifications'} onClick={() => onNav('settings')}/>
          <MenuRow icon={<Icon.gear/>} label={lang === 'ko' ? '설정' : 'Settings'} onClick={() => onNav('settings')} last/>
        </div>
      </div>

      {/* Support group */}
      <div style={{ padding: '20px 20px 0' }}>
        <div className="section-label">{lang === 'ko' ? '지원' : 'Support'}</div>
        <div className="menu-group">
          <MenuRow icon={<Icon.headset/>} label={lang === 'ko' ? '고객센터' : 'Support'} onClick={() => onNav('doc', { doc: 'support' })}/>
          <MenuRow icon={<Icon.bell/>} label={lang === 'ko' ? '공지사항' : 'Notices'} onClick={() => onNav('doc', { doc: 'notice' })}/>
          <MenuRow icon={<Icon.doc/>} label={lang === 'ko' ? '이용약관' : 'Terms'} onClick={() => onNav('doc', { doc: 'terms' })}/>
          <MenuRow icon={<Icon.lock/>} label={lang === 'ko' ? '개인정보처리방침' : 'Privacy'} onClick={() => onNav('doc', { doc: 'privacy' })} last/>
        </div>
      </div>

      <div style={{ padding: '22px 20px 28px' }}>
        <button className="logout-link" onClick={onLogout}><Icon.logout/>{lang === 'ko' ? '로그아웃' : 'Sign out'}</button>
      </div>
    </div>
  );
}

// ── Guest ─────────────────────────────────────
function ProfileGuest({ lang, onNav }) {
  const goLogin = () => onNav('login', { reason: 'profile' });
  const locked = [
    { icon: <Icon.bookmark/>, label: lang === 'ko' ? '저장한 코스' : 'Saved courses' },
    { icon: <Icon.pin/>, label: lang === 'ko' ? '방문 기록' : 'Visit history' },
    { icon: <Icon.star/>, label: lang === 'ko' ? '내 리뷰' : 'My reviews' },
  ];
  return (
    <div className="screen-enter">
      <div className="topbar">
        <div style={{ width: 36 }}/>
        <h1>{lang === 'ko' ? '내 정보' : 'Profile'}</h1>
        <button className="icon-btn" onClick={() => onNav('settings')}><Icon.gear/></button>
      </div>

      {/* Login prompt */}
      <div style={{ padding: '8px 20px 0' }}>
        <div className="login-cta">
          <div className="login-cta-mark"><Icon.sparkle style={{ width: 22, height: 22 }}/></div>
          <h2 className="serif" style={{ fontSize: 24, margin: '4px 0 0', lineHeight: 1.15 }}>
            {lang === 'ko' ? '로그인하고\n내 여행을 저장하세요' : 'Sign in to\nsave your trips'}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '8px 0 16px', lineHeight: 1.5 }}>
            {lang === 'ko' ? '관심 테마, 저장한 코스, 다녀온 곳이 기기 간에 동기화돼요.' : 'Your themes, saved courses and visits sync across devices.'}
          </p>
          <button className="btn btn-primary btn-block" onClick={goLogin}>
            <Icon.user style={{ width: 17, height: 17 }}/>{lang === 'ko' ? '로그인 / 회원가입' : 'Sign in / up'}
          </button>
        </div>
      </div>

      {/* Locked features */}
      <div style={{ padding: '22px 20px 0' }}>
        <div className="section-label">{lang === 'ko' ? '로그인 후 이용 가능' : 'Available after sign-in'}</div>
        <div className="menu-group">
          {locked.map((l, i) => (
            <button key={i} className={'menu-row' + (i === locked.length - 1 ? ' last' : '')} onClick={goLogin}>
              <span className="menu-ic" style={{ color: 'var(--ink-4)' }}>{l.icon}</span>
              <span className="menu-lbl" style={{ color: 'var(--ink-3)' }}>{l.label}</span>
              <Icon.lock style={{ color: 'var(--ink-4)', flexShrink: 0 }}/>
            </button>
          ))}
        </div>
      </div>

      {/* Open menu */}
      <div style={{ padding: '20px 20px 28px' }}>
        <div className="section-label">{lang === 'ko' ? '지원' : 'Support'}</div>
        <div className="menu-group">
          <MenuRow icon={<Icon.gear/>} label={lang === 'ko' ? '설정' : 'Settings'} onClick={() => onNav('settings')}/>
          <MenuRow icon={<Icon.headset/>} label={lang === 'ko' ? '고객센터' : 'Support'} onClick={() => onNav('doc', { doc: 'support' })}/>
          <MenuRow icon={<Icon.doc/>} label={lang === 'ko' ? '이용약관' : 'Terms'} onClick={() => onNav('doc', { doc: 'terms' })}/>
          <MenuRow icon={<Icon.lock/>} label={lang === 'ko' ? '개인정보처리방침' : 'Privacy'} onClick={() => onNav('doc', { doc: 'privacy' })} last/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REVIEW CARD
// ─────────────────────────────────────────────
function Stars({ n }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: 'var(--accent)' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon.star key={i} style={{ width: 13, height: 13, color: i < n ? 'var(--accent)' : 'var(--line-2)' }}/>
      ))}
    </span>
  );
}

function ReviewCard({ review, lang, onNav }) {
  const s = DATA.SPOTS[review.spotId];
  if (!s) return null;
  return (
    <div className="card" style={{ padding: 12 }}>
      <button onClick={() => onNav('spot', { spotId: s.id })} style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left' }}>
        <PHp label={s.name_ko} id={s.id} h={44} style={{ width: 44, borderRadius: 10, flexShrink: 0 }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tP(s, 'name', lang)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{tP(s, 'region', lang)} · {review.date}</div>
        </div>
        <Stars n={review.rating}/>
      </button>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: '10px 0 0' }}>{review.text_ko}</p>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon.heart style={{ width: 13, height: 13 }}/>{lang === 'ko' ? `도움돼요 ${review.helpful}` : `${review.helpful} found helpful`}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REVIEWS + VISIT HISTORY
// ─────────────────────────────────────────────
function ReviewsScreen({ lang, onNav, onBack, initialTab }) {
  const [tab, setTab] = uSp(initialTab === 'visits' ? 'visits' : 'reviews');
  return (
    <div className="screen-enter">
      <div className="topbar elev">
        <button className="icon-btn" onClick={onBack}><Icon.back/></button>
        <h1>{lang === 'ko' ? '리뷰 · 방문 기록' : 'Reviews & visits'}</h1>
        <div style={{ width: 36 }}/>
      </div>

      <div className="seg-tabs">
        <button className={'seg' + (tab === 'reviews' ? ' on' : '')} onClick={() => setTab('reviews')}>
          {lang === 'ko' ? '리뷰' : 'Reviews'} <span className="seg-n">{DATA.REVIEWS.length}</span>
        </button>
        <button className={'seg' + (tab === 'visits' ? ' on' : '')} onClick={() => setTab('visits')}>
          {lang === 'ko' ? '방문 기록' : 'Visits'} <span className="seg-n">{DATA.VISITS.length}</span>
        </button>
      </div>

      {tab === 'reviews' ? (
        <div className="desk-2" style={{ padding: '16px 20px 28px', display: 'grid', gap: 10 }}>
          {DATA.REVIEWS.map(rv => <ReviewCard key={rv.id} review={rv} lang={lang} onNav={onNav}/>)}
        </div>
      ) : (
        <div style={{ padding: '18px 20px 28px' }}>
          <div className="timeline">
            {DATA.VISITS.map((v, i) => {
              const s = DATA.SPOTS[v.spotId];
              if (!s) return null;
              return (
                <button key={i} className="tl-row" onClick={() => onNav('spot', { spotId: v.spotId })}>
                  <span className="tl-rail"><span className="tl-dot"/></span>
                  <div className="tl-body">
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'SF Mono, monospace' }}>{v.date}</div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, marginTop: 2 }}>{tP(s, 'name', lang)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{tP(s, 'region', lang)}</span>
                      <span style={{ color: 'var(--line-2)' }}>·</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{lang === 'ko' ? '당시' : 'then'}</span>
                      <SgP level={v.congestionThen} lang={lang}/>
                    </div>
                  </div>
                  <Icon.chevR style={{ color: 'var(--ink-4)', alignSelf: 'center', flexShrink: 0 }}/>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFILE EDIT
// ─────────────────────────────────────────────
function ProfileEditScreen({ lang, user, onSave, onBack }) {
  const [name, setName] = uSp(tP(user, 'name', lang));
  const [bio, setBio] = uSp(tP(user, 'bio', lang));
  const [interests, setInterests] = uSp(user.interests);

  const toggle = (id) => setInterests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="screen-enter">
      <div className="topbar elev">
        <button className="icon-btn" onClick={onBack}><Icon.back/></button>
        <h1>{lang === 'ko' ? '프로필 편집' : 'Edit profile'}</h1>
        <button className="link-sm" style={{ fontWeight: 700, color: 'var(--brand)', minWidth: 36 }} onClick={() => onSave({ name, bio, interests })}>
          {lang === 'ko' ? '저장' : 'Save'}
        </button>
      </div>

      {/* avatar */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 8px' }}>
        <div style={{ position: 'relative' }}>
          <img className="avatar-lg" src={user.avatar} alt="" style={{ width: 86, height: 86 }}/>
          <button className="avatar-cam"><Icon.camera/></button>
        </div>
      </div>

      <div style={{ padding: '12px 20px 0' }}>
        <label className="field-label">{lang === 'ko' ? '닉네임' : 'Nickname'}</label>
        <input className="field-input" value={name} onChange={e => setName(e.target.value)} maxLength={20}/>

        <label className="field-label" style={{ marginTop: 18 }}>{lang === 'ko' ? '한 줄 소개' : 'Bio'}</label>
        <textarea className="field-input" rows={3} value={bio} onChange={e => setBio(e.target.value)} maxLength={80} style={{ resize: 'none', lineHeight: 1.5 }}/>
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }} className="mono">{(bio || '').length}/80</div>
      </div>

      <div style={{ padding: '14px 20px 28px' }}>
        <label className="field-label">{lang === 'ko' ? '관심 테마' : 'Interests'}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {DATA.THEMES.map(th => {
            const on = interests.includes(th.id);
            return (
              <button key={th.id} className={'chip' + (on ? ' active' : '')} onClick={() => toggle(th.id)} style={{ padding: '9px 14px', fontSize: 13 }}>
                {on && <Icon.check style={{ width: 13, height: 13 }}/>}{tP(th, '', lang)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
function SettingsScreen({ lang, isMember, onNav, onBack, onLogout, onSetLang }) {
  const [push, setPush] = uSp(true);
  const [crowd, setCrowd] = uSp(true);
  const [marketing, setMarketing] = uSp(false);
  const [dark, setDark] = uSp(false);

  return (
    <div className="screen-enter">
      <div className="topbar elev">
        <button className="icon-btn" onClick={onBack}><Icon.back/></button>
        <h1>{lang === 'ko' ? '설정' : 'Settings'}</h1>
        <div style={{ width: 36 }}/>
      </div>

      {/* Notifications */}
      <div style={{ padding: '8px 20px 0' }}>
        <div className="section-label">{lang === 'ko' ? '알림' : 'Notifications'}</div>
        <div className="menu-group">
          <div className="menu-row static"><span className="menu-lbl">{lang === 'ko' ? '푸시 알림' : 'Push'}</span><Switch on={push} onChange={setPush}/></div>
          <div className="menu-row static"><span className="menu-lbl">{lang === 'ko' ? '혼잡도 알림' : 'Crowd alerts'}</span><Switch on={crowd} onChange={setCrowd}/></div>
          <div className="menu-row static last"><span className="menu-lbl">{lang === 'ko' ? '마케팅 정보 수신' : 'Marketing'}</span><Switch on={marketing} onChange={setMarketing}/></div>
        </div>
      </div>

      {/* General */}
      <div style={{ padding: '20px 20px 0' }}>
        <div className="section-label">{lang === 'ko' ? '일반' : 'General'}</div>
        <div className="menu-group">
          <button className="menu-row" onClick={() => onSetLang(lang === 'ko' ? 'en' : 'ko')}>
            <span className="menu-ic"><Icon.globe/></span>
            <span className="menu-lbl">{lang === 'ko' ? '언어' : 'Language'}</span>
            <span className="menu-val">{lang === 'ko' ? '한국어' : 'English'}</span>
            <Icon.chevR style={{ color: 'var(--ink-4)', flexShrink: 0 }}/>
          </button>
          <div className="menu-row static last"><span className="menu-ic"><Icon.sun/></span><span className="menu-lbl">{lang === 'ko' ? '다크 모드' : 'Dark mode'}</span><Switch on={dark} onChange={setDark}/></div>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '20px 20px 0' }}>
        <div className="section-label">{lang === 'ko' ? '약관 및 정보' : 'About'}</div>
        <div className="menu-group">
          <MenuRow icon={<Icon.bell/>} label={lang === 'ko' ? '공지사항' : 'Notices'} onClick={() => onNav('doc', { doc: 'notice' })}/>
          <MenuRow icon={<Icon.headset/>} label={lang === 'ko' ? '고객센터' : 'Support'} onClick={() => onNav('doc', { doc: 'support' })}/>
          <MenuRow icon={<Icon.doc/>} label={lang === 'ko' ? '이용약관' : 'Terms of service'} onClick={() => onNav('doc', { doc: 'terms' })}/>
          <MenuRow icon={<Icon.lock/>} label={lang === 'ko' ? '개인정보처리방침' : 'Privacy policy'} onClick={() => onNav('doc', { doc: 'privacy' })}/>
          <MenuRow icon={<Icon.doc/>} label={lang === 'ko' ? '앱 버전' : 'App version'} value="1.4.0" onClick={() => {}} last/>
        </div>
      </div>

      {/* Account */}
      {isMember && (
        <div style={{ padding: '20px 20px 0' }}>
          <div className="menu-group">
            <MenuRow icon={<Icon.logout/>} label={lang === 'ko' ? '로그아웃' : 'Sign out'} onClick={onLogout} danger/>
            <button className="menu-row last" onClick={() => {}}>
              <span className="menu-lbl" style={{ color: 'var(--ink-4)' }}>{lang === 'ko' ? '회원 탈퇴' : 'Delete account'}</span>
            </button>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-4)', padding: '24px 0 28px' }}>
        에움길 · Made by GreedyLabs
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DOC — terms / privacy / support / notice
// ─────────────────────────────────────────────
const DOCS = {
  terms: {
    title_ko: '이용약관', title_en: 'Terms of Service',
    updated_ko: '시행일 2025.01.01',
    sections: [
      { h_ko: '제1조 (목적)', b_ko: '본 약관은 GreedyLabs(이하 "회사")가 제공하는 에움길 서비스(이하 "서비스")의 이용 조건 및 절차, 이용자와 회사의 권리·의무를 규정함을 목적으로 합니다.' },
      { h_ko: '제2조 (서비스의 내용)', b_ko: '서비스는 실시간 혼잡도 정보를 바탕으로 한 관광지·테마·코스 추천, 대체지 제안, 저장 및 리뷰 기능을 제공합니다. 혼잡도·날씨·교통 정보는 외부 데이터를 가공한 참고 정보이며 정확성을 보증하지 않습니다.' },
      { h_ko: '제3조 (계정)', b_ko: '이용자는 소셜 로그인(카카오·네이버·구글·애플)을 통해 계정을 생성할 수 있으며, 계정 정보의 관리 책임은 이용자 본인에게 있습니다.' },
      { h_ko: '제4조 (저작권)', b_ko: '서비스 내 콘텐츠의 저작권은 회사 또는 정당한 권리자에게 있으며, 무단 복제·배포를 금합니다.' },
    ],
  },
  privacy: {
    title_ko: '개인정보처리방침', title_en: 'Privacy Policy',
    updated_ko: '시행일 2025.01.01',
    sections: [
      { h_ko: '수집하는 항목', b_ko: '소셜 로그인 시 제공되는 프로필(닉네임, 프로필 이미지, 이메일)과 서비스 이용 기록(저장한 코스, 방문 기록, 리뷰, 관심 테마)을 수집합니다.' },
      { h_ko: '이용 목적', b_ko: '맞춤형 관광 추천, 혼잡 분산 제안, 서비스 개선 및 통계 분석을 위해 사용됩니다.' },
      { h_ko: '보유 기간', b_ko: '회원 탈퇴 시 지체 없이 파기하며, 관계 법령에 따라 보존이 필요한 정보는 해당 기간 동안 보관합니다.' },
      { h_ko: '제3자 제공', b_ko: '이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만 법령에 근거가 있는 경우는 예외로 합니다.' },
    ],
  },
  support: {
    title_ko: '고객센터', title_en: 'Support',
    updated_ko: '평일 09:00–18:00',
    sections: [
      { h_ko: '자주 묻는 질문', b_ko: '혼잡도 정보는 어떻게 계산되나요? · 저장한 코스를 어떻게 공유하나요? · 로그인 없이도 이용할 수 있나요? · 리뷰는 어떻게 수정하나요?' },
      { h_ko: '문의하기', b_ko: '이메일 help@gangwon-trip.kr · 대표전화 1330 (관광통역안내). 앱 내 문의는 평일 영업일 기준 24시간 이내 답변드립니다.' },
      { h_ko: '데이터 출처', b_ko: '혼잡도·교통·날씨 정보는 공공데이터포털 API를 가공하여 제공합니다.' },
    ],
  },
  notice: {
    title_ko: '공지사항', title_en: 'Notices',
    updated_ko: '',
    sections: [
      { h_ko: '봄 성수기 혼잡 알림 기능 추가', b_ko: '2025.04.10 · 벚꽃·축제 기간 동안 실시간 혼잡 알림과 대체지 제안 정확도를 개선했습니다.' },
      { h_ko: '소셜 로그인 지원 확대', b_ko: '2025.03.02 · 카카오·네이버에 이어 구글·애플 로그인을 추가했습니다.' },
      { h_ko: '리뷰·방문 기록 기능 오픈', b_ko: '2025.02.15 · 다녀온 장소를 기록하고 리뷰를 남길 수 있습니다.' },
    ],
  },
};

function DocScreen({ lang, doc, onBack }) {
  const d = DOCS[doc] || DOCS.terms;
  return (
    <div className="screen-enter">
      <div className="topbar elev">
        <button className="icon-btn" onClick={onBack}><Icon.back/></button>
        <h1>{tP(d, 'title', lang)}</h1>
        <div style={{ width: 36 }}/>
      </div>
      <div style={{ padding: '10px 22px 32px' }}>
        <h2 className="serif" style={{ fontSize: 26, margin: '4px 0 2px' }}>{tP(d, 'title', lang)}</h2>
        {d.updated_ko && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 18 }} className="mono">{d.updated_ko}</div>}
        <div style={{ display: 'grid', gap: 20, marginTop: 8 }}>
          {d.sections.map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.01em' }}>{s.h_ko}</div>
              <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>{s.b_ko}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { ProfileScreen, ProfileEditScreen, ReviewsScreen, SettingsScreen, DocScreen };
