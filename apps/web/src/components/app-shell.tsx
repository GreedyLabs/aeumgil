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
import Link from "next/link";
import { Sidebar, TabBar } from "@/design/ui";
import { urlForTab } from "@/lib/nav";
import { safeReturnTo } from "@/lib/auth-return-to";
import { languageFromCookie } from "@/lib/language-cookie";
import {
  DEFAULT_LANG,
  isLang,
  keycloakUiLocales,
  LANGUAGE_COOKIE,
  uiText,
  type Lang,
} from "@/lib/i18n";
import { LanguageContext } from "./language-context";
import { LanguagePicker } from "./language-picker";
import languageStyles from "./language-picker.module.css";

// 프로토타입 발표용 고정 설정 (design-host 의 tweak 패널 대체)
export const TWEAKS = {
  palette: "ocean",
  homeLayout: "themes-first",
  themeVariant: "default",
  lang: DEFAULT_LANG,
  mypageVariant: "stats",
};

interface AuthState {
  member: boolean;
  user: { name: string; email: string; avatar: string };
}

interface AppState {
  lang: Lang;
  setLang: (lang: Lang) => void;
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
  if (/^\/(profile|reviews|settings|doc|login|onboarding)/.test(pathname)) return "profile";
  return "home";
}

export function AppShell({
  children,
  initialLang = DEFAULT_LANG,
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const [lang, setCurrentLang] = useState<Lang>(initialLang);
  // 진행 중인 전환이 있어도 마지막 요청 언어를 유지해 중복 새로고침을 막는다.
  const currentLanguage = useRef(lang);
  const palette = TWEAKS.palette;
  const applyLanguage = useCallback(
    (next: Lang) => {
      if (next === currentLanguage.current) return;
      // focus와 visibilitychange가 연속 발생해도 같은 언어로 중복 refresh하지 않는다.
      currentLanguage.current = next;
      setCurrentLang(next);
      router.refresh();
    },
    [router],
  );
  const setLang = useCallback(
    (next: Lang) => {
      if (!isLang(next)) return;
      document.cookie = `${LANGUAGE_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
      applyLanguage(next);
    },
    [applyLanguage],
  );
  useEffect(() => {
    const syncLanguage = () => {
      if (document.visibilityState === "hidden") return;
      const next = languageFromCookie(document.cookie);
      if (next) applyLanguage(next);
    };
    syncLanguage();
    window.addEventListener("focus", syncLanguage);
    document.addEventListener("visibilitychange", syncLanguage);
    return () => {
      window.removeEventListener("focus", syncLanguage);
      document.removeEventListener("visibilitychange", syncLanguage);
    };
  }, [applyLanguage]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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
      user: {
        ...userFromSession(session?.user),
        name: session?.user?.name || uiText("여행자", lang),
      },
    }),
    [session?.user, status, lang],
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
      await signIn(
        providerId,
        { callbackUrl: safeReturnTo(returnTo) },
        { ui_locales: keycloakUiLocales(lang) },
      );
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
    setLang,
    tweaks: { ...TWEAKS, lang },
    auth,
    login,
    logout,
    requireAuth,
    showToast,
  };

  const activeTab = activeTabFor(pathname);

  const goTab = (id: string) => router.push(urlForTab(id));

  return (
    <AppStateContext.Provider value={ctx}>
      <LanguageContext.Provider value={lang}>
        <div className={`app-shell${sidebarCollapsed ? " app-shell-collapsed" : ""}`}>
          <a className="skip-link" href="#main-content">
            {uiText("본문으로 건너뛰기", lang)}
          </a>
          <Sidebar
            ready={sidebarReady}
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
            active={activeTab}
            onNav={goTab}
            lang={lang}
            onLanguageChange={setLang}
            isMember={auth.member}
            user={auth.user}
            onLogin={() => router.push("/login?reason=profile")}
          />
          <div className="app-screen">
            <div className={languageStyles.mobileHeader}>
              <Link href="/" aria-label={uiText("에움길 홈", lang)}>
                에움길
              </Link>
              <LanguagePicker lang={lang} onChange={setLang} hideLabel />
            </div>
            {lang !== "ko" && (
              <aside className={languageStyles.notice} aria-label={uiText("제공 언어", lang)}>
                <p>{uiText("일부 관광 정보와 안내는 원문 또는 영어로 표시됩니다.", lang)}</p>
                <Link href="/settings">{uiText("언어 설정", lang)}</Link>
              </aside>
            )}
            <main className="screen-body" key={pathname} id="main-content">
              {children}
            </main>
            <TabBar ready={sidebarReady} active={activeTab} onNav={goTab} lang={lang} />
          </div>
          {toast && (
            <div className="toast" role="status" aria-live="polite">
              <span style={{ display: "inline-flex" }}>✓</span>
              {uiText(toast, lang)}
            </div>
          )}
        </div>
      </LanguageContext.Provider>
    </AppStateContext.Provider>
  );
}
