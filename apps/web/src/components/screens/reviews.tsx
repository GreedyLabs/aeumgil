"use client";

// ReviewsView — Phase 4(부분). 내 리뷰 + 방문 기록. 데이터는 서버에서 주입.
import { useState } from "react";
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { ReviewCard, type ReviewWithSpot } from "./profile";
import { UI, Icon } from "./_ui";
import type { Spot, Visit } from "@/domain/types";

const { Signal } = UI;

export interface VisitWithSpot {
  visit: Visit;
  spot: Spot;
}

interface Props {
  reviews: ReviewWithSpot[];
  visits: VisitWithSpot[];
  initialTab?: string;
}

export function ReviewsView({ reviews, visits, initialTab }: Props) {
  const { lang } = useAppState();
  const { nav, back } = useAppNav();
  const [tab, setTab] = useState<"reviews" | "visits">(initialTab === "visits" ? "visits" : "reviews");

  return (
    <div className="screen-enter">
      <div className="topbar elev">
        <button className="icon-btn" onClick={back}>
          <Icon.back />
        </button>
        <h1>{lang === "ko" ? "리뷰 · 방문 기록" : "Reviews & visits"}</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="seg-tabs">
        <button className={"seg" + (tab === "reviews" ? " on" : "")} onClick={() => setTab("reviews")}>
          {lang === "ko" ? "리뷰" : "Reviews"} <span className="seg-n">{reviews.length}</span>
        </button>
        <button className={"seg" + (tab === "visits" ? " on" : "")} onClick={() => setTab("visits")}>
          {lang === "ko" ? "방문 기록" : "Visits"} <span className="seg-n">{visits.length}</span>
        </button>
      </div>

      {tab === "reviews" ? (
        <div className="desk-2" style={{ padding: "16px 20px 28px", display: "grid", gap: 10 }}>
          {reviews.map(({ review, spot }) => (
            <ReviewCard key={review.id} review={review} spot={spot} lang={lang} onNavSpot={(id) => nav("spot", { spotId: id })} />
          ))}
        </div>
      ) : (
        <div style={{ padding: "18px 20px 28px" }}>
          <div className="timeline">
            {visits.map(({ visit: v, spot: s }, i) => (
              <button key={i} className="tl-row" onClick={() => nav("spot", { spotId: s.id })}>
                <span className="tl-rail">
                  <span className="tl-dot" />
                </span>
                <div className="tl-body">
                  <div style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "SF Mono, monospace" }}>{v.date}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, marginTop: 2 }}>{localized(s.name, lang)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{localized(s.region, lang)}</span>
                    <span style={{ color: "var(--line-2)" }}>·</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{lang === "ko" ? "당시" : "then"}</span>
                    <Signal level={v.congestionThen} lang={lang} />
                  </div>
                </div>
                <Icon.chevR style={{ color: "var(--ink-4)", alignSelf: "center", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
