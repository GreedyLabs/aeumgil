"use client";
import { useUiText } from "@/components/use-ui-text";
import { ExternalLink, ExternalLinkIndicator } from "@/components/external-link";

import { Icon, UI } from "./_ui";

interface NearbyPlaceCardProps {
  imageLabel: string;
  imageUrl?: string;
  address?: string;
  title: string;
  category: string;
  meta: string;
  tone: "accent" | "brand";
  icon: "utensils" | "bed";
}

export function NearbyPlaceCard({
  imageUrl,
  address,
  title,
  category,
  meta,
  tone,
  icon,
}: NearbyPlaceCardProps) {
  const translateUi = useUiText();
  const PlaceIcon = icon === "utensils" ? Icon.utensils : Icon.bed;
  return (
    <ExternalLink
      className="card commerce-card"
      href={`https://map.kakao.com/link/search/${encodeURIComponent(`${title} ${address ?? "강원"}`)}`}
      indicatorPlacement="within"
      aria-label={translateUi(`${title} 카카오맵에서 지도·영업정보 확인`)}
    >
      <UI.Placeholder label={translateUi(title)} src={imageUrl} h={150} />
      <div className="commerce-body">
        <span className={`commerce-category ${tone}`}>
          <PlaceIcon />
          {translateUi(category)}
        </span>
        <h3>{translateUi(title)}</h3>
        {address && <p>{translateUi(address)}</p>}
        {meta && <p>{translateUi(meta)}</p>}
        <span className="text-link">
          {translateUi("카카오맵 · 영업정보 ")}
          <ExternalLinkIndicator />
        </span>
      </div>
    </ExternalLink>
  );
}
