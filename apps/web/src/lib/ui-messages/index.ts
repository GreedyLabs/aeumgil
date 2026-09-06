import type { Lang } from "../i18n";
import en from "./en";
import zhCN from "./zh-CN";
import zhTW from "./zh-TW";
import ja from "./ja";
import de from "./de";
import fr from "./fr";
export const UI_MESSAGES: Record<Exclude<Lang, "ko">, Readonly<Record<string, string>>> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  de,
  fr,
};
