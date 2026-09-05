"use client";
import { ExternalLink } from "@/components/external-link";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FestivalDetail } from "@/domain/types";
import { UI, Icon } from "./_ui";
import { LocationMap } from "./location-map";
import { NearbyPlaceCard } from "./nearby-place-card";
import { SpotPublicInfo } from "./spot-public-info";

export function FestivalDetailView({ detail, today }: { detail: FestivalDetail; today: string }) {
  const { event, place } = detail;
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const longDescription = (place.description?.ko.length ?? 0) > 350;
  const status =
    event.endsOn && event.endsOn < today
      ? "종료된 행사"
      : event.startsOn && event.startsOn > today
        ? "예정된 행사"
        : event.startsOn && event.endsOn
          ? "진행 중"
          : "일정 확인 필요";
  const facts = [
    [
      "행사 기간",
      event.startsOn && event.endsOn ? `${event.startsOn} ~ ${event.endsOn}` : "주최 측 확인 필요",
    ],
    ["행사 장소", detail.venue || event.address],
    ["운영 시간", detail.hours],
    ["이용 요금", detail.fees],
    ["주최", detail.host],
    ["문의", detail.phone],
  ].filter(([, value]) => value);
  const create = `/my-courses/add?festival=${event.id}`;
  return (
    <div className="screen-enter festival-detail-page">
      <UI.TopBar
        title="축제·행사"
        right={
          <Link className="text-link" href="/discover?tab=festivals">
            다른 행사 <Icon.chevR />
          </Link>
        }
      />
      <div className="festival-detail-content">
        <header className="festival-detail-header">
          <span className="eyebrow">
            {place.region.ko} · {status}
          </span>
          <h1>{event.name.ko}</h1>
          <p>{event.address}</p>
          <Link className="btn btn-primary" href={create}>
            <Icon.plus /> 내 코스에 담기
          </Link>
        </header>
        {place.imageUrl && (
          <div className="festival-hero">
            <UI.Placeholder label={event.name.ko} src={place.imageUrl} h={330} priority />
            <span className="data-caption">사진 제공: 한국관광공사</span>
          </div>
        )}
        <div className="festival-info-layout">
          <section className="card public-info-card">
            <h2>행사를 만나기 전에</h2>
            <dl className="visit-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {detail.homepage && (
              <ExternalLink className="btn btn-secondary" href={detail.homepage}>
                공식 홈페이지
              </ExternalLink>
            )}
            <p className="data-caption">
              한국관광공사 제공. 시간·요금·예약과 개최 여부는 주최 측의 최신 안내를 확인해 주세요.
            </p>
          </section>
          <section className="card public-info-card">
            <h2>행사장 위치</h2>
            {place.lat !== undefined && place.lon !== undefined ? (
              <LocationMap lat={place.lat} lon={place.lon} name={event.name.ko} />
            ) : (
              <p>등록된 좌표가 없어요. 행사장 주소를 확인해 주세요.</p>
            )}
            <p>{detail.venue || event.address}</p>
          </section>
        </div>
        {place.description?.ko && (
          <section className="card public-info-card">
            <h2>어떤 행사인가요?</h2>
            <p
              id="festival-description"
              className={`festival-description${longDescription && !expanded ? " is-collapsed" : ""}`}
            >
              {place.description.ko}
            </p>
            {longDescription && (
              <button
                className="text-link"
                aria-expanded={expanded}
                aria-controls="festival-description"
                disabled={!ready}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "소개 접기" : "소개 더 보기"} <Icon.chevD />
              </button>
            )}
          </section>
        )}
        <SpotPublicInfo spot={place} />
        <section className="festival-nearby">
          <div className="section-heading">
            <h2>함께 들를 여행지</h2>
            <span className="data-caption">행사장 반경 10km 이내</span>
          </div>
          <div className="commerce-grid">
            {detail.nearbySpots.slice(0, 4).map((spot) => (
              <article className="card festival-nearby-card" key={spot.id}>
                <Link href={`/spot/${spot.id}`}>
                  <UI.Placeholder label={spot.name.ko} src={spot.imageUrl} h={160} />
                </Link>
                <div className="commerce-body">
                  <h3>{spot.name.ko}</h3>
                  <p>{spot.address}</p>
                  {spot.hasAccessibilityInfo && (
                    <span className="accessibility-badge">무장애 안내</span>
                  )}
                  <div className="festival-nearby-actions">
                    <Link className="text-link" href={`/spot/${spot.id}`}>
                      상세 보기 <Icon.chevR />
                    </Link>
                    <Link
                      className="btn btn-secondary btn-sm"
                      href={`${create}&spot=${encodeURIComponent(spot.id)}`}
                    >
                      행사와 함께 담기
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!detail.nearbySpots.length && (
            <p>가까운 등록 여행지가 없어요. 탐색에서 다른 장소를 찾아보세요.</p>
          )}
        </section>
        <section className="festival-nearby">
          <div className="section-heading">
            <h2>근처에서 식사해요</h2>
            <span className="data-caption">행사장 반경 10km 이내</span>
          </div>
          <div className="commerce-grid">
            {detail.nearbyEats.slice(0, 4).map((eat) => (
              <div className="festival-food-card" key={eat.id}>
                <NearbyPlaceCard
                  imageLabel={eat.name.ko}
                  imageUrl={eat.imageUrl}
                  address={eat.address}
                  title={eat.name.ko}
                  category={eat.type.ko}
                  meta=""
                  tone="accent"
                  icon="utensils"
                />
                <Link
                  className="btn btn-secondary btn-block btn-sm"
                  href={`${create}&eat=${encodeURIComponent(eat.id)}`}
                >
                  행사와 식당을 코스에 담기
                </Link>
              </div>
            ))}
          </div>
          {!detail.nearbyEats.length && <p>가까운 등록 음식점 정보가 없어요.</p>}
        </section>
      </div>
    </div>
  );
}
