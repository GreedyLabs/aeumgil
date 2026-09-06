import { cookies } from "next/headers";
import { DEFAULT_LANG, isLang, LANGUAGE_COOKIE, type Lang } from "@/lib/i18n";

/** 공유 Repository에 언어를 저장하지 않고 현재 요청의 쿠키에서만 읽는다. */
export async function requestLanguage(): Promise<Lang> {
  try {
    const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
    return isLang(value) ? value : DEFAULT_LANG;
  } catch {
    // 요청 컨텍스트가 없는 수집·단위 검사에서는 정본 언어를 사용한다.
    return DEFAULT_LANG;
  }
}
