"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { keycloakEndSessionUrl, signOut } from "@/server/auth";
import { readSessionToken } from "@/server/session-token";

export async function logoutAction(): Promise<void> {
  // 세션 쿠키를 지우기 전에 ID 토큰을 확보한다. Server Action의 Origin 검사로 POST를 보호한다.
  const token = await readSessionToken(await headers());
  const destination = keycloakEndSessionUrl(
    typeof token?.idToken === "string" ? token.idToken : undefined,
  );
  await signOut({ redirect: false });
  redirect(destination);
}
