"use client";

// ─────────────────────────────────────────────
// AppShell — 앱 전역 상태 Provider + 공통 크롬(Sidebar/TabBar/Toast)
//
// 기존 design/App.tsx 의 상태머신을 실제 라우팅 구조로 옮긴 것.
// 라우트 전환 간 유지돼야 하는 상태(auth/saved/toast)를 Context 로 제공한다.
// Phase 4: auth 는 Auth.js 세션으로 판정하고, 저장/리뷰 등 사용자 데이터는 Repository 로 영속화한다.
// ─────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { DATA } from "@/design/data";
import { Sidebar, TabBar } from "@/design/ui";
import { urlForTab } from "@/lib/nav";

// 프로토타입 발표용 고정 설정 (design-host 의 tweak 패널 대체)
export const TWEAKS = {
  palette: "ocean",
  homeLayout: "themes-first",
  themeVariant: "default",
  lang: "ko" as const,
  mypageVariant: "stats",
};

type Lang = "ko" | "en";

interface AuthState {
  member: boolean;
  user: typeof DATA.USER;
}

interface AppState {
  lang: Lang;
  tweaks: typeof TWEAKS;
  auth: AuthState;
  login: (providerId: string) => void;
  logout: () => void;
  requireAuth: (reason: string, onOk?: () => void) => boolean;
  addToCourse: () => void;
  showToast: (msg: string) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within <AppShell>");
  return ctx;
}

const PROVIDER_NAMES: Record<string, string> = {
  keycloak: "통합 계정",
  kakao: "카카오",
  naver: "네이버",
  google: "Google",
  apple: "Apple",
};

function userFromSession(sessionUser: { name?: string | null; email?: string | null; image?: string | null } | undefined): typeof DATA.USER {
  if (!sessionUser) return DATA.USER;
  const name = sessionUser.name || DATA.USER.name_ko;
  return {
    ...DATA.USER,
    name_ko: name,
    name_en: name,
    email: sessionUser.email ?? DATA.USER.email,
    avatar: sessionUser.image ?? DATA.USER.avatar,
  };
}

function activeTabFor(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/result")) return "home";
  if (/^\/(discover|theme|course|spot|alternatives)/.test(pathname)) return "discover";
  if (pathname.startsWith("/saved")) return "saved";
  if (/^\/(profile|reviews|settings|doc)/.test(pathname)) return "profile";
  return "home";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const lang = TWEAKS.lang;
  const palette = TWEAKS.palette;

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const auth = useMemo<AuthState>(
    () => ({
      member: status === "authenticated",
      user: userFromSession(session?.user),
    }),
    [session?.user, status],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // palette 적용
  useEffect(() => {
    document.body.setAttribute("data-palette", palette);
  }, [palette]);

  const requireAuth = useCallback(
    (reason: string, onOk?: () => void) => {
      if (auth.member) {
        onOk?.();
        return true;
      }
      router.push(`/login?reason=${encodeURIComponent(reason)}`);
      return false;
    },
    [auth.member, router],
  );

  const login = useCallback(
    (providerId: string) => {
      showToast(`${PROVIDER_NAMES[providerId] ?? ""}로 로그인했어요`);
      void signIn(providerId, { callbackUrl: "/profile" });
    },
    [showToast],
  );

  const logout = useCallback(async () => {
    showToast("로그아웃했어요");
    const logoutUrl = await fetch("/api/auth/keycloak/logout?format=json")
      .then((r) => r.json() as Promise<{ url?: string }>)
      .then((r) => r.url)
      .catch(() => undefined);
    await signOut({ redirect: false });
    window.location.assign(logoutUrl || "/api/auth/keycloak/logout");
  }, [showToast]);

  const addToCourse = useCallback(() => {
    requireAuth("course", () => showToast("내 코스에 담았어요"));
  }, [requireAuth, showToast]);

  const ctx: AppState = {
    lang,
    tweaks: TWEAKS,
    auth,
    login,
    logout,
    requireAuth,
    addToCourse,
    showToast,
  };

  const activeTab = activeTabFor(pathname);
  const showChrome = !/^\/(result|login|onboarding)/.test(pathname);

  const goTab = (id: string) => router.push(urlForTab(id));

  return (
    <AppStateContext.Provider value={ctx}>
      <div className="app-shell">
        {showChrome && (
          <Sidebar
            active={activeTab}
            onNav={goTab}
            lang={lang}
            isMember={auth.member}
            user={auth.user}
            onLogin={() => router.push("/login?reason=profile")}
          />
        )}
        <div className="app-screen">
          <div className="screen-body" key={pathname}>
            {children}
          </div>
          {showChrome && <TabBar active={activeTab} onNav={goTab} lang={lang} />}
        </div>
        {toast && (
          <div className="toast">
            <span style={{ display: "inline-flex" }}>✓</span>
            {toast}
          </div>
        )}
      </div>
    </AppStateContext.Provider>
  );
}
