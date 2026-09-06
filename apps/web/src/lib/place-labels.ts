import type { LocalizedText } from "./i18n";

function mergeText(previous: LocalizedText, next: LocalizedText): LocalizedText {
  const provided = Object.fromEntries(
    Object.entries(next).filter(
      ([language, value]) =>
        value &&
        (language === "ko" || value !== next.ko || !previous[language as keyof LocalizedText]),
    ),
  );
  return { ...previous, ...provided };
}

/** 초안의 장소·좌표는 유지하고 새 서버 응답의 표시 언어만 병합한다. */
export function mergePlaceLabels<T extends { name: LocalizedText; region: LocalizedText }>(
  previous: Record<string, T>,
  incoming: Record<string, T>,
): Record<string, T> {
  return {
    ...previous,
    ...Object.fromEntries(
      Object.entries(incoming).map(([id, place]) => {
        const current = previous[id];
        return [
          id,
          current
            ? {
                ...current,
                name: mergeText(current.name, place.name),
                region: mergeText(current.region, place.region),
              }
            : place,
        ];
      }),
    ),
  };
}
