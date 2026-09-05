"use client";

import Link from "next/link";
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import { Avatar } from "./avatar";
import { ThemeCard } from "./theme-card";
import { ReviewCard, type ReviewWithSpot } from "./review-card";
import type { Theme, User } from "@/domain/types";

export type { ReviewWithSpot } from "./review-card";

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
  const content = (
    <>
      <span className="menu-ic" style={danger ? { color: "var(--busy)" } : undefined}>
        {icon}
      </span>
      <span className="menu-lbl" style={danger ? { color: "var(--busy)" } : undefined}>
        {label}
      </span>
      {value && <span className="menu-val">{value}</span>}
      {onClick && !danger && <Icon.chevR />}
    </>
  );
  return onClick ? (
    <button className={`menu-row${last ? " last" : ""}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={`menu-row static${last ? " last" : ""}`}>{content}</div>
  );
}

export function ProfileView({
  user,
  interestThemes,
  savedThemes,
  reviewsPreview,
}: {
  user: User | null;
  interestThemes: Theme[];
  savedThemes: Theme[];
  reviewsPreview: ReviewWithSpot[];
}) {
  const { lang, logout } = useAppState();
  const { nav } = useAppNav();
  return (
    <div className="screen-enter profile-page">
      <UI.TopBar
        title="내 여행 기록"
        right={
          user ? (
            <Link className="icon-btn" aria-label="설정" href="/settings">
              <Icon.gear />
            </Link>
          ) : (
            <div />
          )
        }
      />
      <header className="page-heading">
        <div>
          <span className="eyebrow">에움길과 함께한 여정</span>
          <h1>{user ? `${localized(user.name, lang)}님의 여행` : "다음 여행도, 지난 여행도"}</h1>
          <p>
            {user
              ? "마음에 담은 코스와 다녀온 곳을 한눈에 살펴보세요."
              : "관심 있는 테마를 저장하고 나만의 강원 여행을 모아보세요."}
          </p>
        </div>
      </header>
      {user ? (
        <>
          <div className="profile-overview">
            <section className="summary-panel">
              <div className="profile-head">
                <Avatar className="avatar-lg" src={user.avatarUrl} />
                <div>
                  <strong>{localized(user.name, lang)}</strong>
                  <span className="grade-badge">
                    Lv.{user.level} · {localized(user.grade, lang)}
                  </span>
                </div>
              </div>
              <p>{user.bio ? localized(user.bio, lang) : "여행의 취향을 프로필에 남겨보세요."}</p>
              <Link href="/profile/edit" className="btn btn-secondary btn-block">
                <Icon.pencil /> 프로필 편집
              </Link>
            </section>
            <section className="profile-activity">
              <div className="stat-row">
                {[
                  { label: "다녀온 곳", value: user.stats.visits, href: "/reviews?tab=visits" },
                  { label: "저장한 코스", value: user.stats.saved, href: "/saved" },
                  { label: "내 리뷰", value: user.stats.reviews, href: "/reviews" },
                ].map((stat) => (
                  <Link className="stat-card" key={stat.href} href={stat.href}>
                    <div className="stat-num">{stat.value}</div>
                    <div className="stat-lbl">
                      {stat.label} <Icon.chevR />
                    </div>
                  </Link>
                ))}
              </div>
              <div className="profile-interests">
                <div className="section-heading">
                  <h2>관심 있는 여행</h2>
                  <Link className="text-link" href="/onboarding">
                    여행 취향 설정 <Icon.chevR />
                  </Link>
                </div>
                <div className="mood-list">
                  {interestThemes.length ? (
                    interestThemes.map((theme) => (
                      <Link className="chip brand" key={theme.id} href={`/theme/${theme.id}`}>
                        {localized(theme.title, lang)}
                      </Link>
                    ))
                  ) : (
                    <p className="empty-message">
                      관심 테마를 선택하면 내 취향을 기억할 수 있어요.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
          <section className="section-block">
            <div className="section-heading">
              <h2 className="section-title">저장한 여행</h2>
              <Link href="/saved" className="text-link">
                전체 보기 <Icon.chevR />
              </Link>
            </div>
            {savedThemes.length ? (
              <div className="theme-grid">
                {savedThemes.slice(0, 3).map((theme) => (
                  <ThemeCard key={theme.id} theme={theme} lang={lang} />
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <Icon.bookmark />
                <div>
                  <h2>마음에 드는 여행을 저장해 보세요</h2>
                  <p>코스 상세에서 저장하면 이곳에서 다시 볼 수 있어요.</p>
                </div>
                <Link href="/discover" className="btn btn-secondary">
                  테마 둘러보기
                </Link>
              </div>
            )}
          </section>
          <section className="section-block">
            <div className="section-heading">
              <h2 className="section-title">내가 남긴 이야기</h2>
              <Link href="/reviews" className="text-link">
                전체 보기 <Icon.chevR />
              </Link>
            </div>
            {reviewsPreview.length ? (
              <div className="spot-grid">
                {reviewsPreview.map(({ review, spot }) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    spot={spot}
                    lang={lang}
                    onNavSpot={(spotId) => nav("spot", { spotId })}
                  />
                ))}
              </div>
            ) : (
              <p className="empty-message">
                아직 작성한 리뷰가 없어요. 다녀온 장소에서 여행 이야기를 남겨보세요.
              </p>
            )}
          </section>
        </>
      ) : (
        <div className="profile-guest">
          <section className="login-cta">
            <div className="login-cta-mark">
              <Icon.sparkle />
            </div>
            <h2>
              나만의 강원을
              <br />
              차곡차곡 모아보세요
            </h2>
            <p>저장한 테마와 여행 기록을 여러 기기에서 이어볼 수 있어요.</p>
            <Link className="btn btn-primary" href="/login?reason=profile">
              로그인 / 회원가입 <Icon.chevR />
            </Link>
          </section>
          <section className="guest-benefits">
            {[
              {
                icon: Icon.bookmark,
                title: "마음에 드는 여행 저장",
                body: "찾아둔 테마를 다음 여행에서도 빠르게 꺼내보세요.",
              },
              {
                icon: Icon.pin,
                title: "다녀온 장소와 리뷰",
                body: "강원에서 만난 풍경과 경험을 기록으로 남겨요.",
              },
              {
                icon: Icon.leaf,
                title: "나만의 여행 취향",
                body: "관심 테마와 동행, 여행 페이스를 설정할 수 있어요.",
              },
            ].map((item) => (
              <div key={item.title}>
                <item.icon />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
      <footer className="profile-footer">
        <Link href="/doc?type=support">고객센터</Link>
        <Link href="/doc?type=terms">이용약관</Link>
        <Link href="/doc?type=privacy">개인정보처리방침</Link>
        {user && <button onClick={logout}>로그아웃</button>}
      </footer>
    </div>
  );
}
