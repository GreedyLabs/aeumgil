"use client";

import Link from "next/link";
import { useState } from "react";
import { localized } from "@/lib/i18n";
import { useAppState } from "@/components/app-shell";
import { Icon, UI } from "./_ui";
import type { AuthProvider } from "@/domain/types";

const REASON_COPY: Record<string, string> = {
  save: "마음에 든 코스를 저장하려면 로그인해 주세요.",
  course: "내 여행을 이어가려면 로그인해 주세요.",
  review: "다녀온 곳의 이야기를 남기려면 로그인해 주세요.",
  onboarding: "여행 취향을 기억하려면 로그인해 주세요.",
  profile: "내 여행 기록을 확인하려면 로그인해 주세요.",
};

export function LoginView({
  providers,
  reason,
  returnTo,
  error,
}: {
  providers: AuthProvider[];
  reason?: string;
  returnTo?: string;
  error?: string;
}) {
  const { lang, login } = useAppState();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(Boolean(error));
  const reasonCopy = reason ? REASON_COPY[reason] : undefined;
  async function startLogin(providerId: string) {
    setPending(true);
    setFailed(false);
    try {
      await login(providerId, returnTo);
    } catch {
      setFailed(true);
      setPending(false);
    }
  }
  return (
    <div className="login-page screen-enter">
      <UI.TopBar title="로그인" />
      <div className="login-layout">
        <section className="login-story">
          <div>
            <span className="eyebrow">나의 강원 여행</span>
            <h1>
              여행을 이어가요
            </h1>
            <p>
              한적한 바다부터 초록빛 숲길까지.
              <br />
              가고 싶은 곳과 다녀온 순간을 모아보세요.
            </p>
          </div>
          <div className="login-landscape" aria-hidden="true" />
          <div className="login-story-caption">
            <Icon.pin /> 강원에서 찾은, 나만의 에움길
          </div>
        </section>
        <section className="login-card" aria-labelledby="login-title">
          <span className="eyebrow">어서 오세요</span>
          <h2 id="login-title">여행을 이어갈까요?</h2>
          <p className="login-description">
            계정 하나로 여행 코스와 기록을
            <br className="desktop-only" /> 여러 기기에서 함께 볼 수 있어요.
          </p>
          {reasonCopy && (
            <p className="login-reason">
              <Icon.bookmark />
              {reasonCopy}
            </p>
          )}
          <ul className="login-benefits">
            <li>
              <Icon.bookmark />
              <span>마음에 드는 테마와 코스 저장</span>
            </li>
            <li>
              <Icon.pin />
              <span>방문 기록과 나만의 리뷰</span>
            </li>
            <li>
              <Icon.leaf />
              <span>관심 테마와 여행 취향 설정</span>
            </li>
          </ul>
          {failed && (
            <p className="login-error" role="alert">
              로그인을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.
            </p>
          )}
          <div className="login-actions">
            {providers.map((provider) => (
              <button
                className="btn btn-primary btn-block"
                key={provider.id}
                disabled={pending}
                onClick={() => void startLogin(provider.id)}
              >
                {pending
                  ? "로그인 화면으로 이동 중…"
                  : provider.id === "keycloak"
                    ? "로그인 / 회원가입"
                    : localized(provider.label, lang)}
                <Icon.chevR />
              </button>
            ))}
            {!providers.length && (
              <p role="status">로그인을 준비하고 있어요. 여행지는 바로 둘러볼 수 있어요.</p>
            )}
            <Link className="btn btn-secondary btn-block" href="/discover">
              먼저 여행지 둘러보기
            </Link>
          </div>
          <p className="login-account-hint">처음 오셨나요? 다음 화면에서 회원가입할 수 있어요.</p>
          <footer className="login-policy">
            <Link href="/doc?type=terms">이용약관</Link>
            <span aria-hidden="true">·</span>
            <Link href="/doc?type=privacy">개인정보처리방침</Link>
          </footer>
        </section>
      </div>
    </div>
  );
}
