"use client";

// ─────────────────────────────────────────────
// AppShell — 앱 전역 상태 Provider + 공통 크롬(Sidebar/TabBar/Toast)
//
// 기존 design/App.tsx 의 상태머신을 실제 라우팅 구조로 옮긴 것.
// 라우트 전환 간 유지돼야 하는 상태(auth/saved/toast)를 Context 로 제공한다.
// Phase 4: auth 는 Auth.js 세션으로 판정하고, 저장/리뷰 등 사용자 데이터는 Repository 로 영속화한다.
// ─────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { signIn, useSession } from "next-auth/react";
import { logoutAction } from "@/app/actions/logout";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, TabBar } from "@/design/ui";
import { urlForTab } from "@/lib/nav";
import { safeReturnTo } from "@/lib/auth-return-to";

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
  user: { name: string; email: string; avatar: string };
}

interface AppState {
  lang: Lang;
  tweaks: typeof TWEAKS;
  auth: AuthState;
  login: (providerId: string, returnTo?: string) => Promise<void>;
  logout: () => void;
  requireAuth: (reason: string, onOk?: () => void) => boolean;
  showToast: (msg: string) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within <AppShell>");
  return ctx;
}

function userFromSession(
  user: { name?: string | null; email?: string | null; image?: string | null } | undefined,
): AuthState["user"] {
  return { name: user?.name || "여행자", email: user?.email ?? "", avatar: user?.image ?? "" };
}

function activeTabFor(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/result")) return "home";
  if (pathname.startsWith("/map")) return "discover";
  if (/^\/(discover|theme|course|spot|alternatives|festival)/.test(pathname)) return "discover";
  if (pathname.startsWith("/saved") || pathname.startsWith("/my-courses")) return "saved";
  if (/^\/(profile|reviews|settings|doc|login)/.test(pathname)) return "profile";
  return "home";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const lang = TWEAKS.lang;
  const palette = TWEAKS.palette;

  const [toast, setToast] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);
  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem("eumgil.sidebar.collapsed") === "true");
    } catch {
      /* 저장소 사용 불가 시 기본 폭 유지 */
    }
    setSidebarReady(true);
  }, []);
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      localStorage.setItem("eumgil.sidebar.collapsed", String(next));
    } catch {
      /* 현재 탭에서는 계속 사용 가능 */
    }
  };
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
      const returnTo = safeReturnTo(window.location.pathname + window.location.search);
      router.push(
        `/login?reason=${encodeURIComponent(reason)}&returnTo=${encodeURIComponent(returnTo)}`,
      );
      return false;
    },
    [auth.member, router],
  );

  const login = useCallback(
    async (providerId: string, returnTo?: string) => {
      await signIn(providerId, { callbackUrl: safeReturnTo(returnTo) }, { ui_locales: lang });
    },
    [lang],
  );

  const logoutPending = useRef(false);
  const logout = useCallback(async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    try {
      await logoutAction();
    } catch {
      showToast("로그아웃을 완료하지 못했어요. 다시 시도해 주세요.");
    } finally {
      logoutPending.current = false;
    }
  }, [showToast]);

  const ctx: AppState = {
    lang,
    tweaks: TWEAKS,
    auth,
    login,
    logout,
    requireAuth,
    showToast,
  };

  const activeTab = activeTabFor(pathname);
  const showChrome = !/^\/(result|onboarding)/.test(pathname);

  const goTab = (id: string) => router.push(urlForTab(id));

  return (
    <AppStateContext.Provider value={ctx}>
      <div
        className={`app-shell${showChrome ? (sidebarCollapsed ? " app-shell-collapsed" : "") : " app-shell-focus"}`}
      >
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        {showChrome && (
          <Sidebar
            ready={sidebarReady}
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
            active={activeTab}
            onNav={goTab}
            lang={lang}
            isMember={auth.member}
            user={auth.user}
            onLogin={() => router.push("/login?reason=profile")}
          />
        )}
        <div className="app-screen">
          <main className="screen-body" key={pathname} id="main-content">
            {children}
          </main>
          {showChrome && <TabBar active={activeTab} onNav={goTab} lang={lang} />}
        </div>
        {toast && (
          <div className="toast" role="status" aria-live="polite">
            <span style={{ display: "inline-flex" }}>✓</span>
            {toast}
          </div>
        )}
      </div>
    </AppStateContext.Provider>
  );
}
