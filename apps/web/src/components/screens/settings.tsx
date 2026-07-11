"use client";

// SettingsView — Phase 4(부분). 설정 토글(로컬 상태). 인증 항목은 회원일 때만.
import { useState } from "react";
import { deleteAccountAction } from "@/app/actions/account";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { MenuRow } from "./profile";
import { Icon } from "./_ui";

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={"switch" + (on ? " on" : "")} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="switch-knob" />
    </button>
  );
}

export function SettingsView() {
  const { lang, auth, logout, showToast } = useAppState();
  const { nav, back } = useAppNav();
  const [push, setPush] = useState(true);
  const [crowd, setCrowd] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [dark, setDark] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 회원 탈퇴(§7.2): 앱 DB 파기 + (설정 시) Keycloak 계정 삭제 → 로그아웃으로 세션 종료.
  const deleteAccount = async () => {
    const confirmed = window.confirm(
      lang === "ko"
        ? "저장한 테마·리뷰·방문 기록이 모두 삭제되며 되돌릴 수 없어요. 정말 탈퇴할까요?"
        : "This permanently deletes your saved themes, reviews and visits. Continue?",
    );
    if (!confirmed) return;
    setDeleting(true);
    const res = await deleteAccountAction();
    if (!res.ok) {
      showToast(res.error);
      setDeleting(false);
      return;
    }
    showToast(lang === "ko" ? "탈퇴가 완료됐어요. 그동안 함께해 주셔서 감사해요." : "Your account has been deleted.");
    logout();
  };

  return (
    <div className="screen-enter">
      <div className="topbar elev">
        <button className="icon-btn" onClick={back}>
          <Icon.back />
        </button>
        <h1>{lang === "ko" ? "설정" : "Settings"}</h1>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: "8px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "알림" : "Notifications"}</div>
        <div className="menu-group">
          <div className="menu-row static">
            <span className="menu-lbl">{lang === "ko" ? "푸시 알림" : "Push"}</span>
            <Switch on={push} onChange={setPush} />
          </div>
          <div className="menu-row static">
            <span className="menu-lbl">{lang === "ko" ? "혼잡도 알림" : "Crowd alerts"}</span>
            <Switch on={crowd} onChange={setCrowd} />
          </div>
          <div className="menu-row static last">
            <span className="menu-lbl">{lang === "ko" ? "마케팅 정보 수신" : "Marketing"}</span>
            <Switch on={marketing} onChange={setMarketing} />
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "일반" : "General"}</div>
        <div className="menu-group">
          <button className="menu-row">
            <span className="menu-ic">
              <Icon.globe />
            </span>
            <span className="menu-lbl">{lang === "ko" ? "언어" : "Language"}</span>
            <span className="menu-val">{lang === "ko" ? "한국어" : "English"}</span>
            <Icon.chevR style={{ color: "var(--ink-4)", flexShrink: 0 }} />
          </button>
          <div className="menu-row static last">
            <span className="menu-ic">
              <Icon.sun />
            </span>
            <span className="menu-lbl">{lang === "ko" ? "다크 모드" : "Dark mode"}</span>
            <Switch on={dark} onChange={setDark} />
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div className="section-label">{lang === "ko" ? "약관 및 정보" : "About"}</div>
        <div className="menu-group">
          <MenuRow icon={<Icon.bell />} label={lang === "ko" ? "공지사항" : "Notices"} onClick={() => nav("doc", { doc: "notice" })} />
          <MenuRow icon={<Icon.headset />} label={lang === "ko" ? "고객센터" : "Support"} onClick={() => nav("doc", { doc: "support" })} />
          <MenuRow icon={<Icon.doc />} label={lang === "ko" ? "이용약관" : "Terms of service"} onClick={() => nav("doc", { doc: "terms" })} />
          <MenuRow icon={<Icon.lock />} label={lang === "ko" ? "개인정보처리방침" : "Privacy policy"} onClick={() => nav("doc", { doc: "privacy" })} />
          <MenuRow icon={<Icon.doc />} label={lang === "ko" ? "데이터 출처" : "Data sources"} onClick={() => nav("doc", { doc: "sources" })} />
          <MenuRow icon={<Icon.doc />} label={lang === "ko" ? "앱 버전" : "App version"} value="1.4.0" last />
        </div>
      </div>

      {auth.member && (
        <div style={{ padding: "20px 20px 0" }}>
          <div className="menu-group">
            <MenuRow icon={<Icon.logout />} label={lang === "ko" ? "로그아웃" : "Sign out"} onClick={logout} danger />
            <button className="menu-row last" onClick={deleteAccount} disabled={deleting}>
              <span className="menu-lbl" style={{ color: "var(--ink-4)" }}>
                {deleting ? (lang === "ko" ? "탈퇴 처리 중..." : "Deleting...") : lang === "ko" ? "회원 탈퇴" : "Delete account"}
              </span>
            </button>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: 11, color: "var(--ink-4)", padding: "24px 0 28px" }}>
        에움길 · Made by GreedyLabs
      </div>
    </div>
  );
}
