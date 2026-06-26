#!/usr/bin/env node
// ─────────────────────────────────────────────
// Keycloak OIDC discovery 검증.
//
// 사용법:
//   pnpm --filter @eumgil/web verify:keycloak
//
// 확인 항목:
//   - AUTH_KEYCLOAK_ISSUER 의 .well-known/openid-configuration 응답
//   - issuer / authorization_endpoint / token_endpoint / jwks_uri 존재
//   - 앱 Auth.js providers endpoint 가 keycloak 을 노출하는지(웹 서버가 켜진 경우)
// ─────────────────────────────────────────────

const C = { green: "\x1b[32m", red: "\x1b[31m", gray: "\x1b[90m", cyan: "\x1b[36m", yellow: "\x1b[33m", reset: "\x1b[0m" };

const issuer = (process.env.AUTH_KEYCLOAK_ISSUER || "http://localhost:8080/realms/eumgil").replace(/\/$/, "");
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

console.log(`\nKeycloak OIDC 검증 → ${C.cyan}${issuer}${C.reset}\n──────────────────────────────`);

try {
  const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
  const cfg = await getJson(discoveryUrl);
  const required = ["issuer", "authorization_endpoint", "token_endpoint", "jwks_uri"];
  const missing = required.filter((k) => !cfg[k]);

  if (cfg.issuer !== issuer) {
    console.warn(`${C.yellow}⚠ issuer 불일치${C.reset}`);
    console.warn(`  expected: ${issuer}`);
    console.warn(`  actual:   ${cfg.issuer}`);
  } else {
    console.log(`${C.green}✓ issuer${C.reset} ${cfg.issuer}`);
  }

  if (missing.length > 0) {
    throw new Error(`discovery 문서 필수 필드 누락: ${missing.join(", ")}`);
  }

  console.log(`${C.green}✓ authorization_endpoint${C.reset} ${C.gray}${cfg.authorization_endpoint}${C.reset}`);
  console.log(`${C.green}✓ token_endpoint${C.reset} ${C.gray}${cfg.token_endpoint}${C.reset}`);
  console.log(`${C.green}✓ jwks_uri${C.reset} ${C.gray}${cfg.jwks_uri}${C.reset}`);
} catch (e) {
  console.error(`${C.red}✗ Keycloak discovery 실패${C.reset} — ${e instanceof Error ? e.message : String(e)}`);
  console.error(`  ${C.gray}먼저 pnpm keycloak:up 을 실행하고, Docker daemon 이 켜져 있는지 확인하세요.${C.reset}`);
  process.exitCode = 1;
  console.log("──────────────────────────────\n");
  process.exit();
}

try {
  const providers = await getJson(`${appUrl}/api/auth/providers`);
  if (providers.keycloak?.callbackUrl) {
    console.log(`${C.green}✓ Auth.js provider${C.reset} keycloak → ${C.gray}${providers.keycloak.callbackUrl}${C.reset}`);
  } else {
    console.warn(`${C.yellow}⚠ Auth.js providers 에 keycloak 이 없습니다.${C.reset} ${C.gray}${appUrl}/api/auth/providers${C.reset}`);
  }
} catch {
  console.warn(`${C.yellow}⚠ 앱 서버 확인 생략${C.reset} ${C.gray}${appUrl} 이 실행 중이면 /api/auth/providers 도 확인합니다.${C.reset}`);
}

console.log("──────────────────────────────\n");
