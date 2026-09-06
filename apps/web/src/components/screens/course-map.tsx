"use client";
import { useLanguage } from "@/components/language-context";
import { uiText } from "@/lib/i18n";
import { useUiText } from "@/components/use-ui-text";
import { ExternalLink, externalLinkIconHtml } from "@/components/external-link";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { CourseMapStop, CourseRouteLeg } from "@/domain/course-map";

export function CourseMap({
  stops,
  legs,
  day,
}: {
  stops: CourseMapStop[];
  legs: CourseRouteLeg[];
  day: number;
}) {
  const translateUi = useUiText();
  const lang = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSelected(0);
    void import("leaflet")
      .then((L) => {
        if (cancelled || !container.current || !stops.length) return;
        const instance = L.map(container.current, {
          scrollWheelZoom: false,
          dragging: !L.Browser.mobile,
          touchZoom: true,
        });
        map.current = instance;
        const externalNotice = uiText("외부 사이트, 새 탭에서 열림", lang);
        instance.attributionControl.setPrefix(
          `<a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer" aria-label="Leaflet (${externalNotice})" title="${externalNotice}">Leaflet${externalLinkIconHtml}</a>`,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: `© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" aria-label="OpenStreetMap (${externalNotice})" title="${externalNotice}">OpenStreetMap${externalLinkIconHtml}</a> ${lang === "ko" ? "기여자" : "contributors"}`,
        }).addTo(instance);
        stops.forEach((stop, i) => {
          const popup = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = `${i + 1}. ${stop.name}`;
          popup.append(title);
          const time = document.createElement("p");
          time.textContent = `${stop.time} · ${uiText("방문 예정", lang)}`;
          popup.append(time);
          const icon = L.divIcon({
            className: "itinerary-pin",
            html: `<span>${i + 1}</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
          L.marker([stop.lat, stop.lon], {
            icon,
            title: `${i + 1}. ${stop.name}`,
            alt: `${stop.name} · ${uiText("위치", lang)}`,
          })
            .bindPopup(popup)
            .on("click", () => setSelected(i))
            .addTo(instance);
          const next = stops[i + 1];
          if (!next) return;
          const leg = legs.find((l) => l.fromId === stop.id && l.toId === next.id);
          const road = leg?.path && leg.path.length > 1;
          const coordinates: [number, number][] = road
            ? leg.path!.map((p) => [p.lat, p.lon])
            : [
                [stop.lat, stop.lon],
                [next.lat, next.lon],
              ];
          L.polyline(coordinates, {
            color: "#167b83",
            weight: 4,
            opacity: 0.85,
            dashArray: road ? undefined : "7 9",
          }).addTo(instance);
        });
        instance.fitBounds(L.latLngBounds(stops.map((s) => [s.lat, s.lon])), {
          padding: [40, 40],
          maxZoom: 14,
        });
        const observer = new ResizeObserver(() => instance.invalidateSize());
        observer.observe(container.current);
        instance.once("unload", () => observer.disconnect());
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [stops, legs, lang]);
  if (!stops.length) return null;
  const total = legs.reduce((sum, leg) => sum + leg.minutes, 0);
  const allRoad = legs.length > 0 && legs.every((l) => l.path && l.path.length > 1);
  return (
    <section className="course-route-map card" aria-label={translateUi(`Day ${day} 동선 지도`)}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            Day {translateUi(day)}
            {translateUi(" · 방문 순서와 이동")}
          </span>
          <h2>{translateUi("하루 동선 한눈에")}</h2>
        </div>
        <span className="route-total">
          {translateUi(stops.length)}
          {translateUi("곳")}
          {translateUi(total > 0 ? ` · 이동 약 ${total}분` : "")}
        </span>
      </div>
      <p className="section-description">
        {translateUi(
          allRoad
            ? "자동차 길찾기로 조회한 도로 경로예요."
            : "점선은 장소의 방문 순서를 이은 선이며 실제 도로 경로가 아니에요.",
        )}
        {translateUi(" ")}
        {translateUi("숫자를 누르면 장소를 확인할 수 있어요.")}
      </p>
      <div
        className="itinerary-map-canvas"
        ref={container}
        role="region"
        aria-label={translateUi("방문 순서 지도")}
      />
      {failed && (
        <p role="status">
          {translateUi("지도를 불러오지 못했어요. 아래 순서와 이동 안내를 확인해 주세요.")}
        </p>
      )}
      <details className="route-leg-details">
        <summary>
          {translateUi("구간별 이동·길찾기 ")}
          <span>
            {translateUi(stops.length)}
            {translateUi("곳")}
          </span>
        </summary>
        <ol className="route-stop-list">
          {stops.map((stop, i) => {
            const next = stops[i + 1];
            const leg = legs.find((l) => l.fromId === stop.id && l.toId === next?.id);
            return (
              <li key={`${stop.id}-${i}`}>
                <button
                  aria-pressed={selected === i}
                  onClick={() => {
                    setSelected(i);
                    map.current?.panTo([stop.lat, stop.lon]);
                  }}
                >
                  <span className="route-order">{translateUi(i + 1)}</span>
                  <strong>{translateUi(stop.name)}</strong>
                  <small>{translateUi(stop.time)}</small>
                </button>
                {next && (
                  <div className="route-leg">
                    {translateUi(
                      leg
                        ? `약 ${leg.minutes}분 · ${leg.distanceKm.toFixed(1)}km${leg.source === "approx" ? " (좌표 기반 추정)" : " (자동차 경로 조회)"}`
                        : "구간 이동 정보 확인 필요",
                    )}
                    <ExternalLink
                      href={`https://map.kakao.com/link/from/${encodeURIComponent(stop.name)},${stop.lat},${stop.lon}/to/${encodeURIComponent(next.name)},${next.lat},${next.lon}`}
                    >
                      {translateUi("길찾기")}
                    </ExternalLink>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}
