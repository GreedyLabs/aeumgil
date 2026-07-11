"use server";

// 회원 탈퇴 Server Action (§7.2).
// 앱 DB 의 사용자 데이터(저장/리뷰/방문/온보딩/프로필)를 파기하고, Keycloak 계정
// 삭제를 시도한다(admin 클라이언트 미설정이면 스킵 — 수동 절차). 클라이언트는
// 성공 시 로그아웃 흐름(Keycloak 세션 종료 포함)을 이어서 실행한다.

import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import { deleteUserData } from "@/server/db/user-data";
import { deleteKeycloakUser } from "@/server/keycloak-admin";

type DeleteAccountResult =
  | { ok: true; keycloakDeleted: boolean }
  | { ok: false; error: string };

export async function deleteAccountAction(): Promise<DeleteAccountResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const db = getDb();
  if (!db) return { ok: false, error: "DB 연결이 없어 탈퇴를 처리할 수 없어요." };

  await deleteUserData(db, userId);
  const kc = await deleteKeycloakUser(userId);

  revalidatePath("/", "layout");
  return { ok: true, keycloakDeleted: kc.deleted };
}
