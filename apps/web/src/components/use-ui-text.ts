"use client";

import { useLanguage } from "./language-context";
import { uiText } from "@/lib/i18n";

/** 메시지만 번역한다. 숫자·React 요소·이벤트·폼의 저장 값은 그대로 보존한다. */
export function useUiText() {
  const lang = useLanguage();
  return <T>(value: T): T => (typeof value === "string" ? uiText(value, lang) : value) as T;
}
