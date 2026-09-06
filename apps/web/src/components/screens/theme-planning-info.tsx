"use client";
import { useUiText } from "@/components/use-ui-text";
import { ExternalLink } from "@/components/external-link";
import { localized, type Lang } from "@/lib/i18n";
import type { Theme } from "@/domain/types";

export function ThemePlanningInfo({ theme, lang }: { theme: Theme; lang: Lang }) {
  const translateUi = useUiText();
  if (!theme.planningNote && !theme.sources?.length) return null;
  return (
    <section className="card theme-planning-info" aria-label={translateUi("코스 구성 안내")}>
      <h2>{translateUi("코스를 떠나기 전에")}</h2>
      {theme.planningNote && <p>{translateUi(localized(theme.planningNote, lang))}</p>}
      {!!theme.sources?.length && (
        <details>
          <summary>{translateUi("코스를 구성할 때 참고한 여행 정보")}</summary>
          <p>{translateUi("공식 관광 자료의 장소를 참고해 에움길이 일정을 재구성했어요.")}</p>
          <ul>
            {theme.sources.map((source) => (
              <li key={source.url}>
                <ExternalLink href={source.url}>{translateUi(source.title)}</ExternalLink>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
