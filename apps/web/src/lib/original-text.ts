import type { LocalizedText } from "./i18n";

/** 사용자 작성 값은 UI 사전과 분리한다. 언어 변경으로 이름·소개·리뷰를 바꾸지 않는다. */
export function originalText(text: LocalizedText): string {
  return text.ko || text.en;
}
