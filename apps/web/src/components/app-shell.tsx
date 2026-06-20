"use client";

// ─────────────────────────────────────────────
// AppShell — 앱 전역 상태 Provider + 공통 크롬(Sidebar/TabBar/Toast)
//
// 기존 design/App.tsx 의 상태머신을 실제 라우팅 구조로 옮긴 것.
// 라우트 전환 간 유지돼야 하는 상태(auth/saved/toast)를 Context 로 제공한다.
// Phase 1: auth/user 는 mock(DATA.USER). Phase 4 에서 실제 세션으로 교체.
// ─────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
  saved: Set<string>;
  login: (providerId: string) => void;
  logout: () => void;
  toggleSave: (id: string) => void;
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
  kakao: "카카오",
  naver: "네이버",
  google: "Google",
  apple: "Apple",
};

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

  const lang = TWEAKS.lang;
  const palette = TWEAKS.palette;

  const [auth, setAuth] = useState<AuthState>({ member: false, user: DATA.USER });
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const toggleSave = useCallback(
    (id: string) => {
      requireAuth("save", () => {
        setSaved((prev) => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
            showToast("저장 해제했어요");
          } else {
            next.add(id);
            showToast("저장한 장소에 담았어요");
          }
          return next;
        });
      });
    },
    [requireAuth, showToast],
  );

  const login = useCallback(
    (providerId: string) => {
      setAuth({ member: true, user: DATA.USER });
      showToast(`${PROVIDER_NAMES[providerId] ?? ""}로 로그인했어요`);
      router.back();
    },
    [router, showToast],
  );

  const logout = useCallback(() => {
    setAuth({ member: false, user: DATA.USER });
    showToast("로그아웃했어요");
    router.push("/profile");
  }, [router, showToast]);

  const addToCourse = useCallback(() => {
    requireAuth("course", () => showToast("내 코스에 담았어요"));
  }, [requireAuth, showToast]);

  const ctx: AppState = {
    lang,
    tweaks: TWEAKS,
    auth,
    saved,
    login,
    logout,
    toggleSave,
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
