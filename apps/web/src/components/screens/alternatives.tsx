"use client";
import { useUiText } from "@/components/use-ui-text";
import { useState } from "react";
import { localized, type LocalizedText } from "@/lib/i18n";
import { useAppNav } from "@/lib/nav";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import { NearbyPlaceCard } from "./nearby-place-card";
import type { Spot } from "@/domain/types";

export interface LocalCommerceItem {
  id: string;
  name: LocalizedText;
  type: LocalizedText;
  region: LocalizedText;
  kind: "eat" | "stay";
  imageUrl?: string;
  address?: string;
}

export function AlternativeView({
  original,
  alts,
  localCommerce,
}: {
  original: Spot;
  alts: Spot[];
  localCommerce: LocalCommerceItem[];
}) {
  const translateUi = useUiText();
  const { lang } = useAppState();
  const { nav, back } = useAppNav();
  const [selected, setSelected] = useState(alts[0]?.id ?? "");
  const alt = alts.find((a) => a.id === selected) ?? alts[0];
  const hasScore = (spot: Spot) =>
    spot.conditions?.weather === "available" && spot.conditions?.air === "available";
  const regionalCommerce = localCommerce.filter((it) => it.region.ko === alt?.region.ko);
  const commerce = [
    ...regionalCommerce.filter((it) => it.kind === "eat").slice(0, 3),
    ...regionalCommerce.filter((it) => it.kind === "stay").slice(0, 3),
  ];
  return (
    <div className="screen-enter alternative-page">
      <UI.TopBar title={translateUi("대체지 비교")} onBack={back} right={<div />} />
      <header className="page-heading">
        <div>
          <span className="eyebrow">{translateUi("비슷한 분위기, 새로운 여행")}</span>
          <h1>
            {translateUi(localized(original.name, lang))}
            {translateUi(" 대신")}
            <br />
            {translateUi("이런 곳은 어떠세요?")}
          </h1>
          <p>{translateUi("혼잡도와 방문 여건을 비교하고, 마음에 드는 장소를 선택하세요.")}</p>
        </div>
      </header>
      {!alt ? (
        <div className="empty-state">
          <Icon.discover />
          <h2>{translateUi("가까운 대체지를 찾지 못했어요")}</h2>
          <p>{translateUi("다른 테마에서도 여행지를 찾아볼 수 있어요.")}</p>
          <button className="btn btn-primary" onClick={() => nav("discover")}>
            {translateUi("테마 둘러보기")}
          </button>
        </div>
      ) : (
        <>
          <div className="detail-layout">
            <div className="detail-primary">
              <div className="comparison-grid">
                {[
                  { spot: original, label: "살펴보던 장소" },
                  { spot: alt, label: "선택한 대체지" },
                ].map(({ spot, label }, i) => (
                  <article
                    className={`card comparison-card${i === 1 ? " chosen" : ""}`}
                    key={label}
                  >
                    <UI.Placeholder
                      label={translateUi(localized(spot.name, lang))}
                      src={spot.imageUrl}
                      h={170}
                    />
                    <div>
                      <span className="eyebrow">{translateUi(label)}</span>
                      <h2>{translateUi(localized(spot.name, lang))}</h2>
                      <p>
                        {translateUi(localized(spot.region, lang))} ·{" "}
                        {translateUi(localized(spot.type, lang))}
                      </p>
                      <UI.Signal level={spot.congestion} lang={lang} />
                      <dl className="summary-facts">
                        <div>
                          <dt>{translateUi("방문 적합도")}</dt>
                          <dd>
                            {translateUi(hasScore(spot) ? `${spot.suitability}/100` : "확인 중")}
                          </dd>
                        </div>
                        <div>
                          <dt>{translateUi("추천 체류")}</dt>
                          <dd>
                            {translateUi(
                              spot.durationText ? localized(spot.durationText, lang) : "자유롭게",
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                ))}
              </div>
              <p className="section-description">
                {translateUi(
                  "혼잡도는 모델 추정치예요. 대체지가 항상 더 한산한 것은 아니므로 현재 등급과 날씨를 함께 확인해 주세요.",
                )}
              </p>
            </div>
            <aside className="summary-panel detail-aside">
              <h2>{translateUi("다른 후보 살펴보기")}</h2>
              <div className="card-grid">
                {alts.map((a) => (
                  <button
                    key={a.id}
                    className={`alternative-choice${a.id === alt.id ? " selected" : ""}`}
                    aria-pressed={a.id === alt.id}
                    onClick={() => setSelected(a.id)}
                  >
                    <span>
                      <strong>{translateUi(localized(a.name, lang))}</strong>
                      <small>{translateUi(localized(a.region, lang))}</small>
                    </span>
                    <UI.Signal level={a.congestion} lang={lang} />
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary btn-block"
                style={{ marginTop: 20 }}
                onClick={() => nav("spot", { spotId: alt.id })}
              >
                {translateUi("선택한 대체지 보기 ")}
                <Icon.chevR />
              </button>
            </aside>
          </div>
          <section className="section-block">
            <span className="eyebrow">{translateUi("선택한 대체지와 함께")}</span>
            <h2>
              {translateUi(localized(alt.region, lang))}
              {translateUi("의 음식점 · 숙박")}
            </h2>
            {commerce.length ? (
              <div className="commerce-grid">
                {commerce.map((it) => (
                  <NearbyPlaceCard
                    key={it.id}
                    imageLabel={it.name.ko}
                    imageUrl={it.imageUrl}
                    address={it.address}
                    title={translateUi(localized(it.name, lang))}
                    category={localized(it.type, lang)}
                    meta=""
                    tone={it.kind === "eat" ? "accent" : "brand"}
                    icon={it.kind === "eat" ? "utensils" : "bed"}
                  />
                ))}
              </div>
            ) : (
              <p className="empty-message">
                {translateUi("이 지역의 음식점·숙박 정보를 준비하고 있어요.")}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
