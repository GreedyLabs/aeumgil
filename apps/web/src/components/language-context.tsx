"use client";
import { createContext, useContext } from "react";
import { DEFAULT_LANG, type Lang } from "@/lib/i18n";
// 공통 UI가 AppShell을 다시 import하는 순환 의존성을 만들지 않는다.
export const LanguageContext = createContext<Lang>(DEFAULT_LANG);
export const useLanguage = () => useContext(LanguageContext);
