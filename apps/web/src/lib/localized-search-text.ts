import { LANGUAGE_OPTIONS, localized, type LocalizedText } from "./i18n";

/** 표시 언어를 바꿔도 사용자가 입력한 이전 언어 검색어가 계속 일치해야 한다. */
export function localizedSearchText(fields: readonly LocalizedText[]): string {
  return fields
    .flatMap((field) => [
      ...Object.values(field),
      ...LANGUAGE_OPTIONS.map(({ value }) => localized(field, value)),
    ])
    .join(" ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
}
