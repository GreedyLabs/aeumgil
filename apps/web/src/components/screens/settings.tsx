"use client";

// 실제 지원하는 서비스 정보와 계정 관리만 노출한다.
import { useState } from "react";
import { deleteAccountAction } from "@/app/actions/account";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { MenuRow } from "./profile";
import { Icon } from "./_ui";

export function SettingsView() {
  const { lang, auth, logout, showToast } = useAppState();
  const { nav, back } = useAppNav();
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
    try {
      const res = await deleteAccountAction();
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      showToast("탈퇴가 완료됐어요. 그동안 함께해 주셔서 감사해요.");
      await logout();
    } catch {
      showToast("탈퇴 처리 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="screen-enter form-page">
      <div className="topbar elev">
        <button className="icon-btn" onClick={back} aria-label="뒤로 가기">
          <Icon.back />
        </button>
        <h1>{lang === "ko" ? "설정" : "Settings"}</h1>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: "8px 20px 0" }}>
        <div className="section-label">서비스 이용</div>
        <div className="menu-group">
          <div className="menu-row static last">
            <span className="menu-ic"><Icon.globe /></span>
            <span className="menu-lbl">제공 언어</span>
            <span className="menu-val">한국어</span>
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
          <MenuRow icon={<Icon.doc />} label={lang === "ko" ? "앱 버전" : "App version"} value="0.1.0" last />
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
