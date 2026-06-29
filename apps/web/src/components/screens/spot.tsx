"use client";

// SpotView — Phase 1b. 관광지 상세(혼잡도·방문 적합성·대체지 CTA).
// 방문 적합성/시간대별 혼잡은 Phase 3 에서 실데이터로 대체될 지점.
import { useState, useTransition } from "react";
import { createReviewAction, createVisitAction } from "@/app/actions/reviews";
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { Eat, Spot, Stay } from "@/domain/types";

const { TopBar: _TopBar, Signal, Chip, Placeholder } = UI;

interface Props {
  spot: Spot;
  alts: Spot[];
  eats: Eat[];
  stays: Stay[];
}

// 시간대별 혼잡 막대 (Phase 3: 실데이터 대체)
const HOURLY = [22, 28, 38, 55, 68, 82, 95, 78, 62, 48, 40, 32];

export function SpotView({ spot: s, alts, eats, stays }: Props) {
  const { lang, addToCourse, requireAuth, showToast } = useAppState();
  const { nav, back } = useAppNav();
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isPending, startTransition] = useTransition();

  const suitabilityLabel =
    s.suitability >= 80
      ? lang === "ko"
        ? "매우 적합"
        : "Excellent"
      : s.suitability >= 65
        ? lang === "ko"
          ? "적합"
          : "Good"
        : lang === "ko"
          ? "재고 권장"
          : "Reconsider";
  const congVar = s.congestion === "calm" ? "calm" : s.congestion === "moderate" ? "moderate" : "busy";

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
    <div className="screen-enter">
      <div style={{ position: "relative" }}>
        <Placeholder label={localized(s.name, lang)} id={s.id} h={260} overlay />
        <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", justifyContent: "space-between" }}>
          <button className="icon-btn filled" onClick={back}>
            <Icon.back />
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="icon-btn filled">
              <Icon.share />
            </button>
            <button className="icon-btn filled" onClick={() => addToCourse()} aria-label={lang === "ko" ? "내 코스에 추가" : "Add to course"}>
              <Icon.plus />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 20px 12px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap", rowGap: 4 }}>
          <span className="tag" style={{ whiteSpace: "nowrap" }}>
            {localized(s.type, lang)}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{localized(s.region, lang)}</span>
        </div>
        <h1 className="serif" style={{ fontSize: 30, margin: "0 0 6px", lineHeight: 1.1 }}>
          {localized(s.name, lang)}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink-2)" }}>
          <span>
            <Icon.star style={{ color: "var(--accent)", verticalAlign: "-2px" }} /> {s.rating}{" "}
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
      <div style={{ padding: "6px 20px 0" }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div className="section-label" style={{ marginBottom: 2 }}>
                {lang === "ko" ? "지금 이 시각" : "Right now"}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{suitabilityLabel}</div>
            </div>
            <Signal level={s.congestion} lang={lang} />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginBottom: 4 }}>
              <span>{lang === "ko" ? "방문 적합성" : "Suitability"}</span>
              <span style={{ fontFamily: "SF Mono, monospace", color: "var(--ink-2)" }}>{s.suitability}/100</span>
            </div>
            <div style={{ height: 6, background: "var(--bg)", borderRadius: 100, overflow: "hidden" }}>
              <div
                style={{ height: "100%", width: `${s.suitability}%`, background: `linear-gradient(90deg, var(--${congVar}), color-mix(in oklab, var(--${congVar}) 80%, #000))`, borderRadius: 100 }}
              />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6, letterSpacing: "0.06em" }}>
              {lang === "ko" ? "시간대별 혼잡" : "By hour"}
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 48 }}>
              {HOURLY.map((v, i) => {
                const lvl = v > 75 ? "busy" : v > 50 ? "moderate" : "calm";
                const isNow = i === 6;
                return (
                  <div
                    key={i}
                    style={{ flex: 1, height: `${v}%`, background: `var(--${lvl})`, opacity: isNow ? 1 : 0.65, borderRadius: 3, outline: isNow ? "1.5px solid var(--ink)" : "none", outlineOffset: 1, minHeight: 4 }}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontFamily: "SF Mono, monospace", color: "var(--ink-4)", marginTop: 4 }}>
              <span>9</span>
              <span>11</span>
              <span>13</span>
              <span>15</span>
              <span>17</span>
              <span>19</span>
            </div>
          </div>

          {s.crowdTip && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 10px", background: "var(--bg)", borderRadius: 8, fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.4 }}>
              <Icon.clock />
              <span>{localized(s.crowdTip, lang)}</span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 2, letterSpacing: "0.04em" }}>{lang === "ko" ? "날씨" : "Weather"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink-2)" }}>
                <Icon.sun />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{s.weather.tempC}°C</span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {localized(s.weather.desc, lang)}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 2, letterSpacing: "0.04em" }}>{lang === "ko" ? "대기질" : "Air"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink-2)" }}>
                <Icon.wind />
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{localized(s.air, lang)}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>PM 18</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 2, letterSpacing: "0.04em" }}>{lang === "ko" ? "교통" : "Traffic"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink-2)" }}>
                <Icon.car />
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.traffic ? localized(s.traffic, lang) : "-"}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>{lang === "ko" ? "인근 도로" : "Roads"}</div>
            </div>
          </div>
        </div>
      </div>

      {s.description && (
        <div style={{ padding: "18px 20px 0" }}>
          <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>{localized(s.description, lang)}</div>
        </div>
      )}

      <div style={{ padding: "16px 20px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {s.tags.map((tg) => (
          <Chip key={tg.ko}>{localized(tg, lang)}</Chip>
        ))}
      </div>

      <div style={{ padding: "22px 20px 0" }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <div className="section-label" style={{ marginBottom: 3 }}>
                {lang === "ko" ? "내 기록" : "My log"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{lang === "ko" ? "다녀온 곳으로 남기기" : "Mark this visit"}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.45 }}>
                {lang === "ko" ? "방문 기록과 리뷰는 내 정보에서 다시 볼 수 있어요." : "Visits and reviews appear in your profile."}
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={markVisited} disabled={isPending}>
              <Icon.pin />
              {lang === "ko" ? "방문 기록" : "Visited"}
            </button>
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{lang === "ko" ? "짧은 리뷰" : "Quick review"}</div>
              <div style={{ display: "flex", gap: 2 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className="icon-btn" style={{ width: 28, height: 28, color: n <= rating ? "var(--accent)" : "var(--ink-4)" }} onClick={() => setRating(n)} aria-label={`${n}점`}>
                    <Icon.star />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={lang === "ko" ? "좋았던 점을 5자 이상 적어주세요" : "Write at least 5 characters"}
              rows={3}
              style={{ marginTop: 10, width: "100%", resize: "vertical", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg)", color: "var(--ink)", padding: "10px 12px", fontSize: 13, lineHeight: 1.45 }}
            />
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10, width: "100%" }} onClick={submitReview} disabled={isPending}>
              <Icon.star />
              {lang === "ko" ? "리뷰 저장·갱신" : "Save or update review"}
            </button>
          </div>
        </div>
      </div>

      {alts.length > 0 && (
        <div style={{ padding: "22px 20px 0" }}>
          <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid color-mix(in oklab, var(--brand) 18%, var(--line))" }}>
            <div style={{ padding: "14px 16px", background: "var(--brand-soft)" }}>
              <div style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
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
              style={{ width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", fontSize: 14, fontWeight: 600, color: "var(--brand)" }}
            >
              <span>
                <Icon.refresh /> {lang === "ko" ? `대체지 ${alts.length}곳 보기` : `See ${alts.length} alternatives`}
              </span>
              <Icon.chevR />
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "24px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "근처" : "Nearby"}</div>
        <h2 className="section-title">{lang === "ko" ? "음식점 · 숙박" : "Eats & stays"}</h2>
      </div>
      <div className="hscroll">
        {eats.map((e) => (
          <div key={e.id} className="card" style={{ width: 170, padding: 0 }}>
            <Placeholder label="eats" id={e.id} h={80} />
            <div style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                <Icon.utensils />
                {localized(e.type, lang)}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, lineHeight: 1.25 }}>{localized(e.name, lang)}</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                {e.price} · ★{e.rating}
              </div>
            </div>
          </div>
        ))}
        {stays.map((st) => (
          <div key={st.id} className="card" style={{ width: 170, padding: 0 }}>
            <Placeholder label="stays" id={st.id} h={80} />
            <div style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--brand)", fontWeight: 600 }}>
                <Icon.bed />
                {localized(st.type, lang)}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, lineHeight: 1.25 }}>{localized(st.name, lang)}</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{localized(st.price, lang)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 20px 24px", display: "flex", gap: 10 }}>
        <button className="btn btn-secondary">
          <Icon.map />
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => addToCourse()}>
          <Icon.plus /> {lang === "ko" ? "내 코스에 추가" : "Add to course"}
        </button>
      </div>
    </div>
  );
}
