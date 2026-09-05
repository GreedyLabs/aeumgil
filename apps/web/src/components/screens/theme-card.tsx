"use client";

import Link from "next/link";
import type { Theme } from "@/domain/types";
import { localized, type Lang } from "@/lib/i18n";
import { UI, Icon } from "./_ui";

/** 홈·탐색·저장·추천에서 동일한 정보와 사진을 보여주는 테마 카드. */
export function ThemeCard({ theme, lang, query }: { theme: Theme; lang: Lang; query?: string }) {
  return (
    <Link
      className="card theme-card"
      href={`/theme/${encodeURIComponent(theme.id)}${query ? `?q=${encodeURIComponent(query)}` : ""}`}
    >
      <UI.ThemeHueBg
        hue={theme.hue}
        h={190}
        src={theme.imageUrl}
        label={theme.imageLabel && localized(theme.imageLabel, lang)}
      >
        <span className="theme-category">{localized(theme.tag, lang)}</span>
        <div className="theme-card-title">
          <span>{localized(theme.region, lang)}</span>
          <h3>{localized(theme.title, lang)}</h3>
        </div>
      </UI.ThemeHueBg>
      <div className="theme-card-details">
        <p>{localized(theme.subtitle, lang)}</p>
        <div className="theme-card-meta">
          <span>
            <Icon.clock />
            {localized(theme.duration, lang)}
          </span>
          <span>
            <Icon.pin />
            {theme.spotCount}개 장소
          </span>
          <Icon.chevR />
        </div>
      </div>
    </Link>
  );
}
