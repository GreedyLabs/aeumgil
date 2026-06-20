// 다국어 처리 방식 (Phase 0 확정)
// - 도메인 모델은 텍스트를 LocalizedText({ ko, en }) 로 보관한다.
// - 화면은 localized(text, lang) 로 현재 언어의 문자열을 꺼낸다.
// - en 값이 없으면 ko 로 폴백한다.

export type Lang = "ko" | "en";

export const DEFAULT_LANG: Lang = "ko";

export interface LocalizedText {
  ko: string;
  en: string;
}

/** LocalizedText 생성 헬퍼. en 미지정 시 ko 로 폴백. */
export function L(ko: string, en?: string): LocalizedText {
  return { ko, en: en ?? ko };
}

/** 현재 언어 문자열을 꺼낸다. */
export function localized(text: LocalizedText, lang: Lang): string {
  return text[lang] || text.ko;
}
