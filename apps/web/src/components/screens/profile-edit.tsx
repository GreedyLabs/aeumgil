"use client";

// 프로필 편집은 표시명·소개만 저장하며 여행 취향은 별도 화면에서 관리한다.
import Link from "next/link";
import { useState, useTransition } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { updateProfileAction } from "@/app/actions/profile";
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { Icon } from "./_ui";
import styles from "./travel-preferences.module.css";
import { Avatar } from "./avatar";
import type { User } from "@/domain/types";

interface Props {
  user: User;
}

export function ProfileEditView({ user }: Props) {
  const ready = useHydrated();
  const { lang, showToast } = useAppState();
  const { back } = useAppNav();
  const [name, setName] = useState(localized(user.name, lang));
  const [bio, setBio] = useState(localized(user.bio, lang));
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      try {
        const res = await updateProfileAction({ displayName: name, bio });
        if (!res.ok) {
          showToast(res.error);
          return;
        }
        back();
        showToast("프로필을 저장했어요");
      } catch {
        showToast("프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <div className="screen-enter form-page">
      <div className="topbar elev">
        <button className="icon-btn" onClick={back} aria-label="뒤로 가기">
          <Icon.back />
        </button>
        <h1>{lang === "ko" ? "프로필 편집" : "Edit profile"}</h1>
        <button
          className="link-sm"
          style={{ fontWeight: 700, color: "var(--brand)", minWidth: 44, minHeight: 44 }}
          onClick={save}
          disabled={!ready || isPending || name.trim().length === 0}
        >
          {isPending ? (lang === "ko" ? "저장 중" : "Saving") : lang === "ko" ? "저장" : "Save"}
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 8px" }}>
        <div style={{ position: "relative" }}>
          <Avatar
            className="avatar-lg"
            src={user.avatarUrl}
            name={localized(user.name, lang)}
            size={86}
          />
        </div>
      </div>

      <p style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12 }}>
        프로필 사진은 연결한 로그인 계정에서 관리해요.
      </p>
      <div style={{ padding: "12px 20px 0" }}>
        <label htmlFor="profile-name" className="field-label">
          {lang === "ko" ? "닉네임" : "Nickname"}
        </label>
        <input
          id="profile-name"
          className="field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          disabled={!ready || isPending}
        />

        <label htmlFor="profile-bio" className="field-label" style={{ marginTop: 18 }}>
          {lang === "ko" ? "한 줄 소개" : "Bio"}
        </label>
        <textarea
          id="profile-bio"
          className="field-input"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={80}
          disabled={!ready || isPending}
          style={{ resize: "none", lineHeight: 1.5 }}
        />
        <div
          style={{ textAlign: "right", fontSize: 11, color: "var(--ink-4)", marginTop: 4 }}
          className="mono"
        >
          {bio.length}/80
        </div>
      </div>

      <section className={styles.linkedSetting}>
        <strong>여행 취향은 따로 관리해요</strong>
        <p>관심 분야와 여행 페이스, 동행을 바꿔도 닉네임·소개에는 영향을 주지 않아요.</p>
        <Link className="text-link" href="/onboarding">
          여행 취향 설정 <Icon.chevR />
        </Link>
      </section>
    </div>
  );
}
