/** 로그인 후 복귀는 앱의 알려진 화면으로만 허용한다. 외부 URL·인증 경로는 제외. */
export function safeReturnTo(value?: string): string {
  if (
    !value ||
    !/^\/(profile|saved|course|spot|reviews|onboarding|settings|discover|map|my-courses|festival)(\/|\?|$)/.test(
      value,
    ) ||
    value.includes("\\")
  )
    return "/profile";
  const url = new URL(value, "https://eumgil.invalid");
  if (
    url.origin !== "https://eumgil.invalid" ||
    !/^\/(profile|saved|course|spot|reviews|onboarding|settings|discover|map|my-courses|festival)(\/|$)/.test(
      url.pathname,
    )
  )
    return "/profile";
  return `${url.pathname}${url.search}${url.hash}`;
}
