"use client";

import React, { type ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { LanguageContext } from "./language-context";

/** 늦게 도착하는 서버 영역은 요청 언어로 먼저 복원하고 다음 서버 응답에서 함께 갱신한다. */
export function LanguageBoundary({ lang, children }: { lang: Lang; children?: ReactNode }) {
  return <LanguageContext.Provider value={lang}>{children}</LanguageContext.Provider>;
}
