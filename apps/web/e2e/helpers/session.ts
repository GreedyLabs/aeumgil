// ─────────────────────────────────────────────
// 로그인 세션 픽스처 — Keycloak 없이 Auth.js 세션 쿠키를 직접 만든다.
//
// 앱 세션은 JWT 전략(JWE 쿠키)이라, 서버와 같은 AUTH_SECRET + salt(쿠키명)로
// next-auth/jwt.encode() 를 호출하면 auth() 가 그대로 신뢰하는 쿠키가 나온다.
// refreshToken 을 넣지 않고 accessTokenExpiresAt 을 미래로 두어
// jwt 콜백의 Keycloak 리프레시 경로를 우회한다(server/auth.ts:139-142).
//
// [트레이드오프] 실제 Keycloak 왕복(브로커 로그인 UI)은 검증하지 못한다 —
// 그 경로는 운영-준비-플랜 §1.2/§8.2 수동 스모크가 담당하고,
// E2E 는 "로그인된 사용자의 쓰기 경로"만 얇게 검증한다.
// ─────────────────────────────────────────────

import { encode } from "next-auth/jwt";

/** 앱 DB user_id(=sub)로 쓰는 E2E 전용 사용자. global-setup 이 매 실행 전 데이터를 지운다. */
export const TEST_USER = {
  id: "e2e-playwright",
  name: "E2E 테스터",
  email: "e2e@playwright.local",
} as const;

const COOKIE_NAME = "authjs.session-token"; // http(localhost) — __Secure- 접두 없음

export async function sessionCookie() {
  const secret = process.env.AUTH_SECRET || "eumgil-dev-only-auth-secret-change-before-production";
  const value = await encode({
    salt: COOKIE_NAME,
    secret,
    maxAge: 60 * 60,
    token: {
      sub: TEST_USER.id,
      name: TEST_USER.name,
      email: TEST_USER.email,
      roles: [],
      // 미래 만료 → jwt 콜백이 리프레시를 시도하지 않고 토큰을 그대로 반환
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
    },
  });
  return {
    name: COOKIE_NAME,
    value,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
  };
}
