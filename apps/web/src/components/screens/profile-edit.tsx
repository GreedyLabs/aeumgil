"use client";

// 세션에 연결된 앱 프로필과 관심 테마를 저장한다.
import { useState, useTransition } from "react";
import { updateProfileAction } from "@/app/actions/profile";
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import { Avatar } from "./avatar";
import type { Theme, User } from "@/domain/types";

interface Props {
  user: User;
  themes: Theme[];
}

export function ProfileEditView({ user, themes }: Props) {
  const { lang, showToast } = useAppState();
  const { back } = useAppNav();
  const [name, setName] = useState(localized(user.name, lang));
  const [bio, setBio] = useState(localized(user.bio, lang));
  const [interests, setInterests] = useState<string[]>(user.interests);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = () => {
    startTransition(async () => {
      const res = await updateProfileAction({
        displayName: name,
        bio,
        interestThemeIds: interests,
      });
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      back();
      showToast("프로필을 저장했어요");
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
          disabled={isPending || name.trim().length === 0 || interests.length === 0}
        >
          {isPending ? (lang === "ko" ? "저장 중" : "Saving") : lang === "ko" ? "저장" : "Save"}
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 8px" }}>
        <div style={{ position: "relative" }}>
          <Avatar className="avatar-lg" src={user.avatarUrl} size={86} />

        </div>
      </div>

      <p style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12 }}>프로필 사진은 연결한 로그인 계정에서 관리해요.</p>
      <div style={{ padding: "12px 20px 0" }}>
        <label htmlFor="profile-name" className="field-label">{lang === "ko" ? "닉네임" : "Nickname"}</label>
        <input id="profile-name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} disabled={isPending} />

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
          disabled={isPending}
          style={{ resize: "none", lineHeight: 1.5 }}
        />
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--ink-4)", marginTop: 4 }} className="mono">
          {bio.length}/80
        </div>
      </div>

      <div style={{ padding: "14px 20px 28px" }}>
        <label className="field-label">{lang === "ko" ? "관심 테마" : "Interests"}</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {themes.map((th) => {
            const on = interests.includes(th.id);
            return (
              <button
                key={th.id}
                className={"chip" + (on ? " active" : "")}
                onClick={() => toggle(th.id)}
                aria-pressed={on}
                disabled={isPending}
                style={{ padding: "9px 14px", fontSize: 13 }}
              >
                {on && <Icon.check style={{ width: 13, height: 13 }} />}
                {localized(th.title, lang)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
