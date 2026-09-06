"use client";
import { useLanguage } from "@/components/language-context";
import type { Spot } from "@/domain/types";
const notices = {
  en: "Official translations are shown where available. Some visitor information and original content remain in Korean.",
  "zh-CN": "优先显示官方译文。部分参观信息和原始内容仍以韩语提供。",
  "zh-TW": "優先顯示官方譯文。部分參觀資訊與原始內容仍以韓語提供。",
  ja: "公式翻訳がある情報を表示しています。一部の利用案内や原文は韓国語での提供となります。",
  de: "Verfügbare offizielle Übersetzungen werden angezeigt. Einige Besuchshinweise und Originalinhalte sind nur auf Koreanisch verfügbar.",
  fr: "Les traductions officielles disponibles sont affichées. Certaines informations pratiques et certains contenus restent en coréen.",
};
export function TranslationNotice({ translation }: { translation?: Spot["translation"] }) {
  const lang = useLanguage();
  if (lang === "ko") return null;
  return (
    <p className="translation-notice" role="note">
      {notices[lang]}
      {translation?.source && <span> · Korea Tourism Organization</span>}
    </p>
  );
}
