"use client";

import { shareCurrentPage } from "@/lib/share";
import { inferCourseOptions } from "@/domain/course-options";
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { ThemeCard } from "./theme-card";
import { SpotRow } from "./home";
import { UI, Icon } from "./_ui";
import type { Spot, Theme } from "@/domain/types";

export function ThemeResultView({
  theme,
  alts,
  query,
  spots,
}: {
  theme: Theme;
  alts: Theme[];
  query: string;
  spots: Spot[];
}) {
  const { lang, showToast } = useAppState();
  const { nav, back } = useAppNav();
  const options = inferCourseOptions(query);
  return (
    <div className="screen-enter theme-page">
      <UI.TopBar
        title={query ? "맞춤 테마 추천" : "테마 소개"}
        onBack={back}
        right={
          <button
            className="icon-btn"
            aria-label="테마 공유"
            onClick={() => void shareCurrentPage(theme.title.ko, showToast)}
          >
            <Icon.share />
          </button>
        }
      />
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            {query ? "✦ 여행의 기분과 가장 가까운 테마" : localized(theme.tag, lang)} ·{" "}
            {localized(theme.region, lang)}
          </span>
          <h1>{localized(theme.title, lang)}</h1>
          <p>{localized(theme.subtitle, lang)}</p>
        </div>
      </header>
      {query && <blockquote className="query-quote">“{query}”</blockquote>}
      <div className="detail-layout">
        <div className="detail-primary">
          <div className="theme-feature">
            <UI.ThemeHueBg
              hue={theme.hue}
              h={360}
              src={theme.imageUrl}
              label={theme.imageLabel && localized(theme.imageLabel, lang)}
            >
              <div className="theme-feature-caption">
                {theme.imageLabel
                  ? `${localized(theme.imageLabel, lang)} · 테마에 포함된 장소`
                  : localized(theme.region, lang)}
                {theme.imageUrl?.includes("visitkorea.or.kr") ? " · 사진 제공: 한국관광공사" : ""}
              </div>
            </UI.ThemeHueBg>
          </div>
          <div className="theme-intro">
            <p>{localized(theme.blurb, lang)}</p>
            <div className="mood-list">
              {theme.mood.map((m) => (
                <UI.Chip key={m.ko} brand>
                  {localized(m, lang)}
                </UI.Chip>
              ))}
            </div>
          </div>
          <section className="section-block">
            <h2>이 여행에서 만나는 곳</h2>
            <div className="card-grid">
              {spots.map((spot) => (
                <SpotRow
                  key={spot.id}
                  spot={spot}
                  lang={lang}
                  onClick={() => nav("spot", { spotId: spot.id })}
                />
              ))}
            </div>
          </section>
        </div>
        <aside className="detail-aside summary-panel" aria-label="여행 요약">
          <h2>이렇게 떠나보세요</h2>
          <dl className="summary-facts">
            <div>
              <dt>여행 지역</dt>
              <dd>{localized(theme.region, lang)}</dd>
            </div>
            <div>
              <dt>여행 일정</dt>
              <dd>{options.days ? `${options.days}일` : localized(theme.duration, lang)}</dd>
            </div>
            <div>
              <dt>관광지 후보</dt>
              <dd>{theme.spotCount}곳</dd>
            </div>
            <div>
              <dt>여행 분위기</dt>
              <dd>{localized(theme.pace, lang)}</dd>
            </div>
            {options.transport && (
              <div>
                <dt>이동수단</dt>
                <dd>{{ car: "자동차", transit: "대중교통", walk: "도보" }[options.transport]}</dd>
              </div>
            )}
          </dl>
          <p>준비된 테마 코스를 바탕으로 일정과 이동수단에 맞춰 방문 순서를 살펴볼 수 있어요.</p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => nav("course", { themeId: theme.id, ...options })}
          >
            코스 자세히 보기 <Icon.chevR />
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => nav("home")}>
            다른 여행으로 추천받기
          </button>
          <p className="summary-footnote">
            혼잡도는 모델 추정치이며, 장소 상세에서 날씨와 대기질을 함께 확인해 주세요.
          </p>
        </aside>
      </div>
      {alts.length > 0 && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">다른 테마도 볼까요</span>
              <h2 className="section-title">비슷한 분위기</h2>
            </div>
          </div>
          <div className="theme-grid">
            {alts.slice(0, 3).map((th) => (
              <ThemeCard key={th.id} theme={th} lang={lang} query={query} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
