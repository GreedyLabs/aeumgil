"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOnboardingPreferenceAction } from "@/app/actions/onboarding";
import { useAppState } from "@/components/app-shell";
import { Select } from "@/components/select";
import { TRAVEL_INTERESTS, normalizeTravelPreference } from "@/domain/travel-preferences";
import { localized } from "@/lib/i18n";
import { useHydrated } from "@/lib/use-hydrated";
import type { Companion, OnboardingPreference, Pace } from "@/domain/types";
import { Icon, UI } from "./_ui";
import styles from "./travel-preferences.module.css";

interface Props {
  preference: OnboardingPreference | null;
  paces: Pace[];
  companions: Companion[];
}

export function OnboardingView({ preference, paces, companions }: Props) {
  const { lang, showToast } = useAppState();
  const router = useRouter();
  const ready = useHydrated();
  const initial = normalizeTravelPreference(preference);
  const [interests, setInterests] = useState(initial?.interestThemeIds ?? []);
  const [pace, setPace] = useState(initial?.paceId ?? "");
  const [companion, setCompanion] = useState(initial?.companionId ?? "");
  const [saved, setSaved] = useState(
    JSON.stringify({ interestThemeIds: interests, paceId: pace, companionId: companion }),
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const input = { interestThemeIds: interests, paceId: pace, companionId: companion };
  const dirty = JSON.stringify(input) !== saved;
  const selected = TRAVEL_INTERESTS.filter((interest) => interests.includes(interest.id));

  const save = () => {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await setOnboardingPreferenceAction(input);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSaved(JSON.stringify(input));
        setMessage("여행 취향을 저장했어요. 다음 검색과 추천 코스부터 반영돼요.");
        showToast("여행 취향을 저장했어요");
        router.refresh();
      } catch {
        setError("여행 취향을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <div className={`screen-enter ${styles.page}`}>
      <UI.TopBar title="여행 취향 설정" onBack={() => router.push("/profile")} />
      <header className="page-heading">
        <div>
          <span className="eyebrow">이번 여행의 조건이 먼저예요</span>
          <h1>나에게 맞는 여행의 기본값</h1>
          <p>
            평소 좋아하는 여행을 기억해 둘게요. 모든 항목은 선택 사항이고, 언제든 바꿀 수 있어요.
          </p>
        </div>
      </header>
      <div className={styles.effect}>
        <Icon.sparkle />
        <div>
          <strong>이렇게 반영돼요</strong>
          <p>
            관심 분야는 검색 조건이 같은 후보의 순서를 정할 때 참고해요. 페이스와 동행은 추천
            코스에서 따로 지정하지 않은 경우에만 적용해요.
          </p>
          <p>
            검색에 적은 조건과 코스에서 직접 바꾼 값이 항상 우선해요. 혼잡도·이용 가능 여부를
            보장하는 설정은 아니에요.
          </p>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        className={styles.form}
      >
        <fieldset disabled={!ready || isPending} className={styles.fieldset}>
          <legend>관심 있는 여행</legend>
          <p className={styles.help}>
            지역별 코스를 하나씩 고를 필요 없이 좋아하는 분야를 선택하세요. 복수 선택할 수 있어요.
          </p>
          <div className={styles.interestGrid}>
            {TRAVEL_INTERESTS.map((interest) => {
              const on = interests.includes(interest.id);
              return (
                <button
                  type="button"
                  key={interest.id}
                  aria-pressed={on}
                  className={styles.interest}
                  onClick={() => {
                    setInterests((ids) =>
                      on ? ids.filter((id) => id !== interest.id) : [...ids, interest.id],
                    );
                    setMessage("");
                  }}
                >
                  <span className={styles.mark} aria-hidden="true">
                    {on ? <Icon.check /> : null}
                  </span>
                  <span>
                    <strong>{localized(interest.label, lang)}</strong>
                    <small>{localized(interest.description, lang)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset disabled={!ready || isPending} className={styles.fieldset}>
          <legend>코스를 만들 때 참고할 조건</legend>
          <div className={styles.options}>
            <label>
              여행 페이스
              <Select
                aria-label="여행 페이스"
                value={pace}
                onChange={(event) => {
                  setPace(event.target.value);
                  setMessage("");
                }}
              >
                <option value="">그때그때 정할게요</option>
                {paces.map((item) => (
                  <option value={item.id} key={item.id}>
                    {localized(item.name, lang)}
                  </option>
                ))}
              </Select>
              <small>
                {paces.find((item) => item.id === pace)?.desc
                  ? localized(paces.find((item) => item.id === pace)!.desc!, lang)
                  : "코스마다 장소 수와 이동 여유를 조절할 수 있어요."}
              </small>
            </label>
            <label>
              주로 함께 여행하는 사람
              <Select
                aria-label="주로 함께 여행하는 사람"
                value={companion}
                onChange={(event) => {
                  setCompanion(event.target.value);
                  setMessage("");
                }}
              >
                <option value="">그때그때 정할게요</option>
                {companions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {localized(item.name, lang)}
                  </option>
                ))}
              </Select>
              <small>이번 여행에 다른 동행이 있다면 검색이나 코스 조건에 적어 주세요.</small>
            </label>
          </div>
        </fieldset>
        <div className={styles.footer}>
          <div>
            <p className={styles.help}>
              {selected.length
                ? `선택한 관심 분야 ${selected.length}개`
                : "관심 분야를 지정하지 않았어요."}
              {dirty ? " · 저장 전" : preference ? " · 저장한 설정" : ""}
            </p>
            <button
              type="button"
              className="text-link"
              disabled={!ready || isPending || (!interests.length && !pace && !companion)}
              onClick={() => {
                setInterests([]);
                setPace("");
                setCompanion("");
                setMessage("");
              }}
            >
              선택 비우기
            </button>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!ready || isPending || (!dirty && Boolean(preference))}
          >
            {isPending ? "저장 중…" : "여행 취향 저장"}
          </button>
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {message && (
          <p role="status" className={styles.success}>
            {message}
          </p>
        )}
      </form>
      <Link className="text-link" href="/profile">
        프로필로 돌아가기 <Icon.chevR />
      </Link>
    </div>
  );
}
