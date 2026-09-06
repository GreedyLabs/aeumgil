// ─────────────────────────────────────────────
// Auth.js (NextAuth v5) 설정 — 서버 전용.
//
// Keycloak 전환 후 앱은 "OIDC Client" 역할만 한다.
// - 사용자 원장, Google 로그인 연결, 세션/계정 관리는 Keycloak 책임.
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
import { assertProductionEnv, env, isProductionRuntime, requireEnv } from "@/lib/env";
import { nicknameFromClaims, nicknameFromToken } from "./auth-nickname";
import { getDb } from "./db";
import { fetchUserProfile } from "./db/user-data";

// 운영 런타임 방어선 — instrumentation(부팅 검증)을 우회해 이 모듈이 먼저 로드되더라도
// 아래 개발용 폴백 값으로 서비스가 뜨는 일이 없게 한다. (운영-준비-플랜 §1.1)
assertProductionEnv();

/** 운영에서는 필수(위에서 검증됨), 로컬 개발·빌드 단계에서는 기본값 폴백. */
function authEnv(
  key: "AUTH_SECRET" | "AUTH_KEYCLOAK_ID" | "AUTH_KEYCLOAK_SECRET" | "AUTH_KEYCLOAK_ISSUER",
  devDefault: string,
): string {
  return isProductionRuntime ? requireEnv(key) : env[key] || devDefault;
}

const KEYCLOAK_ISSUER = authEnv("AUTH_KEYCLOAK_ISSUER", "https://auth.greedylabs.kr/realms/eumgil");
const KEYCLOAK_CLIENT_ID = authEnv("AUTH_KEYCLOAK_ID", "eumgil");
const KEYCLOAK_CLIENT_SECRET = authEnv("AUTH_KEYCLOAK_SECRET", "");
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
      accessTokenExpiresAt:
        Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? SESSION_MAX_AGE_SECONDS),
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
  url.searchParams.set("post_logout_redirect_uri", env.AUTH_URL || "http://localhost:3000");
  url.searchParams.set("client_id", KEYCLOAK_CLIENT_ID);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  return url.toString();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // 로컬 학습/데모 환경에서만 AUTH_SECRET 없이 폴백을 허용한다.
  // 운영 런타임에서는 assertProductionEnv() 가 미설정 시 기동을 차단한다.
  secret: authEnv("AUTH_SECRET", "eumgil-dev-only-auth-secret-change-before-production"),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  // AUTH_URL이 고정된 배포에서는 Auth.js가 이 주소로 요청 URL을 정규화한다.
  // trustHost도 활성화해야 프록시 뒤에서 UntrustedHost로 로그인이 거부되지 않는다.
  trustHost: Boolean(env.AUTH_URL) || !isProductionRuntime,
  providers: [
    Keycloak({
      // 개발 앱도 공용 인증 서버를 사용한다. 로그인에는 발급받은 Client Secret이 필요하다.
      clientId: KEYCLOAK_CLIENT_ID,
      clientSecret: KEYCLOAK_CLIENT_SECRET,
      issuer: KEYCLOAK_ISSUER,
      profile(profile) {
        return {
          id: profile.sub,
          name: nicknameFromClaims(profile),
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
  ],
  callbacks: {
    // 로그인 직후 Keycloak token/profile 에서 앱에 필요한 claim 을 Auth.js 내부 JWT 로 정규화한다.
    // access/id/refresh token 은 서버 쿠키(JWE) 안에만 보관하고, client session 으로는 내보내지 않는다.
    async jwt({ token, account, profile }) {
      if (account) {
        token.sub = profile?.sub ?? token.sub;
        token.nickname = nicknameFromClaims({ ...profile, sub: token.sub });
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpiresAt = account.expires_at;
        token.roles = rolesFromProfile(profile);
      }
      token.name = nicknameFromToken(token);
      const expiresAt =
        typeof token.accessTokenExpiresAt === "number" ? token.accessTokenExpiresAt : 0;
      if (expiresAt > Math.floor(Date.now() / 1000) + TOKEN_REFRESH_MARGIN_SECONDS) return token;
      if (token.refreshToken) return refreshAccessToken(token);
      return token;
    },
    // 브라우저가 읽는 세션에는 식별자와 표시 정보, 권한만 둔다. 민감한 provider token 은 제외한다.
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        session.user.name = nicknameFromToken(token);
        // 사용자 지정 닉네임은 현재 계정에서만 조회하며 공유 캐시·IdP에 복사하지 않는다.
        // 앱 DB 장애가 소셜 인증 자체를 막지 않도록 안전한 별명으로 유지한다.
        if (token.sub) {
          try {
            const db = getDb();
            const profile = db ? await fetchUserProfile(db, token.sub) : null;
            if (profile?.displayName) session.user.name = profile.displayName;
          } catch {
            console.warn("[auth] 앱 닉네임 조회 실패, 로그인 별명 사용");
          }
        }
        session.user.roles = stringArray(token.roles);
      }
      session.authError = typeof token.error === "string" ? token.error : undefined;
      return session;
    },
  },
});
