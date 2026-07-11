// ─────────────────────────────────────────────
// Keycloak Admin API — 회원 탈퇴 시 인증 계정 삭제 (§7.2, 서버 전용).
//
// service account 방식: realm 에 confidential client 를 만들고 Service Accounts
// 를 켠 뒤 realm-management 의 `manage-users` 역할을 부여한다. 해당 클라이언트의
// id/secret 을 KEYCLOAK_ADMIN_CLIENT_ID/SECRET 로 주입하면 동작한다.
// 미설정 환경(로컬 기본)에서는 skipped 를 돌려주고, 호출부는 앱 DB 삭제만으로
// 탈퇴를 완료한다(Keycloak 계정은 수동 절차 — 운영-준비-플랜 §7.2 메모).
// ─────────────────────────────────────────────

import { env } from "@/lib/env";
import { createLogger } from "@/server/log";

const log = createLogger("auth");

const TIMEOUT_MS = 8_000;

export type KeycloakDeleteResult =
  | { deleted: true }
  | { deleted: false; skipped: true }
  | { deleted: false; skipped: false; error: string };

/** issuer(…/realms/{realm}) → Admin API 사용자 리소스 URL */
function adminUserUrl(issuer: string, sub: string): string {
  return `${issuer.replace("/realms/", "/admin/realms/")}/users/${encodeURIComponent(sub)}`;
}

/** service account 토큰 발급 (client_credentials). */
async function adminToken(issuer: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`토큰 발급 실패 (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("토큰 응답에 access_token 없음");
  return data.access_token;
}

/**
 * Keycloak 사용자(sub) 삭제. admin 클라이언트 미설정이면 skipped.
 * 실패해도 throw 하지 않는다 — 탈퇴 흐름에서 앱 DB 파기가 우선이고,
 * 계정 삭제 실패는 warn 로그 + 수동 정리 대상으로 남긴다.
 */
export async function deleteKeycloakUser(sub: string): Promise<KeycloakDeleteResult> {
  const issuer = env.AUTH_KEYCLOAK_ISSUER;
  const clientId = env.KEYCLOAK_ADMIN_CLIENT_ID;
  const clientSecret = env.KEYCLOAK_ADMIN_CLIENT_SECRET;
  if (!issuer || !clientId || !clientSecret) {
    log.warn(`keycloak user ${sub} 삭제 스킵 — admin 클라이언트 미설정(수동 정리 필요)`);
    return { deleted: false, skipped: true };
  }

  try {
    const token = await adminToken(issuer, clientId, clientSecret);
    const res = await fetch(adminUserUrl(issuer, sub), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 404 = 이미 없음 → 목적 달성으로 간주(멱등).
    if (res.ok || res.status === 404) {
      log.log(`keycloak user ${sub} 삭제 완료`);
      return { deleted: true };
    }
    throw new Error(`삭제 응답 ${res.status}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.warn(`keycloak user ${sub} 삭제 실패 — ${msg} (수동 정리 필요)`);
    return { deleted: false, skipped: false, error: msg };
  }
}
