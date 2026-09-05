"use client";

import Link from "next/link";
import { useHydrated } from "@/lib/use-hydrated";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { INTENT_QUERY_MAX_LENGTH } from "@/domain/matching";
import { inferCourseOptions } from "@/domain/course-options";
import type { Theme, ThemeMatch } from "@/domain/types";
import { useAppState } from "@/components/app-shell";
import { localized } from "@/lib/i18n";
import { urlFor } from "@/lib/nav";
import { ThemeCard } from "./theme-card";
import { UI, Icon } from "./_ui";

export function MatchingView({
  query,
  match,
  primary,
  alternatives,
}: {
  query: string;
  match: ThemeMatch;
  primary: Theme | null;
  alternatives: Theme[];
}) {
  const ready = useHydrated();
  const { lang } = useAppState();
  const router = useRouter();
  const [text, setText] = useState(query);
  const reason = match.explanation;
  const options = inferCourseOptions(query);
  return (
    <div className="screen-enter matching-page">
      <UI.TopBar title="여행 테마 찾기" onBack={() => router.back()} />
      <header className="page-heading">
        <div>
          <span className="eyebrow">말씀하신 여행에서 출발해요</span>
          <h1>{primary ? "이런 여행은 어떠세요?" : "조금 더 알려주세요"}</h1>
          <p>
            {reason
              ? localized(reason.summary, lang)
              : "지역과 하고 싶은 일을 바탕으로 테마를 찾아요."}
          </p>
        </div>
      </header>
      <details className="match-query-disclosure card" open={!primary}>
        <summary>
          <span>“{query}”</span>
          <strong>조건 수정</strong>
        </summary>
        <form
          className="match-query-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) router.push(urlFor("matching", { query: text.trim() }));
          }}
        >
          <label htmlFor="match-query">어떤 여행을 하고 싶나요?</label>
          <div>
            <textarea
              id="match-query"
              disabled={!ready}
              rows={2}
              maxLength={INTENT_QUERY_MAX_LENGTH}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <button className="btn btn-primary" disabled={!ready || !text.trim()}>
              다시 찾기 <Icon.search />
            </button>
          </div>
        </form>
      </details>
      {reason && (
        <div className="match-keywords" aria-label="찾은 키워드">
          {[...reason.regions, ...reason.keywords].map((word) => (
            <span key={word} className="chip brand">
              {word}
            </span>
          ))}
          {reason.excludedKeywords.map((word) => (
            <span key={`exclude-${word}`} className="chip">
              제외 · {word}
            </span>
          ))}
        </div>
      )}

      {reason?.notice && <p className="match-notice">{localized(reason.notice, lang)}</p>}
      {primary ? (
        <>
          <section className="match-primary card" aria-label="추천 테마">
            <div className="match-primary-photo">
              <UI.Placeholder
                src={primary.imageUrl}
                label={localized(primary.title, lang)}
                h="100%"
              />
            </div>
            <div className="match-primary-body">
              <span className="eyebrow">
                {reason?.status === "partial" ? "일부 키워드와 가까운 테마" : "키워드로 찾은 테마"}
              </span>
              <h2>{localized(primary.title, lang)}</h2>
              <p>{localized(primary.blurb, lang)}</p>
              <div className="match-trip-facts">
                <span>
                  <Icon.pin />
                  {localized(primary.region, lang)}
                </span>
                <span>
                  <Icon.clock />
                  {options.days ? `${options.days}일` : localized(primary.duration, lang)}
                </span>
                <span>{primary.spotCount}곳</span>
              </div>
              <Link
                className="btn btn-primary"
                href={urlFor("course", { themeId: primary.id, ...options })}
              >
                이 조건으로 코스 보기 <Icon.chevR />
              </Link>
              <Link className="text-link" href={urlFor("theme", { themeId: primary.id, query })}>
                테마에 포함된 장소 보기
              </Link>
            </div>
          </section>
          {alternatives.length > 0 && (
            <section className="section-block">
              <h2>다른 후보도 비교해보세요</h2>
              <div className="theme-grid">
                {alternatives.map((theme) => (
                  <ThemeCard key={theme.id} theme={theme} lang={lang} query={query} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="match-empty card">
          <h2>지역과 하고 싶은 일을 함께 적어보세요</h2>
          <p>“속초 바다”, “춘천 아이와 박물관”, “평창 숲길”처럼 짧게 적어도 좋아요.</p>
          <div className="match-examples">
            {["속초 바다와 시장", "춘천 아이와 박물관", "평창 숲길 산책"].map((example) => (
              <Link
                key={example}
                className="btn btn-secondary"
                href={urlFor("matching", { query: example })}
              >
                {example}
              </Link>
            ))}
          </div>
          <Link className="text-link" href="/discover?tab=places">
            여행지를 직접 찾아볼게요 <Icon.chevR />
          </Link>
        </section>
      )}
    </div>
  );
}
