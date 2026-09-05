import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

/**
 * 개인화 화면의 서버 가드.
 *
 * Keycloak 이 실제 인증 세션을 관리하고, 앱은 Auth.js 세션의 user.id(Keycloak sub)만 신뢰한다.
 * 서버 컴포넌트에서 먼저 막아야 DB 조회/쓰기 경로가 비로그인 사용자에게 열리지 않는다.
 */
export async function requireUserSession(reason: string): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (userId) return userId;
  const returnTo =
    (
      {
        save: "/saved",
        review: "/reviews",
        settings: "/settings",
        profile: "/profile/edit",
        onboarding: "/onboarding",
      } as Record<string, string>
    )[reason] ?? "/profile";
  redirect(`/login?reason=${encodeURIComponent(reason)}&returnTo=${encodeURIComponent(returnTo)}`);
}
