import { UI_MESSAGES } from "./ui-messages";
import { screenMessage } from "./screen-messages";
import { discoveryMessage } from "./discovery-messages";
import { detailScreenMessage } from "./detail-screen-messages";
import { planningScreenMessage } from "./planning-screen-messages";
import { themeMessage } from "./theme-messages";
export type Lang = "ko" | "en" | "zh-CN" | "zh-TW" | "ja" | "de" | "fr";
export const DEFAULT_LANG: Lang = "ko";
export const LANGUAGE_COOKIE = "eumgil.lang";
export const LANGUAGE_OPTIONS: readonly { value: Lang; label: string }[] = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "ja", label: "日本語" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
];
export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && LANGUAGE_OPTIONS.some((option) => option.value === value);
}

export interface LocalizedText {
  ko: string;
  en: string;
  "zh-CN"?: string;
  "zh-TW"?: string;
  ja?: string;
  de?: string;
  fr?: string;
}

/** LocalizedText 생성 헬퍼. en 미지정 시 ko 로 폴백. */
export function L(ko: string, en?: string): LocalizedText {
  return { ko, en: en ?? ko };
}

/** 요청 언어가 없으면 영어, 영어도 없으면 한국어 원문을 사용한다. */
export function localized(text: LocalizedText, lang: Lang): string {
  if (text[lang] && (lang === "ko" || text[lang] !== text.ko)) return text[lang]!;
  const label = uiText(text.ko, lang);
  return label !== text.ko ? label : text.en || text.ko;
}

/** 한국어 원문을 키로 사용한다. 사전에 없는 문구는 번역한 것처럼 바꾸지 않는다. */
export function uiText(text: string, lang: Lang): string {
  if (lang === "ko") return text;
  const key = text.trim();
  const common = UI_MESSAGES[lang][key];
  return common
    ? text.replace(key, common)
    : screenMessage(text, lang) ||
        discoveryMessage(text, lang) ||
        detailScreenMessage(text, lang) ||
        planningScreenMessage(text, lang) ||
        themeMessage(text, lang) ||
        text;
}

/** 인증 서버가 아직 요청 언어를 활성화하지 않았다면 영어·한국어로 대체한다. */
export function keycloakUiLocales(lang: Lang): string {
  return [...new Set([lang, "en", "ko"])].join(" ");
}
