"use client";

import { Icon, UI } from "./_ui";

const { Placeholder } = UI;

type NearbyPlaceTone = "accent" | "brand";

interface NearbyPlaceCardProps {
  imageLabel: string;
  title: string;
  category: string;
  meta: string;
  tone: NearbyPlaceTone;
  icon: "utensils" | "bed";
}

export function NearbyPlaceCard({ imageLabel, title, category, meta, tone, icon }: NearbyPlaceCardProps) {
  const PlaceIcon = icon === "utensils" ? Icon.utensils : Icon.bed;

  return (
    <div className="card" style={{ width: 170, padding: 0 }}>
      <Placeholder label={imageLabel} h={80} />
      <div style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: `var(--${tone})`, fontWeight: 600 }}>
          <PlaceIcon />
          {category}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, lineHeight: 1.25 }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{meta}</div>
      </div>
    </div>
  );
}
