import { ExternalLink } from "@/components/external-link";
import type { HighwayStatus } from "@/domain/types";

export function TrafficOverview({ roads }: { roads: HighwayStatus[] }) {
  return (
    <section className="traffic-overview" aria-label="강원 여행 교통 참고">
      <div className="section-heading">
        <h2>강원으로 출발하기 전</h2>
        <ExternalLink className="text-link" href="https://www.roadplus.co.kr/">
          고속도로 교통 지도
        </ExternalLink>
      </div>
      <p className="section-description">
        강원과 연결되는 고속도로의 소통을 살펴보세요. 개별 관광지 진입로나 내 코스의 소요시간을
        나타내지는 않습니다.
      </p>
      <div className="traffic-cards">
        {roads.map((road) => (
          <article className="card" key={road.route}>
            <h3>{road.route}</h3>
            <p>
              <strong>{road.slowSegments}</strong>구간에서 40km/h 미만 관측
            </p>
            <small>
              {road.segments}개 구간·방향 중 ·{" "}
              {new Date(road.observedAt).toLocaleTimeString("ko-KR", {
                timeZone: "Asia/Seoul",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              기준
            </small>
          </article>
        ))}
      </div>
      {!roads.length && (
        <p>현재 소통 정보를 확인할 수 없어요. 고속도로 교통 지도를 확인해 주세요.</p>
      )}
      <p className="data-caption">한국도로공사 제공 · 5분 캐시</p>
    </section>
  );
}
