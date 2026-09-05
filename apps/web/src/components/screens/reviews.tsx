"use client";

// ReviewsView — Phase 4(부분). 내 리뷰 + 방문 기록. 데이터는 서버에서 주입.
import { useState, useTransition } from "react";
import { deleteReviewAction, deleteVisitAction, updateReviewAction, updateVisitAction } from "@/app/actions/reviews";
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { RatingStars } from "./rating-stars";
import { ReviewCard, ReviewHelpful, type ReviewWithSpot } from "./review-card";
import { UI, Icon } from "./_ui";
import type { Congestion, Review, Spot, Visit } from "@/domain/types";

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
  const { lang, showToast } = useAppState();
  const { nav, back } = useAppNav();
  const [tab, setTab] = useState<"reviews" | "visits">(initialTab === "visits" ? "visits" : "reviews");
  const [reviewRows, setReviewRows] = useState(reviews);
  const [visitRows, setVisitRows] = useState(visits);
  const [isPending, startTransition] = useTransition();

  const patchReview = (review: Review) => {
    setReviewRows((prev) => prev.map((row) => (row.review.id === review.id ? { ...row, review } : row)));
  };
  const removeReview = (id: string) => {
    setReviewRows((prev) => prev.filter((row) => row.review.id !== id));
  };
  const patchVisit = (visit: Visit) => {
    setVisitRows((prev) => prev.map((row) => (row.visit.id === visit.id ? { ...row, visit } : row)));
  };
  const removeVisit = (id: string) => {
    setVisitRows((prev) => prev.filter((row) => row.visit.id !== id));
  };

  return (
    <div className="screen-enter reading-page">
      <div className="topbar elev">
        <button className="icon-btn" onClick={back} aria-label="뒤로가기">
          <Icon.back />
        </button>
        <h1>{lang === "ko" ? "리뷰 · 방문 기록" : "Reviews & visits"}</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="seg-tabs">
        <button aria-pressed={tab === "reviews"} className={"seg" + (tab === "reviews" ? " on" : "")} onClick={() => setTab("reviews")}>
          {lang === "ko" ? "리뷰" : "Reviews"} <span className="seg-n">{reviewRows.length}</span>
        </button>
        <button aria-pressed={tab === "visits"} className={"seg" + (tab === "visits" ? " on" : "")} onClick={() => setTab("visits")}>
          {lang === "ko" ? "방문 기록" : "Visits"} <span className="seg-n">{visitRows.length}</span>
        </button>
      </div>

      {(tab === "reviews" ? reviewRows : visitRows).length === 0 && <div className="empty-state" style={{margin:"24px 20px"}}><Icon.pin /><h2>{tab === "reviews" ? "아직 남긴 리뷰가 없어요" : "아직 방문 기록이 없어요"}</h2><p>다녀온 장소의 상세 화면에서 첫 기록을 남겨보세요.</p><button className="btn btn-secondary" onClick={() => nav("discover")}>여행 장소 둘러보기</button></div>}
      {tab === "reviews" ? (
        <div className="desk-2" style={{ padding: "16px 20px 28px", display: "grid", gap: 10 }}>
          {reviewRows.map(({ review, spot }) => (
            <EditableReviewCard
              key={review.id}
              review={review}
              spot={spot}
              lang={lang}
              disabled={isPending}
              onNavSpot={(id) => nav("spot", { spotId: id })}
              onSave={(next) => {
                startTransition(async () => {
                  const res = await updateReviewAction({ id: next.id, spotId: next.spotId, rating: next.rating, text: next.text.ko });
                  if (!res.ok) {
                    showToast(res.error);
                    return;
                  }
                  patchReview(next);
                  showToast("리뷰를 수정했어요");
                });
              }}
              onDelete={(target) => {
                startTransition(async () => {
                  const res = await deleteReviewAction({ id: target.id, spotId: target.spotId });
                  if (!res.ok) {
                    showToast(res.error);
                    return;
                  }
                  removeReview(target.id);
                  showToast("리뷰를 삭제했어요");
                });
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ padding: "18px 20px 28px" }}>
          <div className="timeline">
            {visitRows.map(({ visit: v, spot: s }, i) => (
              <EditableVisitRow
                key={v.id ?? `${s.id}-${v.date}-${i}`}
                visit={v}
                spot={s}
                lang={lang}
                disabled={isPending}
                onNavSpot={(id) => nav("spot", { spotId: id })}
                onSave={(next) => {
                  if (!next.id) return;
                  startTransition(async () => {
                    const res = await updateVisitAction({ id: next.id!, spotId: next.spotId, congestionThen: next.congestionThen });
                    if (!res.ok) {
                      showToast(res.error);
                      return;
                    }
                    patchVisit(next);
                    showToast("방문 기록을 수정했어요");
                  });
                }}
                onDelete={(target) => {
                  if (!target.id) return;
                  startTransition(async () => {
                    const res = await deleteVisitAction({ id: target.id!, spotId: target.spotId });
                    if (!res.ok) {
                      showToast(res.error);
                      return;
                    }
                    removeVisit(target.id!);
                    showToast("방문 기록을 삭제했어요");
                  });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EditableReviewCard({
  review,
  spot,
  lang,
  disabled,
  onNavSpot,
  onSave,
  onDelete,
}: {
  review: Review;
  spot: Spot;
  lang: "ko" | "en";
  disabled: boolean;
  onNavSpot: (id: string) => void;
  onSave: (review: Review) => void;
  onDelete: (review: Review) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [text, setText] = useState(review.text.ko);

  const reset = () => {
    setRating(review.rating);
    setText(review.text.ko);
    setEditing(false);
  };

  return (
    <ReviewCard
      review={review}
      spot={spot}
      lang={lang}
      onNavSpot={onNavSpot}
      trailing={
        editing ? (
          <RatingStars value={rating} onChange={setRating} disabled={disabled} size={14} />
        ) : (
          <RatingStars value={review.rating} />
        )
      }
    >
      {editing ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            style={{ marginTop: 10, width: "100%", resize: "vertical", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg)", color: "var(--ink)", padding: "10px 12px", fontSize: 13, lineHeight: 1.45 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={disabled || text.trim().length < 5}
              onClick={() => {
                onSave({ ...review, rating, text: { ko: text.trim(), en: text.trim() } });
                setEditing(false);
              }}
            >
              {lang === "ko" ? "저장" : "Save"}
            </button>
            <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={reset}>
              {lang === "ko" ? "취소" : "Cancel"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, margin: "10px 0 0" }}>{localized(review.text, lang)}</p>
          <ReviewHelpful
            helpful={review.helpful}
            lang={lang}
            actions={
              <span style={{ display: "inline-flex", gap: 6 }}>
                <button className="link-sm" disabled={disabled} onClick={() => setEditing(true)}>
                  {lang === "ko" ? "수정" : "Edit"}
                </button>
                <button className="link-sm" disabled={disabled} onClick={() => { if (window.confirm("이 리뷰를 삭제할까요? 삭제한 리뷰는 복구할 수 없어요.")) onDelete(review); }} style={{ color: "var(--busy)" }}>
                  {lang === "ko" ? "삭제" : "Delete"}
                </button>
              </span>
            }
          />
        </>
      )}
    </ReviewCard>
  );
}

const CONGESTION_LEVELS: Congestion[] = ["calm", "moderate", "busy"];

function EditableVisitRow({
  visit,
  spot,
  lang,
  disabled,
  onNavSpot,
  onSave,
  onDelete,
}: {
  visit: Visit;
  spot: Spot;
  lang: "ko" | "en";
  disabled: boolean;
  onNavSpot: (id: string) => void;
  onSave: (visit: Visit) => void;
  onDelete: (visit: Visit) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [level, setLevel] = useState<Congestion>(visit.congestionThen);

  return (
    <div className="tl-row">
      <span className="tl-rail">
        <span className="tl-dot" />
      </span>
      <div className="tl-body">
        <button onClick={() => onNavSpot(spot.id)} style={{ textAlign: "left", width: "100%" }}>
          <div style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "SF Mono, monospace" }}>{visit.date}</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginTop: 2 }}>{localized(spot.name, lang)}</div>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{localized(spot.region, lang)}</span>
          <span style={{ color: "var(--line-2)" }}>·</span>
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{lang === "ko" ? "당시" : "then"}</span>
          {editing ? (
            CONGESTION_LEVELS.map((lv) => (
              <button key={lv} className={"chip" + (level === lv ? " active" : "")} disabled={disabled} onClick={() => setLevel(lv)} style={{ padding: "8px 10px", minHeight: 44, fontSize: 11 }}>
                <Signal level={lv} lang={lang} />
              </button>
            ))
          ) : (
            <Signal level={visit.congestionThen} lang={lang} />
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
          {editing ? (
            <>
              <button
                className="btn btn-primary btn-sm"
                disabled={disabled || !visit.id}
                onClick={() => {
                  onSave({ ...visit, congestionThen: level });
                  setEditing(false);
                }}
              >
                {lang === "ko" ? "저장" : "Save"}
              </button>
              <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => { setLevel(visit.congestionThen); setEditing(false); }}>
                {lang === "ko" ? "취소" : "Cancel"}
              </button>
            </>
          ) : (
            <>
              <button className="link-sm" disabled={disabled || !visit.id} onClick={() => setEditing(true)}>
                {lang === "ko" ? "수정" : "Edit"}
              </button>
              <button className="link-sm" disabled={disabled || !visit.id} onClick={() => { if (window.confirm("이 방문 기록을 삭제할까요?")) onDelete(visit); }} style={{ color: "var(--busy)" }}>
                {lang === "ko" ? "삭제" : "Delete"}
              </button>
            </>
          )}
        </div>
      </div>
      <Icon.chevR style={{ color: "var(--ink-4)", alignSelf: "center", flexShrink: 0 }} />
    </div>
  );
}
