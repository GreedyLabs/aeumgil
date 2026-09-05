"use client";

// ─────────────────────────────────────────────
// 네비게이션 어댑터
//
// 기존 화면들은 onNav(name, params) / onBack() 형태로 이동을 요청한다.
// 이를 실제 Next.js URL 로 변환해 라우터에 위임한다.
// 화면 컴포넌트 내부를 수정하지 않고 실제 라우팅으로 전환하기 위한 계층.
// ─────────────────────────────────────────────

import { useRouter } from "next/navigation";

type NavParams = Record<string, unknown>;

const enc = (v: unknown) => encodeURIComponent(String(v ?? ""));

/** (name, params) → URL 매핑 */
export function urlFor(name: string, params: NavParams = {}): string {
  switch (name) {
    case "home":
      return "/";
    case "matching":
      return `/result?q=${enc(params.query)}`;
    case "theme": {
      const alt = Array.isArray(params.altIds) ? params.altIds.join(",") : "";
      const qs = new URLSearchParams();
      if (alt) qs.set("alt", alt);
      if (params.query) qs.set("q", String(params.query));
      const s = qs.toString();
      return `/theme/${enc(params.themeId)}${s ? `?${s}` : ""}`;
    }
    case "course": {
      const qs = new URLSearchParams();
      for (const key of ["days", "pace", "companion", "startRegion", "transport"]) {
        if (params[key]) qs.set(key, String(params[key]));
      }
      const s = qs.toString();
      return `/course/${enc(params.themeId)}${s ? `?${s}` : ""}`;
    }
    case "spot":
      return `/spot/${enc(params.spotId)}`;
    case "alternative": {
      const qs = new URLSearchParams();
      if (params.spotId) qs.set("spot", String(params.spotId));
      if (params.themeId) qs.set("theme", String(params.themeId));
      const s = qs.toString();
      return `/alternatives${s ? `?${s}` : ""}`;
    }
    case "discover":
      return "/discover";
    case "saved":
      return "/saved";
    case "map":
      return "/discover?tab=places";
    case "login":
      return params.reason ? `/login?reason=${enc(params.reason)}` : "/login";
    case "onboarding":
      return "/onboarding";
    case "profile":
      return "/profile";
    case "profileEdit":
      return "/profile/edit";
    case "reviews":
      return params.tab ? `/reviews?tab=${enc(params.tab)}` : "/reviews";
    case "settings":
      return "/settings";
    case "doc":
      return `/doc?type=${enc(params.doc)}`;
    default:
      return "/";
  }
}

const TAB_URL: Record<string, string> = {
  home: "/",
  discover: "/discover",
  map: "/discover?tab=places",
  saved: "/saved",
  profile: "/profile",
};

export function urlForTab(id: string): string {
  return TAB_URL[id] ?? "/";
}

export interface AppNav {
  nav: (name: string, params?: NavParams) => void;
  /** 현재 히스토리 엔트리를 대체하며 이동 — 경유 화면(매칭 애니메이션 등)이 뒤로가기에 남지 않게 할 때 사용 */
  replace: (name: string, params?: NavParams) => void;
  back: () => void;
  goTab: (id: string) => void;
}

/** 화면에 주입할 nav/back/goTab 핸들러 */
export function useAppNav(): AppNav {
  const router = useRouter();
  return {
    nav: (name, params) => router.push(urlFor(name, params)),
    replace: (name, params) => router.replace(urlFor(name, params)),
    back: () => router.back(),
    goTab: (id) => router.push(urlForTab(id)),
  };
}
