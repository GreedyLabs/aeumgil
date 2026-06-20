"use client";

// OnboardingView — Phase 4(부분). 3단계 온보딩(관심사→스타일→완료). 저장은 mock.
import { useState } from "react";
import { localized } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import type { Companion, Pace, Theme } from "@/domain/types";

interface Props {
  themes: Theme[];
  paces: Pace[];
  companions: Companion[];
}

export function OnboardingView({ themes, paces, companions }: Props) {
  const { lang, showToast } = useAppState();
  const { nav } = useAppNav();

  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>(["quiet-inland"]);
  const [pace, setPace] = useState("calm");
  const [companion, setCompanion] = useState("couple");

  const STEPS = 3;
  const toggleInterest = (id: string) =>
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const finish = () => {
    showToast("관심사를 저장했어요");
    nav("home");
  };
  const next = () => (step < STEPS - 1 ? setStep(step + 1) : finish());
  const canNext = step === 0 ? interests.length > 0 : true;

  const selectedTags = interests
    .map((id) => themes.find((t) => t.id === id))
    .filter((t): t is Theme => !!t)
    .map((t) => localized(t.tag, lang));
  const paceName = paces.find((p) => p.id === pace);
  const companionName = companions.find((c) => c.id === companion);

  return (
    <div className="screen-enter" style={{ minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <div className="onb-top">
        <button className="onb-back" onClick={() => (step === 0 ? finish() : setStep(step - 1))}>
          {step === 0 ? <Icon.close /> : <Icon.back />}
        </button>
        <div className="onb-progress">
          {Array.from({ length: STEPS }).map((_, i) => (
            <span key={i} className={"onb-dot" + (i <= step ? " on" : "")} />
          ))}
        </div>
        <button className="onb-skip" onClick={finish}>
          {lang === "ko" ? "건너뛰기" : "Skip"}
        </button>
      </div>

      <div style={{ flex: 1, padding: "8px 22px 0", overflowY: "auto" }}>
        {step === 0 && (
          <div className="onb-step">
            <div className="onb-kicker">{lang === "ko" ? "01 · 관심사" : "01 · Interests"}</div>
            <h1 className="serif onb-title" style={{ whiteSpace: "pre-line" }}>
              {lang === "ko" ? "어떤 강원도에\n끌리세요?" : "What draws you\nto Gangwon?"}
            </h1>
            <p className="onb-sub">
              {lang === "ko" ? "관심 테마를 골라주세요. 추천에 반영돼요. (복수 선택)" : "Pick the themes you like — we tailor picks to them."}
            </p>
            <div className="onb-grid">
              {themes.map((th) => {
                const on = interests.includes(th.id);
                return (
                  <button key={th.id} className={"onb-card" + (on ? " on" : "")} onClick={() => toggleInterest(th.id)}>
                    <div className="onb-card-img" style={{ backgroundImage: `url(${UI.imgFor("theme:" + th.id)})` }} />
                    <div className="onb-card-scrim" />
                    {on && (
                      <span className="onb-check">
                        <Icon.check style={{ width: 14, height: 14 }} />
                      </span>
                    )}
                    <div className="onb-card-body">
                      <div style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85 }}>{localized(th.tag, lang)}</div>
                      <div className="serif" style={{ fontSize: 16, lineHeight: 1.1, marginTop: 2 }}>
                        {localized(th.title, lang)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onb-step">
            <div className="onb-kicker">{lang === "ko" ? "02 · 여행 스타일" : "02 · Style"}</div>
            <h1 className="serif onb-title" style={{ whiteSpace: "pre-line" }}>
              {lang === "ko" ? "어떻게\n여행하세요?" : "How do you\ntravel?"}
            </h1>
            <p className="onb-sub">
              {lang === "ko" ? "페이스에 맞춰 혼잡한 곳을 거르거나 더해드려요." : "We pace your route by how busy you like it."}
            </p>

            <div className="onb-sect-label">{lang === "ko" ? "여행 페이스" : "Pace"}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {paces.map((p) => (
                <button key={p.id} className={"onb-row" + (pace === p.id ? " on" : "")} onClick={() => setPace(p.id)}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{localized(p.name, lang)}</div>
                    {p.desc && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>{localized(p.desc, lang)}</div>}
                  </div>
                  <span className="onb-radio">{pace === p.id && <Icon.check style={{ width: 13, height: 13 }} />}</span>
                </button>
              ))}
            </div>

            <div className="onb-sect-label" style={{ marginTop: 22 }}>
              {lang === "ko" ? "누구와 함께" : "With whom"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {companions.map((c) => (
                <button
                  key={c.id}
                  className={"chip" + (companion === c.id ? " active" : "")}
                  onClick={() => setCompanion(c.id)}
                  style={{ padding: "10px 16px", fontSize: 14 }}
                >
                  {localized(c.name, lang)}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onb-step" style={{ textAlign: "center", paddingTop: 32 }}>
            <div className="onb-done-mark">
              <Icon.check style={{ width: 30, height: 30 }} />
            </div>
            <h1 className="serif onb-title" style={{ textAlign: "center", whiteSpace: "normal" }}>
              {lang === "ko" ? "준비됐어요" : "You're set"}
            </h1>
            <p className="onb-sub" style={{ textAlign: "center", margin: "8px auto 0", maxWidth: 280 }}>
              {lang === "ko" ? "관심사와 여행 스타일을 반영해 강원도를 추천해 드릴게요." : "We'll tailor Gangwon to your themes and pace."}
            </p>
            <div className="onb-summary">
              <div className="onb-sum-row">
                <span>{lang === "ko" ? "관심 테마" : "Themes"}</span>
                <b>{selectedTags.join(" · ") || "—"}</b>
              </div>
              <div className="onb-sum-row">
                <span>{lang === "ko" ? "페이스" : "Pace"}</span>
                <b>{paceName ? localized(paceName.name, lang) : "—"}</b>
              </div>
              <div className="onb-sum-row">
                <span>{lang === "ko" ? "동행" : "With"}</span>
                <b>{companionName ? localized(companionName.name, lang) : "—"}</b>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="onb-cta">
        <button className="btn btn-primary btn-block" disabled={!canNext} style={{ opacity: canNext ? 1 : 0.45 }} onClick={next}>
          {step < STEPS - 1 ? (lang === "ko" ? "다음" : "Next") : lang === "ko" ? "강원도 둘러보기" : "Explore Gangwon"}
        </button>
      </div>
    </div>
  );
}
