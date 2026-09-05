"use client";

import { useState } from "react";
import Link from "next/link";
import { localized, type LocalizedText } from "@/lib/i18n";
import { useAppState } from "@/components/app-shell";
import { UI, Icon } from "./_ui";
import { LocationMap } from "./location-map";
import type { Congestion } from "@/domain/types";

export interface MapPoi {
  id: string;
  name: LocalizedText;
  lat: number;
  lon: number;
  congestion: Congestion;
  region?: LocalizedText;
  imageUrl?: string;
}

export function MapView({ pois, initialRegion = "" }: { pois: MapPoi[]; initialRegion?: string }) {
  const { lang } = useAppState();
  const [region, setRegion] = useState(initialRegion);
  const [onlyCalm, setOnlyCalm] = useState(false);
  const [selected, setSelected] = useState(pois[0]?.id);
  const filtered = pois.filter(
    (p) => (!onlyCalm || p.congestion === "calm") && (!region || p.region?.ko === region),
  );
  const spot = filtered.find((p) => p.id === selected) ?? filtered[0];
  return (
    <div className="screen-enter map-page">
      <UI.TopBar
        title="여행 지도"
        right={
          <Link href="/discover" className="text-link">
            테마 탐색 <Icon.chevR />
          </Link>
        }
      />
      <header className="page-heading">
        <div>
          <span className="eyebrow">위치와 여유를 함께 살펴보세요</span>
          <h1>지도에서 만나는 강원</h1>
          <p>장소를 선택하면 실제 위치와 주변 도로를 볼 수 있어요.</p>
        </div>
        <button
          className={`chip${onlyCalm ? " active" : ""}`}
          aria-label="여유로운 장소만 보기"
          aria-pressed={onlyCalm}
          onClick={() => setOnlyCalm((v) => !v)}
        >
          <Icon.filter /> 여유로운 곳만
        </button>
      </header>
      <div className="filter-list" aria-label="지도 지역">
        {[
          "",
          ...new Set([
            ...pois.map((p) => p.region?.ko).filter((r): r is string => !!r),
            ...(initialRegion ? [initialRegion] : []),
          ]),
        ].map((r) => (
          <button
            key={r}
            className={`chip${region === r ? " active" : ""}`}
            aria-pressed={region === r}
            onClick={() => setRegion(r)}
          >
            {r || "강원 전체"}
          </button>
        ))}
      </div>
      <div className="map-layout">
        <section className="map-place-list" aria-label="지도에서 볼 장소">
          <div className="results-heading">
            <h2>
              여행 장소 <span>{filtered.length}</span>
            </h2>
          </div>
          {filtered.map((p) => (
            <button
              key={p.id}
              aria-pressed={p.id === spot?.id}
              className={`map-place${p.id === spot?.id ? " selected" : ""}`}
              onClick={() => setSelected(p.id)}
            >
              <UI.Placeholder
                label={localized(p.name, lang)}
                src={p.imageUrl}
                h={60}
                style={{ width: 64, borderRadius: 10, flexShrink: 0 }}
              />
              <span>
                <strong>{localized(p.name, lang)}</strong>
                {p.region && <small>{localized(p.region, lang)}</small>}
                <UI.Signal level={p.congestion} lang={lang} />
              </span>
              <Icon.chevR />
            </button>
          ))}
          {!filtered.length && (
            <div className="empty-state">
              <p>이 조건으로 표시할 관광지가 없어요.</p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setOnlyCalm(false);
                  setRegion("");
                }}
              >
                전체 장소 보기
              </button>
            </div>
          )}
          <p className="section-description">혼잡도는 시간대·요일·계절에 따른 모델 추정치예요.</p>
        </section>
        <section className="map-detail" aria-label="선택한 장소 지도">
          {spot && (
            <>
              <LocationMap lat={spot.lat} lon={spot.lon} name={localized(spot.name, lang)} />
              <div className="map-selection">
                <div>
                  <span className="eyebrow">선택한 장소</span>
                  <h2>{localized(spot.name, lang)}</h2>
                </div>
                <Link className="btn btn-primary" href={`/spot/${spot.id}`}>
                  장소 상세 <Icon.chevR />
                </Link>
              </div>
              <p className="section-description">
                지도 안에서는 확대·축소할 수 있어요. 다른 장소를 보려면 목록에서 선택하세요.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
