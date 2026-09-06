"use client";
import { originalText } from "@/lib/original-text";
import { useUiText } from "@/components/use-ui-text";
import { localized, type Lang } from "@/lib/i18n";
import type { Review, Spot } from "@/domain/types";
import { UI, Icon } from "./_ui";
import { RatingStars } from "./rating-stars";

const { Placeholder } = UI;

export interface ReviewWithSpot {
  review: Review;
  spot: Spot;
}

interface ReviewCardProps {
  review: Review;
  spot: Spot;
  lang: Lang;
  onNavSpot: (id: string) => void;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}

export function ReviewCard({ review, spot, lang, onNavSpot, trailing, children }: ReviewCardProps) {
  const translateUi = useUiText();
  return (
    <div className="card" style={{ padding: 12 }}>
      <button
        onClick={() => onNavSpot(spot.id)}
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          width: "100%",
          minWidth: 0,
          textAlign: "left",
        }}
      >
        <Placeholder
          label={translateUi(localized(spot.name, lang))}
          src={spot.imageUrl}
          h={44}
          style={{ width: 44, borderRadius: 10, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {translateUi(localized(spot.name, lang))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
            {translateUi(localized(spot.region, lang))} · {review.date}
          </div>
        </div>
        {trailing ?? <RatingStars value={review.rating} />}
      </button>
      {children ?? (
        <>
          <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, margin: "10px 0 0" }}>
            {originalText(review.text)}
          </p>
          <ReviewHelpful helpful={review.helpful} lang={lang} />
        </>
      )}
    </div>
  );
}

export function ReviewHelpful({
  helpful,
  lang,
  actions,
}: {
  helpful: number;
  lang: Lang;
  actions?: React.ReactNode;
}) {
  const translateUi = useUiText();
  return (
    <div
      style={{
        fontSize: 11,
        color: "var(--ink-4)",
        marginTop: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "space-between",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <Icon.heart style={{ width: 13, height: 13 }} />
        {translateUi("도움돼요")} {helpful}
      </span>
      {actions}
    </div>
  );
}
