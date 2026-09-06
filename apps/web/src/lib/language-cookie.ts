import { isLang, LANGUAGE_COOKIE, type Lang } from "./i18n";

/** 다른 탭에서 바꾼 유효한 언어만 반영한다. 쿠키 누락·손상은 현재 언어를 초기화하지 않는다. */
export function languageFromCookie(header: string): Lang | undefined {
  const prefix = `${LANGUAGE_COOKIE}=`;
  const cookie = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!cookie) return undefined;
  try {
    const value = decodeURIComponent(cookie.slice(prefix.length));
    return isLang(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
