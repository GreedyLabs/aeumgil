// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef } from "react";
import { DATA } from "./data";
import * as UI from "./ui";
import { HomeScreen } from "./screens-home";
import { MatchingScreen, ThemeResultScreen, CourseScreen } from "./screens-theme";
import {
  SpotScreen,
  AlternativeScreen,
  SavedScreen,
  MapScreen,
  DiscoverScreen,
} from "./screens-spot";
import { LoginScreen, OnboardingScreen } from "./screens-auth";
import {
  ProfileScreen,
  ProfileEditScreen,
  ReviewsScreen,
  SettingsScreen,
  DocScreen,
} from "./screens-profile";

const { TabBar, Sidebar } = UI;

// Fixed presentation config (the design-host "tweak" panel is dropped in production).
const TWEAKS = {
  palette: "ocean",
  homeLayout: "themes-first",
  themeVariant: "default",
  lang: "ko",
  mypageVariant: "stats",
};

export default function App() {
  const [route, setRoute] = useState({ name: "home" });
  const [history, setHistory] = useState([]);
  const [prompt, setPrompt] = useState("");
  // Always start logged-out; auth changes only via login/logout actions.
  const [auth, setAuth] = useState({ member: false, user: DATA.USER });
  const [savedSpots, setSavedSpots] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const tweaks = TWEAKS;
  const lang = tweaks.lang;
  const palette = tweaks.palette;

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // apply palette to body
  useEffect(() => {
    document.body.setAttribute("data-palette", palette);
  }, [palette]);

  // scroll top on route change
  useEffect(() => {
    const el = document.querySelector(".screen-body");
    if (el) el.scrollTo({ top: 0 });
  }, [route]);

  // ── Auth / saved helpers ──
  const requireAuth = (reason, onOk) => {
    if (auth.member) {
      onOk && onOk();
      return true;
    }
    nav("login", { reason });
    return false;
  };
  const toggleSave = (id) => {
    requireAuth("save", () => {
      setSavedSpots((prev) => {
        const n = new Set(prev);
        if (n.has(id)) {
          n.delete(id);
          showToast(lang === "ko" ? "저장 해제했어요" : "Removed");
        } else {
          n.add(id);
          showToast(lang === "ko" ? "저장한 장소에 담았어요" : "Saved");
        }
        return n;
      });
    });
  };
  const doLogin = (providerId) => {
    setAuth({ member: true, user: DATA.USER });
    const names = { kakao: "카카오", naver: "네이버", google: "Google", apple: "Apple" };
    showToast(lang === "ko" ? `${names[providerId] || ""}로 로그인했어요` : `Signed in`);
    if (history.length > 0) back();
    else setRoute({ name: "home" });
  };
  const doLogout = () => {
    setAuth({ member: false, user: DATA.USER });
    showToast(lang === "ko" ? "로그아웃했어요" : "Signed out");
    setRoute({ name: "profile" });
    setHistory([]);
  };
  const completeOnboarding = () => {
    setRoute({ name: "home" });
    setHistory([]);
    showToast(lang === "ko" ? "관심사를 저장했어요" : "Preferences saved");
  };

  const nav = (name, params = {}) => {
    setHistory((h) => [...h, route]);
    setRoute({ name, ...params });
  };
  const back = () => {
    setHistory((h) => {
      if (h.length === 0) {
        setRoute({ name: "home" });
        return h;
      }
      const next = [...h];
      const prev = next.pop();
      setRoute(prev);
      return next;
    });
  };

  const handlePrompt = (q) => {
    setPrompt(q);
    nav("matching", { query: q });
  };

  const handleMatchDone = (primaryId, altIds) => {
    setRoute({ name: "theme", themeId: primaryId, altIds, fromQuery: prompt });
  };

  // current tab based on route
  const activeTab = ["home", "matching"].includes(route.name)
    ? "home"
    : ["discover", "theme", "course", "spot", "alternative"].includes(route.name)
      ? "discover"
      : route.name === "saved"
        ? "saved"
        : ["profile", "profileEdit", "reviews", "settings", "doc"].includes(route.name)
          ? "profile"
          : "home";

  const showTab = !["matching", "login", "onboarding"].includes(route.name);

  const goTab = (id) => {
    if (id === "home") setRoute({ name: "home" });
    else if (id === "discover") setRoute({ name: "discover" });
    else if (id === "saved") setRoute({ name: "saved" });
    else if (id === "profile") setRoute({ name: "profile" });
    setHistory([]);
  };

  let screen = null;
  switch (route.name) {
    case "home":
      screen = (
        <HomeScreen onNav={nav} onPrompt={handlePrompt} lang={lang} homeLayout={tweaks.homeLayout} />
      );
      break;
    case "matching":
      screen = <MatchingScreen query={route.query} onDone={handleMatchDone} lang={lang} />;
      break;
    case "theme":
      screen = (
        <ThemeResultScreen
          themeId={route.themeId}
          altIds={route.altIds}
          query={route.fromQuery}
          onNav={nav}
          lang={lang}
          onBack={back}
        />
      );
      break;
    case "course":
      screen = <CourseScreen themeId={route.themeId} onNav={nav} lang={lang} onBack={back} />;
      break;
    case "spot":
      screen = (
        <SpotScreen
          spotId={route.spotId}
          onNav={nav}
          lang={lang}
          onBack={back}
          saved={savedSpots}
          onToggleSave={toggleSave}
          onAddCourse={() =>
            requireAuth("course", () =>
              showToast(lang === "ko" ? "내 코스에 담았어요" : "Added to course"),
            )
          }
        />
      );
      break;
    case "alternative":
      screen = (
        <AlternativeScreen
          spotId={route.spotId}
          themeId={route.themeId}
          onNav={nav}
          lang={lang}
          onBack={back}
        />
      );
      break;
    case "saved":
      screen = <SavedScreen onNav={nav} lang={lang} />;
      break;
    case "map":
      screen = <MapScreen onNav={nav} lang={lang} />;
      break;
    case "discover":
      screen = <DiscoverScreen onNav={nav} lang={lang} themeVariant={tweaks.themeVariant} />;
      break;
    case "login":
      screen = (
        <LoginScreen
          lang={lang}
          reason={route.reason}
          onLogin={doLogin}
          onSkip={back}
          onClose={back}
        />
      );
      break;
    case "onboarding":
      screen = (
        <OnboardingScreen lang={lang} onDone={completeOnboarding} onSkip={completeOnboarding} />
      );
      break;
    case "profile":
      screen = (
        <ProfileScreen
          lang={lang}
          variant={tweaks.mypageVariant}
          isMember={auth.member}
          user={auth.user}
          onNav={nav}
          onLogout={doLogout}
        />
      );
      break;
    case "profileEdit":
      screen = (
        <ProfileEditScreen
          lang={lang}
          user={auth.user}
          onBack={back}
          onSave={() => {
            back();
            showToast(lang === "ko" ? "프로필을 저장했어요" : "Profile saved");
          }}
        />
      );
      break;
    case "reviews":
      screen = <ReviewsScreen lang={lang} onNav={nav} onBack={back} initialTab={route.tab} />;
      break;
    case "settings":
      screen = (
        <SettingsScreen
          lang={lang}
          isMember={auth.member}
          onNav={nav}
          onBack={back}
          onLogout={doLogout}
          onSetLang={() => {}}
        />
      );
      break;
    case "doc":
      screen = <DocScreen lang={lang} doc={route.doc} onBack={back} />;
      break;
    default:
      screen = (
        <HomeScreen onNav={nav} onPrompt={handlePrompt} lang={lang} homeLayout={tweaks.homeLayout} />
      );
  }

  return (
    <div className="app-shell">
      {showTab && (
        <Sidebar
          active={activeTab}
          onNav={goTab}
          lang={lang}
          isMember={auth.member}
          user={auth.user}
          onLogin={() => {
            setHistory([]);
            setRoute({ name: "login", reason: "profile" });
          }}
        />
      )}
      <div className="app-screen">
        <div
          className="screen-body"
          key={route.name + (route.themeId || "") + (route.spotId || "")}
        >
          {screen}
        </div>
        {showTab && <TabBar active={activeTab} onNav={goTab} lang={lang} />}
      </div>
      {toast && (
        <div className="toast">
          <span style={{ display: "inline-flex" }}>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
