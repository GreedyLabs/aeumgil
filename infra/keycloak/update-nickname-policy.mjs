#!/usr/bin/env node
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

/** 기존 설정과 다른 속성은 보존하고 이름/성·닉네임 정책만 변경한다. */
export function nicknameUserProfile(current) {
  if (!current || !Array.isArray(current.attributes)) {
    throw new Error("User Profile 응답에 attributes가 없습니다.");
  }
  for (const name of ["username", "email"]) {
    if (current.attributes.filter((attribute) => attribute.name === name).length !== 1) {
      throw new Error(`User Profile의 ${name} 속성을 확인해 주세요.`);
    }
  }
  const next = structuredClone(current);
  for (const attribute of next.attributes) {
    if (attribute.name === "firstName" || attribute.name === "lastName") {
      delete attribute.required;
      attribute.permissions = { ...attribute.permissions, view: ["admin"], edit: ["admin"] };
    }
  }
  const nicknames = next.attributes.filter((attribute) => attribute.name === "nickname");
  if (nicknames.length > 1 || nicknames[0]?.multivalued === true) {
    throw new Error("nickname 속성이 중복되거나 다중 값입니다. 기존 정책을 먼저 검토해 주세요.");
  }
  const nickname = nicknames[0] ?? {
    name: "nickname",
    displayName: "${nickname}",
    multivalued: false,
    validations: { length: { max: 20 } },
  };
  delete nickname.required;
  nickname.permissions = {
    ...nickname.permissions,
    view: ["admin", "user"],
    edit: ["admin", "user"],
  };
  if (!nicknames.length) next.attributes.push(nickname);
  return next;
}

export async function updateNicknamePolicy({
  baseUrl = "https://auth.greedylabs.kr",
  token,
  apply = false,
  fetchImpl = fetch,
  report = console.log,
}) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("관리 서버 주소는 자격증명·쿼리가 없는 HTTPS 주소여야 합니다.");
  }
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("KEYCLOAK_ADMIN_TOKEN에 단기 관리 access token을 지정해 주세요.");
  }
  if (/[^\x21-\x7e]/u.test(token)) {
    throw new Error("관리 access token에 공백이나 잘못된 문자가 있습니다.");
  }
  const endpoint = `${base.href.replace(/\/$/, "")}/admin/realms/eumgil/users/profile`;
  const request = async (method, body) => {
    const response = await fetchImpl(endpoint, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`User Profile ${method} 실패 (HTTP ${response.status}).`);
    }
    if (method !== "GET") return undefined;
    try {
      return await response.json();
    } catch {
      throw new Error("User Profile 응답이 JSON이 아닙니다.");
    }
  };

  const before = await request("GET");
  const desired = nicknameUserProfile(before);
  const changed = !isDeepStrictEqual(before, desired);
  report({
    mode: apply ? "apply" : "dry-run",
    realm: "eumgil",
    server: base.origin,
    changed,
    attributes: desired.attributes
      .filter((attribute) => ["firstName", "lastName", "nickname"].includes(attribute.name))
      .map(({ name, required, permissions }) => ({
        name,
        required: Boolean(required),
        permissions,
      })),
  });
  if (!apply || !changed) return { changed, applied: false };

  // 관리 화면과 동시에 수정한 값을 오래된 GET 결과로 덮어쓰지 않는다.
  if (!isDeepStrictEqual(before, await request("GET"))) {
    throw new Error("조회 후 User Profile이 변경되었습니다. 새 dry-run으로 다시 확인해 주세요.");
  }
  await request("PUT", desired);
  const actual = await request("GET");
  if (!isDeepStrictEqual(actual, desired)) {
    throw new Error("저장 후 User Profile이 계획과 다릅니다. 현재 설정을 다시 확인해 주세요.");
  }
  report("User Profile 저장 후 재조회 일치를 확인했습니다.");
  return { changed, applied: true };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "사용법: node infra/keycloak/update-nickname-policy.mjs [--apply]\n기본은 조회만 하는 dry-run입니다. KEYCLOAK_ADMIN_TOKEN과 선택 KEYCLOAK_ADMIN_URL을 사용합니다.",
    );
    return;
  }
  if (args.some((arg) => arg !== "--apply"))
    throw new Error("지원하는 옵션은 --apply, --help입니다.");
  await updateNicknamePolicy({
    baseUrl: process.env.KEYCLOAK_ADMIN_URL,
    token: process.env.KEYCLOAK_ADMIN_TOKEN,
    apply: args.includes("--apply"),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "닉네임 정책 확인 실패");
    process.exitCode = 1;
  });
}
