"use client";
import Link from "next/link";
import { ExternalLink } from "@/components/external-link";

// 관광지 상세: 원천별 예측·측정을 구분하고 실제 이용 안내를 함께 제공한다.
import { useState, useTransition } from "react";
import { createReviewAction, createVisitAction } from "@/app/actions/reviews";
import { localized } from "@/lib/i18n";
import { shareCurrentPage } from "@/lib/share";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { SpotPublicInfo } from "./spot-public-info";
import { NearbyPlaceCard } from "./nearby-place-card";
import { RatingStars } from "./rating-stars";
import { UI, Icon } from "./_ui";
import type { Eat, Spot, Stay } from "@/domain/types";

const { TopBar: _TopBar, Signal, Chip, Placeholder } = UI;

interface Props {
  spot: Spot;
  alts: Spot[];
  eats: Eat[];
  stays: Stay[];
}

// 시간대별 혼잡은 자체 모델, 일별 집중률은 관광공사 API 예측이다.

export function SpotView({ spot: s, alts, eats, stays }: Props) {
  const { lang, requireAuth, showToast } = useAppState();
  const { nav, back } = useAppNav();
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isPending, startTransition] = useTransition();

  const weatherAvailable = s.conditions?.weather === "available";
  const WeatherIcon = Icon[s.weather.icon] ?? Icon.sun;
  const airAvailable = s.conditions?.air === "available";
  const uvLabel = !s.uv
    ? "확인 중"
    : s.uv.index >= 11
      ? "위험"
      : s.uv.index >= 8
        ? "매우 높음"
        : s.uv.index >= 6
          ? "높음"
          : s.uv.index >= 3
            ? "보통"
            : "낮음";
  const fitAvailable = weatherAvailable && airAvailable;
  const openCourse = () =>
    s.themeIds?.[0] ? nav("course", { themeId: s.themeIds[0] }) : nav("discover");

  const suitabilityLabel = !fitAvailable
    ? "방문 여건 확인 중"
    : s.suitability >= 80
      ? lang === "ko"
        ? "매우 적합"
        : "Excellent"
      : s.suitability >= 65
        ? lang === "ko"
          ? "적합"
          : "Good"
        : lang === "ko"
          ? "방문 전 확인이 필요해요"
          : "Reconsider";
  const congVar =
    s.congestion === "calm" ? "calm" : s.congestion === "moderate" ? "moderate" : "busy";

  const markVisited = () => {
    requireAuth("review", () => {
      startTransition(async () => {
        const res = await createVisitAction({ spotId: s.id, congestionThen: s.congestion });
        showToast(res.ok ? "방문 기록에 남겼어요" : res.error);
      });
    });
  };

  const submitReview = () => {
    requireAuth("review", () => {
      startTransition(async () => {
        const res = await createReviewAction({ spotId: s.id, rating, text: reviewText });
        if (res.ok) setReviewText("");
        showToast(res.ok ? "리뷰를 저장했어요" : res.error);
      });
    });
  };

  return (
    <div className="screen-enter spot-page">
      <div className="spot-hero" style={{ position: "relative" }}>
        <Placeholder label={localized(s.name, lang)} src={s.imageUrl} h={260} overlay priority />
        {s.imageUrl?.includes("visitkorea.or.kr") && (
          // TourAPI(firstimage) 사진은 공공누리 출처표시 조건 — 캡션으로 고지(§7.1).
          <div
            style={{
              position: "absolute",
              right: 10,
              bottom: 8,
              fontSize: 9.5,
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {lang === "ko" ? "사진 제공: 한국관광공사" : "Photo: Korea Tourism Organization"}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            right: 14,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <button className="icon-btn filled" onClick={back} aria-label="뒤로가기">
            <Icon.back />
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="icon-btn filled"
              aria-label="장소 공유"
              onClick={() => void shareCurrentPage(s.name.ko, showToast)}
            >
              <Icon.share />
            </button>
            <button
              className="icon-btn filled"
              onClick={openCourse}
              aria-label={lang === "ko" ? "테마 코스 보기" : "View theme course"}
            >
              <Icon.plus />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 20px 12px" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 6,
            flexWrap: "wrap",
            rowGap: 4,
          }}
        >
          <span className="tag" style={{ whiteSpace: "nowrap" }}>
            {localized(s.type, lang)}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
            {localized(s.region, lang)}
          </span>
        </div>
        <Link
          className="btn btn-secondary btn-sm spot-customize"
          href={`/my-courses/add?spot=${encodeURIComponent(s.id)}`}
        >
          <Icon.plus /> 내 코스에 담기
        </Link>
        <h1 style={{ fontSize: 34, margin: "0 0 12px", lineHeight: 1.1 }}>
          {localized(s.name, lang)}
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: "var(--ink-2)",
          }}
        >
          <span>
            <Icon.star style={{ color: "var(--accent)", verticalAlign: "-2px" }} />{" "}
            {s.reviewCount > 0 ? s.rating : "첫 리뷰를 남겨주세요"}{" "}
            <span style={{ color: "var(--ink-3)" }}>({s.reviewCount.toLocaleString()})</span>
          </span>
          {s.durationText && (
            <>
              <span style={{ color: "var(--line-2)" }}>·</span>
              <span>
                <Icon.clock style={{ verticalAlign: "-3px" }} /> {localized(s.durationText, lang)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 혼잡도 + 방문 적합성 */}
      <div className="spot-conditions" style={{ padding: "6px 20px 0" }}>
        <div className="card" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <div className="section-label" style={{ marginBottom: 2 }}>
                {lang === "ko" ? "현재 방문 여건" : "Right now"}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>
                {suitabilityLabel}
              </div>
            </div>
            <Signal level={s.congestion} lang={lang} />
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--ink-3)",
                marginBottom: 4,
              }}
            >
              <span>{lang === "ko" ? "방문 적합성" : "Suitability"}</span>
              <span style={{ fontFamily: "SF Mono, monospace", color: "var(--ink-2)" }}>
                {fitAvailable ? `${s.suitability}/100` : "확인 중"}
              </span>
            </div>
            <div
              style={{ height: 6, background: "var(--bg)", borderRadius: 100, overflow: "hidden" }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${fitAvailable ? s.suitability : 0}%`,
                  background: `linear-gradient(90deg, var(--${congVar}), color-mix(in oklab, var(--${congVar}) 80%, #000))`,
                  borderRadius: 100,
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                marginBottom: 6,
                letterSpacing: "0.06em",
              }}
            >
              {lang === "ko" ? "시간대별 혼잡 · 자체 추정" : "By hour"}
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 48 }}>
              {(s.crowdHourly ?? []).map(({ hour, index: v }) => {
                const lvl = v >= 67 ? "busy" : v >= 34 ? "moderate" : "calm";
                const isNow =
                  hour ===
                  Number(
                    new Intl.DateTimeFormat("en", {
                      timeZone: "Asia/Seoul",
                      hour: "numeric",
                      hourCycle: "h23",
                    }).format(new Date()),
                  );
                return (
                  <div
                    key={hour}
                    title={`${hour}시 예상 혼잡 ${v}/100`}
                    aria-label={`${hour}시 예상 혼잡 ${v}/100`}
                    style={{
                      flex: 1,
                      height: `${v}%`,
                      background: `var(--${lvl})`,
                      opacity: isNow ? 1 : 0.65,
                      borderRadius: 3,
                      outline: isNow ? "1.5px solid var(--ink)" : "none",
                      outlineOffset: 1,
                      minHeight: 4,
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 9,
                fontFamily: "SF Mono, monospace",
                color: "var(--ink-4)",
                marginTop: 4,
              }}
            >
              <span>8시</span>
              <span>10시</span>
              <span>12시</span>
              <span>14시</span>
              <span>16시</span>
              <span>20시</span>
            </div>
          </div>

          {s.crowdTip && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 10,
                padding: "8px 10px",
                background: "var(--bg)",
                borderRadius: 8,
                fontSize: 11.5,
                color: "var(--ink-2)",
                lineHeight: 1.4,
              }}
            >
              <Icon.clock />
              <span>{localized(s.crowdTip, lang)}</span>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid var(--line)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ink-3)",
                  marginBottom: 2,
                  letterSpacing: "0.04em",
                }}
              >
                {lang === "ko" ? "날씨" : "Weather"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink-2)" }}>
                <WeatherIcon />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {weatherAvailable ? `${s.weather.tempC}°C` : "확인 중"}
                </span>
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--ink-3)",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {weatherAvailable ? localized(s.weather.desc, lang) : "예보 수신 대기"}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ink-3)",
                  marginBottom: 2,
                  letterSpacing: "0.04em",
                }}
              >
                {lang === "ko" ? "대기질" : "Air"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink-2)" }}>
                <Icon.wind />
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {airAvailable ? localized(s.air, lang) : "확인 중"}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>
                {s.conditions?.airStation ?? (airAvailable ? "강원 평균" : "에어코리아")}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ink-3)",
                  marginBottom: 2,
                  letterSpacing: "0.04em",
                }}
              >
                {lang === "ko" ? "자외선" : "UV index"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink-2)" }}>
                <Icon.sun />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.uv ? `${s.uv.index} · ${uvLabel}` : "확인 중"}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>
                {s.uv ? "기상청 예측" : "예측 수신 대기"}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 10, lineHeight: 1.65 }}>
            {lang === "ko"
              ? "혼잡도는 시간대·요일·계절에 따른 모델 추정치예요. 날씨·자외선은 기상청 예측, 대기질은 에어코리아 측정 기준으로 현장 상황과 다를 수 있어요."
              : "Weather and air data are based on KMA and AirKorea public data and may differ from on-site conditions."}
          </div>
        </div>
        <div className="spot-actions" style={{ padding: "14px 0 0", display: "flex", gap: 10 }}>
          <ExternalLink
            className="btn btn-secondary"
            href={`https://map.kakao.com/link/search/${encodeURIComponent(`${s.name.ko} ${s.region.ko}`)}`}
            lang={lang}
            aria-label={lang === "ko" ? "카카오맵에서 장소 찾기" : "Find this place on KakaoMap"}
          >
            <Icon.map />
          </ExternalLink>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={openCourse}>
            <Icon.plus /> {lang === "ko" ? "테마 코스 보기" : "View theme course"}
          </button>
        </div>
      </div>

      {s.uv && s.uv.index >= 6 && (
        <p className="uv-advice">
          자외선지수가 높아요. 모자와 자외선 차단제를 준비하고 햇볕이 강한 시간에는 그늘에서
          쉬어가세요.
        </p>
      )}

      {s.description && (
        <div style={{ padding: "18px 20px 0" }}>
          <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>
            {localized(s.description, lang)}
          </div>
        </div>
      )}

      <SpotPublicInfo spot={s} />

      <div style={{ padding: "16px 20px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {s.tags.map((tg) => (
          <Chip key={tg.ko}>{localized(tg, lang)}</Chip>
        ))}
      </div>

      <div style={{ padding: "22px 20px 0" }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="visit-actions">
            <div>
              <div className="section-label" style={{ marginBottom: 3 }}>
                {lang === "ko" ? "내 기록" : "My log"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {lang === "ko" ? "다녀온 곳으로 남기기" : "Mark this visit"}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.45 }}>
                {lang === "ko"
                  ? "방문 기록과 리뷰는 내 정보에서 다시 볼 수 있어요."
                  : "Visits and reviews appear in your profile."}
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={markVisited} disabled={isPending}>
              <Icon.pin />
              {lang === "ko" ? "방문 기록" : "Visited"}
            </button>
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <div className="review-heading">
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {lang === "ko" ? "짧은 리뷰" : "Quick review"}
              </div>
              <RatingStars
                value={rating}
                onChange={setRating}
                disabled={isPending}
                size={18}
                buttonSize={44}
              />
            </div>
            <textarea
              aria-label="짧은 리뷰"
              maxLength={2000}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={
                lang === "ko" ? "좋았던 점을 5자 이상 적어주세요" : "Write at least 5 characters"
              }
              rows={3}
              style={{
                marginTop: 10,
                width: "100%",
                resize: "vertical",
                border: "1px solid var(--line)",
                borderRadius: 10,
                background: "var(--bg)",
                color: "var(--ink)",
                padding: "10px 12px",
                fontSize: 13,
                lineHeight: 1.45,
              }}
            />
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: 10, width: "100%" }}
              onClick={submitReview}
              disabled={isPending}
            >
              <Icon.star />
              {lang === "ko" ? "리뷰 저장·갱신" : "Save or update review"}
            </button>
          </div>
        </div>
      </div>

      {alts.length > 0 && (
        <div style={{ padding: "22px 20px 0" }}>
          <div
            className="card"
            style={{
              padding: 0,
              overflow: "hidden",
              border: "1px solid color-mix(in oklab, var(--brand) 18%, var(--line))",
            }}
          >
            <div style={{ padding: "14px 16px", background: "var(--brand-soft)" }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--brand)",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {lang === "ko" ? "비슷한 분위기, 덜 붐빔" : "Same vibe, less busy"}
              </div>
              <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.5 }}>
                {lang === "ko"
                  ? "같은 테마를 유지하면서도 쾌적하게 즐길 수 있는 대체지를 제안해요."
                  : "Alternatives with the same theme and feel."}
              </div>
            </div>
            <button
              onClick={() => nav("alternative", { spotId: s.id })}
              style={{
                width: "100%",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--surface)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--brand)",
              }}
            >
              <span>
                <Icon.refresh />{" "}
                {lang === "ko" ? `대체지 ${alts.length}곳 보기` : `See ${alts.length} alternatives`}
              </span>
              <Icon.chevR />
            </button>
          </div>
        </div>
      )}

      <div className="spot-nearby" style={{ padding: "24px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "근처" : "Nearby"}</div>
        <h2 className="section-title">{lang === "ko" ? "음식점 · 숙박" : "Eats & stays"}</h2>
      </div>
      {eats.length === 0 && stays.length === 0 && (
        <p className="page-section empty-message">이 지역의 음식점·숙박 정보를 준비하고 있어요.</p>
      )}
      <div className="hscroll spot-nearby">
        {eats.map((e) => (
          <NearbyPlaceCard
            key={e.id}
            imageLabel="eats"
            imageUrl={e.imageUrl}
            address={e.address}
            title={localized(e.name, lang)}
            category={localized(e.type, lang)}
            meta={[e.price, e.rating > 0 ? `★${e.rating}` : ""].filter(Boolean).join(" · ")}
            tone="accent"
            icon="utensils"
          />
        ))}
        {stays.map((st) => (
          <NearbyPlaceCard
            key={st.id}
            imageLabel="stays"
            imageUrl={st.imageUrl}
            address={st.address}
            title={localized(st.name, lang)}
            category={localized(st.type, lang)}
            meta={localized(st.price, lang)}
            tone="brand"
            icon="bed"
          />
        ))}
      </div>
    </div>
  );
}
