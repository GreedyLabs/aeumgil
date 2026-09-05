"use client";

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
  const PlaceIcon = icon === "utensils" ? Icon.utensils : Icon.bed;
  return (
    <a
      className="card commerce-card"
      href={`https://map.kakao.com/link/search/${encodeURIComponent(`${title} ${address ?? "강원"}`)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${title} 지도에서 보기 (새 탭)`}
    >
      <UI.Placeholder label={title} src={imageUrl} h={150} />
      <div className="commerce-body">
        <span className={`commerce-category ${tone}`}>
          <PlaceIcon />
          {category}
        </span>
        <h3>{title}</h3>
        {address && <p>{address}</p>}
        {meta && <p>{meta}</p>}
        <span className="text-link">
          지도·영업정보 확인 <Icon.chevR />
        </span>
      </div>
    </a>
  );
}
