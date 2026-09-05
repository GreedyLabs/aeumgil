"use client";
import { useState } from "react";
import Image from "next/image";
import type { Spot } from "@/domain/types";

export function SpotPublicInfo({ spot }: { spot: Spot }) {
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
  return (
    <section className="spot-public-info" aria-label="관광지 방문 정보">
      {forecast && (
        <div className="card public-info-card">
          <div className="section-label">한국관광공사 · 일별 예측</div>
          <h2>언제 가면 여유로울까요?</h2>
          <p className="section-description">
            {best &&
              `${Number(best.date.slice(5, 7))}월 ${Number(best.date.slice(8))}일이 제공된 ${forecast.days.length}일 중 가장 낮은 집중률을 보여요.`}
          </p>
          <div className="forecast-bars" aria-label="일별 예상 집중률">
            {days.map((day) => (
              <div
                className="forecast-day"
                key={day.date}
                aria-label={`${day.date} 집중률 ${day.rate.toFixed(1)}`}
              >
                <span className="forecast-value">{Math.round(day.rate)}</span>
                <div className="forecast-track">
                  <div style={{ height: `${Math.max(day.rate, 2)}%` }} />
                </div>
                <span>
                  {Number(day.date.slice(5, 7))}/{Number(day.date.slice(8))}
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
              {fullForecast ? "7일만 보기" : "30일 예측 보기"}
            </button>
          )}
          <p className="data-caption">
            장소별 상대 집중률(0–100) 예측입니다. 현장 인원이나 수용률을 뜻하지 않으며, 시간대별
            자체 추정과 기준이 달라요.
          </p>
        </div>
      )}
      {!!spot.highways?.length && (
        <details className="card public-info-card photo-disclosure">
          <summary>
            강원 연결 고속도로 <span>실시간 소통</span>
          </summary>
          <p className="data-caption">
            고속도로 전 구간 관측값입니다. 현재 코스의 실제 경로·소요시간과는 다릅니다.
          </p>
          {spot.highways.map((road) => (
            <div className="road-condition" key={road.route}>
              <h3>{road.route}</h3>
              <p>
                40km/h 미만 관측 구간 <strong>{road.slowSegments}곳</strong>
              </p>
              {!!road.slow.length && (
                <ul>
                  {road.slow.map((x, i) => (
                    <li key={`${x.name}-${i}`}>
                      {x.name} · 최저 {x.speed}km/h
                    </li>
                  ))}
                </ul>
              )}
              <p className="data-caption">
                {new Date(road.observedAt).toLocaleTimeString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                관측 · 한국도로공사
              </p>
            </div>
          ))}
        </details>
      )}
      {facts.length > 0 && (
        <div className="card public-info-card">
          <div className="section-label">방문 전에 확인하세요</div>
          <h2>이용 안내</h2>
          <dl className="visit-facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="data-caption">
            한국관광공사 제공 · 운영시간과 요금은 현장 사정에 따라 바뀔 수 있어요.
          </p>
        </div>
      )}
      {!!spot.photos?.length && (
        <details className="card public-info-card photo-disclosure">
          <summary>
            관광지 사진 <span>{spot.photos.length}장</span>
          </summary>
          <div className="spot-photo-grid">
            {spot.photos.map((photo, i) => (
              <figure key={`${photo.url}-${i}`}>
                <a
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${photo.label} 원본 사진 새 창에서 보기`}
                >
                  <Image
                    src={photo.url}
                    alt={photo.label}
                    width={600}
                    height={400}
                    sizes="(max-width: 599px) 90vw, 360px"
                    style={{ width: "100%", height: 180, objectFit: "contain" }}
                  />
                </a>
                <figcaption>
                  {photo.label} · 한국관광공사
                  {photo.license ? ` · 공공누리 ${photo.license.replace("Type", "")}유형` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
