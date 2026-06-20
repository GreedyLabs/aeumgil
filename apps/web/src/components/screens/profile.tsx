"use client";

// ProfileView — Phase 4(부분). 마이페이지. 회원 여부는 클라이언트 전역 상태(mock),
// 표시 데이터는 서버에서 도메인 타입으로 주입. (실 세션·DB 는 Phase 4 본편에서 연동)
import { localized, type Lang } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { Review, Spot, Theme, User } from "@/domain/types";

const { Signal, ThemeHueBg, Placeholder } = UI;

export interface ReviewWithSpot {
  review: Review;
  spot: Spot;
}

interface ProfileViewProps {
  user: User | null;
  interestThemes: Theme[];
  savedThemes: Theme[];
  reviewsPreview: ReviewWithSpot[];
}

export function ProfileView({ user, interestThemes, savedThemes, reviewsPreview }: ProfileViewProps) {
  const { lang, tweaks, auth, logout } = useAppState();
  const { nav } = useAppNav();

  if (!auth.member || !user) return <ProfileGuest lang={lang} nav={nav} />;

  return tweaks.mypageVariant === "list" ? (
    <ProfileList lang={lang} user={user} interestThemes={interestThemes} nav={nav} logout={logout} />
  ) : (
    <ProfileStats
      lang={lang}
      user={user}
      interestThemes={interestThemes}
      savedThemes={savedThemes}
      reviewsPreview={reviewsPreview}
      nav={nav}
      logout={logout}
    />
  );
}

type Nav = (name: string, params?: Record<string, unknown>) => void;

// ── 공용 조각 ─────────────────────────────
function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat-card">
      <div className="stat-num">{value}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  );
}

export function MenuRow({
  icon,
  label,
  value,
  onClick,
  danger,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <button className={"menu-row" + (last ? " last" : "")} onClick={onClick}>
      <span className="menu-ic" style={danger ? { color: "var(--busy)" } : undefined}>
        {icon}
      </span>
      <span className="menu-lbl" style={danger ? { color: "var(--busy)" } : undefined}>
        {label}
      </span>
      {value && <span className="menu-val">{value}</span>}
      {!danger && <Icon.chevR style={{ color: "var(--ink-4)", flexShrink: 0 }} />}
    </button>
  );
}

function GradeBadge({ user, lang }: { user: User; lang: Lang }) {
  return (
    <span className="grade-badge">
      Lv.{user.level} · {localized(user.grade, lang)}
    </span>
  );
}

function InterestTags({ themes, lang }: { themes: Theme[]; lang: Lang }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {themes.map((th) => (
        <span key={th.id} className="chip brand">
          <Icon.leaf style={{ width: 13, height: 13 }} />
          {localized(th.title, lang)}
        </span>
      ))}
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1, color: "var(--accent)" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon.star key={i} style={{ width: 13, height: 13, color: i < n ? "var(--accent)" : "var(--line-2)" }} />
      ))}
    </span>
  );
}

export function ReviewCard({
  review,
  spot,
  lang,
  onNavSpot,
}: {
  review: Review;
  spot: Spot;
  lang: Lang;
  onNavSpot: (id: string) => void;
}) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <button
        onClick={() => onNavSpot(spot.id)}
        style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left" }}
      >
        <Placeholder label={localized(spot.name, lang)} id={spot.id} h={44} style={{ width: 44, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {localized(spot.name, lang)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
            {localized(spot.region, lang)} · {review.date}
          </div>
        </div>
        <Stars n={review.rating} />
      </button>
      <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, margin: "10px 0 0" }}>{localized(review.text, lang)}</p>
      <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
        <Icon.heart style={{ width: 13, height: 13 }} />
        {lang === "ko" ? `도움돼요 ${review.helpful}` : `${review.helpful} found helpful`}
      </div>
    </div>
  );
}

// ── Variant A — stat-forward ─────────────────
function ProfileStats({
  lang,
  user,
  interestThemes,
  savedThemes,
  reviewsPreview,
  nav,
  logout,
}: {
  lang: Lang;
  user: User;
  interestThemes: Theme[];
  savedThemes: Theme[];
  reviewsPreview: ReviewWithSpot[];
  nav: Nav;
  logout: () => void;
}) {
  return (
    <div className="screen-enter">
      <div className="topbar">
        <div style={{ width: 36 }} />
        <h1>{lang === "ko" ? "내 정보" : "Profile"}</h1>
        <button className="icon-btn" onClick={() => nav("settings")}>
          <Icon.gear />
        </button>
      </div>

      <div style={{ padding: "6px 20px 0" }}>
        <div className="profile-head">
          <img className="avatar-lg" src={user.avatarUrl} alt="" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="serif" style={{ fontSize: 24, lineHeight: 1.15 }}>
                {localized(user.name, lang)}
              </span>
            </div>
            <div style={{ marginTop: 7 }}>
              <GradeBadge user={user} lang={lang} />
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => nav("profileEdit")}>
            <Icon.pencil style={{ width: 14, height: 14 }} />
            {lang === "ko" ? "편집" : "Edit"}
          </button>
        </div>

        <div className="level-bar-wrap">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginBottom: 5 }}>
            <span>{lang === "ko" ? `다음 등급 · ${localized(user.nextGrade, lang)}` : `Next · ${localized(user.nextGrade, lang)}`}</span>
            <span className="mono">{user.levelProgress}%</span>
          </div>
          <div className="level-track">
            <div className="level-fill" style={{ width: `${user.levelProgress}%` }} />
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 20px 0" }}>
        <div className="stat-row">
          <StatCard value={user.stats.visits} label={lang === "ko" ? "방문" : "Visits"} />
          <StatCard value={user.stats.saved} label={lang === "ko" ? "저장 코스" : "Saved"} />
          <StatCard value={user.stats.regions} label={lang === "ko" ? "다녀온 지역" : "Regions"} />
        </div>
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div className="section-label" style={{ margin: 0 }}>
            {lang === "ko" ? "관심 테마" : "Interests"}
          </div>
          <button className="link-sm" onClick={() => nav("profileEdit")}>
            {lang === "ko" ? "수정" : "Edit"}
          </button>
        </div>
        <InterestTags themes={interestThemes} lang={lang} />
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="section-label" style={{ margin: 0 }}>
            {lang === "ko" ? "저장한 코스" : "Saved courses"}
          </div>
          <button className="link-sm" onClick={() => nav("saved")}>
            {lang === "ko" ? "전체" : "All"}
          </button>
        </div>
      </div>
      <div className="hscroll">
        {savedThemes.map((th) => (
          <button key={th.id} onClick={() => nav("theme", { themeId: th.id })} style={{ width: 180, textAlign: "left" }}>
            <ThemeHueBg hue={th.hue} h={108} themeId={th.id}>
              <div style={{ position: "absolute", bottom: 10, left: 12, right: 12, color: "#fff" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85 }}>{localized(th.tag, lang)}</div>
                <div className="serif" style={{ fontSize: 17, lineHeight: 1.1, marginTop: 1 }}>
                  {localized(th.title, lang)}
                </div>
              </div>
            </ThemeHueBg>
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div>
            <div className="section-label" style={{ margin: 0 }}>
              {lang === "ko" ? "내가 쓴 리뷰" : "My reviews"}
            </div>
            <h2 className="section-title" style={{ fontSize: 20, marginTop: 4 }}>
              {user.stats.reviews}
              {lang === "ko" ? "개" : ""}
            </h2>
          </div>
          <button className="link-sm" onClick={() => nav("reviews")}>
            {lang === "ko" ? "전체보기" : "See all"}
          </button>
        </div>
        <div className="desk-2" style={{ display: "grid", gap: 10 }}>
          {reviewsPreview.map(({ review, spot }) => (
            <ReviewCard key={review.id} review={review} spot={spot} lang={lang} onNavSpot={(id) => nav("spot", { spotId: id })} />
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 20px 28px" }}>
        <div className="menu-group">
          <MenuRow icon={<Icon.gear />} label={lang === "ko" ? "설정" : "Settings"} onClick={() => nav("settings")} />
          <MenuRow icon={<Icon.headset />} label={lang === "ko" ? "고객센터" : "Support"} onClick={() => nav("doc", { doc: "support" })} />
          <MenuRow icon={<Icon.doc />} label={lang === "ko" ? "이용약관" : "Terms"} onClick={() => nav("doc", { doc: "terms" })} last />
        </div>
        <button className="logout-link" onClick={logout}>
          <Icon.logout />
          {lang === "ko" ? "로그아웃" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

// ── Variant B — menu-list-forward ────────────
function ProfileList({
  lang,
  user,
  interestThemes,
  nav,
  logout,
}: {
  lang: Lang;
  user: User;
  interestThemes: Theme[];
  nav: Nav;
  logout: () => void;
}) {
  return (
    <div className="screen-enter">
      <div className="topbar">
        <div style={{ width: 36 }} />
        <h1>{lang === "ko" ? "내 정보" : "Profile"}</h1>
        <button className="icon-btn" onClick={() => nav("settings")}>
          <Icon.gear />
        </button>
      </div>

      <div style={{ padding: "6px 20px 0" }}>
        <button className="profile-head-compact" onClick={() => nav("profileEdit")}>
          <img className="avatar-md" src={user.avatarUrl} alt="" />
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{localized(user.name, lang)}</div>
            <div style={{ marginTop: 4 }}>
              <GradeBadge user={user} lang={lang} />
            </div>
          </div>
          <Icon.chevR style={{ color: "var(--ink-4)" }} />
        </button>

        <div className="stat-strip">
          <button onClick={() => nav("reviews")}>
            <b>{user.stats.visits}</b>
            <span>{lang === "ko" ? "방문" : "Visits"}</span>
          </button>
          <span className="strip-div" />
          <button onClick={() => nav("saved")}>
            <b>{user.stats.saved}</b>
            <span>{lang === "ko" ? "저장" : "Saved"}</span>
          </button>
          <span className="strip-div" />
          <button onClick={() => nav("reviews")}>
            <b>{user.stats.reviews}</b>
            <span>{lang === "ko" ? "리뷰" : "Reviews"}</span>
          </button>
        </div>
      </div>

      <div style={{ padding: "22px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "관심 테마" : "Interests"}</div>
        <InterestTags themes={interestThemes} lang={lang} />
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "내 여행" : "My trips"}</div>
        <div className="menu-group">
          <MenuRow icon={<Icon.bookmark />} label={lang === "ko" ? "저장한 테마·코스" : "Saved"} value={`${user.stats.saved}`} onClick={() => nav("saved")} />
          <MenuRow icon={<Icon.pin />} label={lang === "ko" ? "방문 기록" : "Visit history"} value={`${user.stats.visits}`} onClick={() => nav("reviews", { tab: "visits" })} />
          <MenuRow icon={<Icon.star />} label={lang === "ko" ? "내 리뷰" : "My reviews"} value={`${user.stats.reviews}`} onClick={() => nav("reviews")} last />
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "계정" : "Account"}</div>
        <div className="menu-group">
          <MenuRow icon={<Icon.pencil />} label={lang === "ko" ? "프로필 편집" : "Edit profile"} onClick={() => nav("profileEdit")} />
          <MenuRow icon={<Icon.bell />} label={lang === "ko" ? "알림 설정" : "Notifications"} onClick={() => nav("settings")} />
          <MenuRow icon={<Icon.gear />} label={lang === "ko" ? "설정" : "Settings"} onClick={() => nav("settings")} last />
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "지원" : "Support"}</div>
        <div className="menu-group">
          <MenuRow icon={<Icon.headset />} label={lang === "ko" ? "고객센터" : "Support"} onClick={() => nav("doc", { doc: "support" })} />
          <MenuRow icon={<Icon.bell />} label={lang === "ko" ? "공지사항" : "Notices"} onClick={() => nav("doc", { doc: "notice" })} />
          <MenuRow icon={<Icon.doc />} label={lang === "ko" ? "이용약관" : "Terms"} onClick={() => nav("doc", { doc: "terms" })} />
          <MenuRow icon={<Icon.lock />} label={lang === "ko" ? "개인정보처리방침" : "Privacy"} onClick={() => nav("doc", { doc: "privacy" })} last />
        </div>
      </div>

      <div style={{ padding: "22px 20px 28px" }}>
        <button className="logout-link" onClick={logout}>
          <Icon.logout />
          {lang === "ko" ? "로그아웃" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

// ── Guest ─────────────────────────────────────
function ProfileGuest({ lang, nav }: { lang: Lang; nav: Nav }) {
  const goLogin = () => nav("login", { reason: "profile" });
  const locked = [
    { icon: <Icon.bookmark />, label: lang === "ko" ? "저장한 코스" : "Saved courses" },
    { icon: <Icon.pin />, label: lang === "ko" ? "방문 기록" : "Visit history" },
    { icon: <Icon.star />, label: lang === "ko" ? "내 리뷰" : "My reviews" },
  ];
  return (
    <div className="screen-enter">
      <div className="topbar">
        <div style={{ width: 36 }} />
        <h1>{lang === "ko" ? "내 정보" : "Profile"}</h1>
        <button className="icon-btn" onClick={() => nav("settings")}>
          <Icon.gear />
        </button>
      </div>

      <div style={{ padding: "8px 20px 0" }}>
        <div className="login-cta">
          <div className="login-cta-mark">
            <Icon.sparkle style={{ width: 22, height: 22 }} />
          </div>
          <h2 className="serif" style={{ fontSize: 24, margin: "4px 0 0", lineHeight: 1.15, whiteSpace: "pre-line" }}>
            {lang === "ko" ? "로그인하고\n내 여행을 저장하세요" : "Sign in to\nsave your trips"}
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: "8px 0 16px", lineHeight: 1.5 }}>
            {lang === "ko" ? "관심 테마, 저장한 코스, 다녀온 곳이 기기 간에 동기화돼요." : "Your themes, saved courses and visits sync across devices."}
          </p>
          <button className="btn btn-primary btn-block" onClick={goLogin}>
            <Icon.user style={{ width: 17, height: 17 }} />
            {lang === "ko" ? "로그인 / 회원가입" : "Sign in / up"}
          </button>
        </div>
      </div>

      <div style={{ padding: "22px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "로그인 후 이용 가능" : "Available after sign-in"}</div>
        <div className="menu-group">
          {locked.map((l, i) => (
            <button key={i} className={"menu-row" + (i === locked.length - 1 ? " last" : "")} onClick={goLogin}>
              <span className="menu-ic" style={{ color: "var(--ink-4)" }}>
                {l.icon}
              </span>
              <span className="menu-lbl" style={{ color: "var(--ink-3)" }}>
                {l.label}
              </span>
              <Icon.lock style={{ color: "var(--ink-4)", flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 20px 28px" }}>
        <div className="section-label">{lang === "ko" ? "지원" : "Support"}</div>
        <div className="menu-group">
          <MenuRow icon={<Icon.gear />} label={lang === "ko" ? "설정" : "Settings"} onClick={() => nav("settings")} />
          <MenuRow icon={<Icon.headset />} label={lang === "ko" ? "고객센터" : "Support"} onClick={() => nav("doc", { doc: "support" })} />
          <MenuRow icon={<Icon.doc />} label={lang === "ko" ? "이용약관" : "Terms"} onClick={() => nav("doc", { doc: "terms" })} />
          <MenuRow icon={<Icon.lock />} label={lang === "ko" ? "개인정보처리방침" : "Privacy"} onClick={() => nav("doc", { doc: "privacy" })} last />
        </div>
      </div>
    </div>
  );
}
