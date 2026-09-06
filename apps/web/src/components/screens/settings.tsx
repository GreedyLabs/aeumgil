"use client";

import { useState } from "react";
import { deleteAccountAction } from "@/app/actions/account";
import { useAppNav } from "@/lib/nav";
import { uiText } from "@/lib/i18n";
import { useAppState } from "@/components/app-shell";
import { LanguagePicker } from "@/components/language-picker";
import styles from "@/components/language-picker.module.css";
import { MenuRow } from "./profile";
import { Icon } from "./_ui";

export function SettingsView() {
  const { lang, setLang, auth, logout, showToast } = useAppState();
  const { nav, back } = useAppNav();
  const [deleting, setDeleting] = useState(false);
  const t = (text: string) => uiText(text, lang);
  const deleteAccount = async () => {
    if (
      !window.confirm(
        t("저장한 여행과 개인 기록이 모두 삭제되며 되돌릴 수 없어요. 정말 탈퇴할까요?"),
      )
    )
      return;
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
        <button className="icon-btn" onClick={back} aria-label={t("뒤로 가기")}>
          <Icon.back />
        </button>
        <h1>{t("설정")}</h1>
        <div style={{ width: 36 }} />
      </div>
      <section className={styles.settings} aria-label={t("언어 설정")}>
        <div className="section-label">{t("서비스 이용")}</div>
        <LanguagePicker lang={lang} onChange={setLang} />
        <p className={styles.settingsNote}>
          {t("일부 관광 정보와 안내는 원문 또는 영어로 표시됩니다.")}
        </p>
        <p className={styles.settingsNote}>
          {t("로그인 화면은 인증 서버가 지원하는 언어로 표시됩니다.")}
        </p>
      </section>
      <div style={{ padding: "20px 20px 0" }}>
        <div className="section-label">{t("약관 및 정보")}</div>
        <div className="menu-group">
          <MenuRow
            icon={<Icon.bell />}
            label={t("공지사항")}
            onClick={() => nav("doc", { doc: "notice" })}
          />
          <MenuRow
            icon={<Icon.headset />}
            label={t("고객센터")}
            onClick={() => nav("doc", { doc: "support" })}
          />
          <MenuRow
            icon={<Icon.doc />}
            label={t("이용약관")}
            onClick={() => nav("doc", { doc: "terms" })}
          />
          <MenuRow
            icon={<Icon.lock />}
            label={t("개인정보처리방침")}
            onClick={() => nav("doc", { doc: "privacy" })}
          />
          <MenuRow
            icon={<Icon.doc />}
            label={t("데이터 출처")}
            onClick={() => nav("doc", { doc: "sources" })}
          />
          <MenuRow icon={<Icon.doc />} label={t("앱 버전")} value="0.1.0" last />
        </div>
      </div>
      {auth.member && (
        <div style={{ padding: "20px 20px 0" }}>
          <div className="menu-group">
            <MenuRow icon={<Icon.logout />} label={t("로그아웃")} onClick={logout} danger />
            <button className="menu-row last" onClick={deleteAccount} disabled={deleting}>
              <span className="menu-lbl" style={{ color: "var(--ink-4)" }}>
                {t(deleting ? "탈퇴 처리 중..." : "회원 탈퇴")}
              </span>
            </button>
          </div>
        </div>
      )}
      <div
        style={{ textAlign: "center", fontSize: 11, color: "var(--ink-4)", padding: "24px 0 28px" }}
      >
        에움길 · Made by GreedyLabs
      </div>
    </div>
  );
}
