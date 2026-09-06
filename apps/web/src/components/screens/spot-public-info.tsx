"use client";
import { useUiText } from "@/components/use-ui-text";
import {
  ExternalLink,
  ExternalPhotoIndicator,
  externalPhotoLinkClass,
} from "@/components/external-link";
import { useState } from "react";
import Image from "next/image";
import type { Spot } from "@/domain/types";

export function SpotPublicInfo({ spot }: { spot: Spot }) {
  const translateUi = useUiText();
  const [fullForecast, setFullForecast] = useState(false);
  const forecast = spot.crowdForecast;
  const best = forecast?.days.reduce((a, b) => (b.rate < a.rate ? b : a));
  const days = forecast?.days.slice(0, fullForecast ? 30 : 7) ?? [];
  const info = spot.visitInfo;
  const facts = [
    ["주소", info?.address],
    ["이용 시간", info?.hours],
    ["쉬는 날", info?.closed],
    ["이용 요금", info?.fees],
    ["주차", info?.parking],
    ["문의", info?.phone],
  ].filter(([, v]) => v);
  if (!forecast && !spot.hasAccessibilityInfo && !facts.length && !spot.photos?.length) {
    return null;
  }
  return (
    <section className="spot-public-info" aria-label={translateUi("관광지 방문 정보")}>
      {forecast && (
        <div className="card public-info-card">
          <div className="section-label">{translateUi("한국관광공사 · 일별 예측")}</div>
          <h2>{translateUi("언제 가면 여유로울까요?")}</h2>
          <p className="section-description">
            {translateUi(
              best &&
                `${Number(best.date.slice(5, 7))}월 ${Number(best.date.slice(8))}일이 제공된 ${forecast.days.length}일 중 가장 낮은 집중률을 보여요.`,
            )}
          </p>
          <div className="forecast-bars" aria-label={translateUi("일별 예상 집중률")}>
            {days.map((day) => (
              <div
                className="forecast-day"
                key={day.date}
                aria-label={translateUi(`${day.date} 집중률 ${day.rate.toFixed(1)}`)}
              >
                <span className="forecast-value">{translateUi(Math.round(day.rate))}</span>
                <div className="forecast-track">
                  <div style={{ height: `${Math.max(day.rate, 2)}%` }} />
                </div>
                <span>
                  {translateUi(Number(day.date.slice(5, 7)))}/
                  {translateUi(Number(day.date.slice(8)))}
                </span>
              </div>
            ))}
          </div>
          {forecast.days.length > 7 && (
            <button
              className="btn btn-secondary btn-sm"
              aria-expanded={fullForecast}
              onClick={() => setFullForecast(!fullForecast)}
            >
              {translateUi(fullForecast ? "7일만 보기" : "30일 예측 보기")}
            </button>
          )}
          <p className="data-caption">
            {translateUi(
              "장소별 상대 집중률(0–100) 예측입니다. 현장 인원이나 수용률을 뜻하지 않으며, 시간대별 자체 추정과 기준이 달라요.",
            )}
          </p>
        </div>
      )}
      {spot.hasAccessibilityInfo && (
        <div className="card public-info-card" aria-label={translateUi("무장애 여행 안내")}>
          <div className="section-label">{translateUi("한국관광공사 · 무장애 여행정보")}</div>
          <h2>{translateUi("함께 가기 전 확인할 편의시설")}</h2>
          {spot.accessibility?.items.length ? (
            <dl className="visit-facts">
              {spot.accessibility.items.map((item) => (
                <div key={item.key}>
                  <dt>{translateUi(item.label)}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>{translateUi("상세 안내를 현재 확인할 수 없어요. 시설에 직접 문의해 주세요.")}</p>
          )}
          <p className="data-caption">
            {translateUi(
              "안내가 있다고 모든 구간을 이용할 수 있는 것은 아니에요. 경사·계단·대여 조건을 살펴보고 필요한 지원을 방문 전에 시설에 확인하세요. 표시되지 않은 항목은 정보가 없는 상태입니다.",
            )}
          </p>
        </div>
      )}
      {facts.length > 0 && (
        <div className="card public-info-card">
          <div className="section-label">{translateUi("방문 전에 확인하세요")}</div>
          <h2>{translateUi("이용 안내")}</h2>
          <dl className="visit-facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{translateUi(label)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="data-caption">
            {translateUi("한국관광공사 제공 · 운영시간과 요금은 현장 사정에 따라 바뀔 수 있어요.")}
          </p>
        </div>
      )}
      {!!spot.photos?.length && (
        <details className="card public-info-card photo-disclosure">
          <summary>
            {translateUi("관광지 사진 ")}
            <span>
              {translateUi(spot.photos.length)}
              {translateUi("장")}
            </span>
          </summary>
          <div className="spot-photo-grid">
            {spot.photos.map((photo, i) => (
              <figure key={`${photo.url}-${i}`}>
                <ExternalLink
                  href={photo.url}
                  className={externalPhotoLinkClass}
                  indicatorPlacement="within"
                  aria-label={translateUi(`${photo.label} 원본 사진 보기`)}
                >
                  <Image
                    src={photo.url}
                    alt={photo.label}
                    width={600}
                    height={400}
                    sizes="(max-width: 599px) 90vw, 360px"
                    style={{ width: "100%", height: 180, objectFit: "contain" }}
                  />
                  <ExternalPhotoIndicator />
                </ExternalLink>
                <figcaption>
                  {photo.label}
                  {translateUi(" · 한국관광공사")}
                  {translateUi(
                    photo.license ? ` · 공공누리 ${photo.license.replace("Type", "")}유형` : "",
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
