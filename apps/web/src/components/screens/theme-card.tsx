"use client";
import { placeCount } from "@/lib/display-formats";
import { useUiText } from "@/components/use-ui-text";
import Link from "next/link";
import type { Theme } from "@/domain/types";
import { localized, type Lang } from "@/lib/i18n";
import { UI, Icon } from "./_ui";

/** 홈·탐색·저장·추천에서 동일한 정보와 사진을 보여주는 테마 카드. */
export function ThemeCard({ theme, lang, query }: { theme: Theme; lang: Lang; query?: string }) {
  const translateUi = useUiText();
  return (
    <Link
      className="card theme-card"
      href={`/theme/${encodeURIComponent(theme.id)}${query ? `?q=${encodeURIComponent(query)}` : ""}`}
    >
      <UI.ThemeHueBg
        hue={theme.hue}
        h={190}
        src={theme.imageUrl}
        label={translateUi(theme.imageLabel && localized(theme.imageLabel, lang))}
      >
        <span className="theme-category">{translateUi(localized(theme.tag, lang))}</span>
        <div className="theme-card-title">
          <span>{translateUi(localized(theme.region, lang))}</span>
          <h3>{translateUi(localized(theme.title, lang))}</h3>
        </div>
      </UI.ThemeHueBg>
      <div className="theme-card-details">
        <p>{translateUi(localized(theme.subtitle, lang))}</p>
        <div className="theme-card-meta">
          <span>
            <Icon.clock />
            {translateUi(localized(theme.duration, lang))}
          </span>
          <span>
            <Icon.pin />
            {placeCount(theme.spotCount, lang)}
          </span>
          <Icon.chevR />
        </div>
      </div>
    </Link>
  );
}
