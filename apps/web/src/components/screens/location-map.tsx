"use client";

/** 공개 관광지 좌표만 사용한다. 이용자의 현재 위치는 요청하거나 전송하지 않는다. */
export function LocationMap({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const bbox = [lon - 0.025, lat - 0.018, lon + 0.025, lat + 0.018].join(",");
  const params = new URLSearchParams({ bbox, layer: "mapnik", marker: `${lat},${lon}` });
  return (
    <div className="location-map">
      <iframe
        key={`${lat}:${lon}`}
        title={`${name} 위치 지도`}
        src={`https://www.openstreetmap.org/export/embed.html?${params}`}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <a
        className="map-credit"
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        © OpenStreetMap 기여자 · 큰 지도 보기 ↗
      </a>
    </div>
  );
}
