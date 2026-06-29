// ─────────────────────────────────────────────
// Auth.js (NextAuth v5) 설정 — 서버 전용.
//
// Keycloak 전환 후 앱은 "OIDC Client" 역할만 한다.
// - 사용자 원장, 소셜 로그인 브로커링(Kakao/Naver/Google), 세션/계정 관리는 Keycloak 책임.
// - 에움길 DB 에는 Auth.js adapter 테이블을 만들지 않고, 서비스 데이터(saved/review/visit)만
//   Keycloak `sub`(subject, 전역 사용자 id)에 연결한다.
//
// [학습 메모] OAuth2/OIDC 에서 앱(에움길)은 Client, Keycloak 은 Identity Provider(IdP)다.
// 로그인 성공 후 앱은 Keycloak 이 발급한 토큰의 `sub` 클레임을 사용자 id 로 신뢰한다.
// 여러 서비스를 운영할 때 각 서비스 DB 는 같은 `sub` 로 자기 도메인 데이터만 저장하면 된다.
// ─────────────────────────────────────────────

import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import type { JWT } from "next-auth/jwt";
import { env } from "@/lib/env";

const KEYCLOAK_ISSUER = env.AUTH_KEYCLOAK_ISSUER || "http://localhost:8080/realms/eumgil";
const KEYCLOAK_CLIENT_ID = env.AUTH_KEYCLOAK_ID || "eumgil-web";
const KEYCLOAK_CLIENT_SECRET = env.AUTH_KEYCLOAK_SECRET || "eumgil-local-dev-secret";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const TOKEN_REFRESH_MARGIN_SECONDS = 60;

interface KeycloakProfile {
  sub?: string | null;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
  realm_access?: { roles?: unknown };
  resource_access?: Record<string, { roles?: unknown } | undefined>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function rolesFromProfile(profile: unknown): string[] {
  const p = profile as KeycloakProfile | undefined;
  const roles = new Set<string>();
  for (const r of stringArray(p?.realm_access?.roles)) roles.add(r);
  for (const access of Object.values(p?.resource_access ?? {})) {
    for (const r of stringArray(access?.roles)) roles.add(r);
  }
  return [...roles].sort();
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) return { ...token, error: "RefreshAccessTokenError" };

  try {
    const res = await fetch(`${KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: KEYCLOAK_CLIENT_ID,
        client_secret: KEYCLOAK_CLIENT_SECRET,
        refresh_token: token.refreshToken,
      }),
    });
    const refreshed = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      id_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !refreshed.access_token) {
      throw new Error(refreshed.error_description || refreshed.error || `HTTP ${res.status}`);
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? SESSION_MAX_AGE_SECONDS),
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      idToken: refreshed.id_token ?? token.idToken,
      error: undefined,
    };
  } catch (e) {
    console.error("[auth] Keycloak token refresh failed", e);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export function keycloakEndSessionUrl(idToken?: string): string {
  const url = new URL(`${KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);
  url.searchParams.set("post_logout_redirect_uri", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("client_id", KEYCLOAK_CLIENT_ID);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  return url.toString();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // 로컬 학습/데모 환경에서 AUTH_SECRET 없이도 설정 확인이 가능하게 한다.
  // 운영에서는 반드시 .env 의 AUTH_SECRET 을 별도 난수로 지정한다.
  secret: env.AUTH_SECRET || "eumgil-dev-only-auth-secret-change-before-production",
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  // 로컬/비-Vercel 환경에서 호스트 신뢰(개발 편의). 프로덕션은 AUTH_URL 로 고정.
  trustHost: true,
  providers: [
    Keycloak({
      // 로컬 Keycloak 을 나중에 바로 띄워 붙일 수 있게 개발 기본값을 둔다.
      // 실제 검증 시에는 .env 의 AUTH_KEYCLOAK_* 값이 우선된다.
      clientId: KEYCLOAK_CLIENT_ID,
      clientSecret: KEYCLOAK_CLIENT_SECRET,
      issuer: KEYCLOAK_ISSUER,
    }),
  ],
  callbacks: {
    // 로그인 직후 Keycloak token/profile 에서 앱에 필요한 claim 을 Auth.js 내부 JWT 로 정규화한다.
    // access/id/refresh token 은 서버 쿠키(JWE) 안에만 보관하고, client session 으로는 내보내지 않는다.
    async jwt({ token, account, profile }) {
      if (account) {
        token.sub = profile?.sub ?? token.sub;
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpiresAt = account.expires_at;
        token.roles = rolesFromProfile(profile);
      }
      const expiresAt = typeof token.accessTokenExpiresAt === "number" ? token.accessTokenExpiresAt : 0;
      if (expiresAt > Math.floor(Date.now() / 1000) + TOKEN_REFRESH_MARGIN_SECONDS) return token;
      if (token.refreshToken) return refreshAccessToken(token);
      return token;
    },
    // 브라우저가 읽는 세션에는 식별자와 표시 정보, 권한만 둔다. 민감한 provider token 은 제외한다.
    session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        session.user.roles = stringArray(token.roles);
      }
      session.authError = typeof token.error === "string" ? token.error : undefined;
      return session;
    },
  },
});
