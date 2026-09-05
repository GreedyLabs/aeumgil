import Link from "next/link";
import type { RegionalVisitors } from "@/domain/types";
export function RegionVisitors({ snapshot }: { snapshot: RegionalVisitors | null }) {
  if (!snapshot)
    return (
      <div className="empty-state card">
        <h2>지역 방문 통계를 확인하고 있어요</h2>
        <p>공개된 통계를 받으면 이곳에서 권역별 방문 규모를 볼 수 있어요.</p>
      </div>
    );
  return (
    <section aria-label="지역 방문 통계">
      <div className="results-heading">
        <h2>지역별 방문 규모</h2>
        <span>{snapshot.date} 표본일 기준</span>
      </div>
      <p className="section-description">
        여행 권역을 비교할 때 참고하세요. 공개 시차가 있는 이동통신 기반 추정 통계로, 현재
        혼잡도와는 달라요.
      </p>
      <div className="region-visitor-grid">
        {snapshot.regions.map((region) => (
          <article className="card public-info-card" key={region.key}>
            <h3>{region.name.ko}</h3>
            <dl className="visit-facts">
              <div>
                <dt>외지인</dt>
                <dd>{Math.round(region.domestic).toLocaleString("ko-KR")}명</dd>
              </div>
              <div>
                <dt>외국인</dt>
                <dd>{Math.round(region.foreign).toLocaleString("ko-KR")}명</dd>
              </div>
            </dl>
            <Link className="text-link" href={`/map?region=${encodeURIComponent(region.name.ko)}`}>
              {region.name.ko} 지도에서 보기 →
            </Link>
          </article>
        ))}
      </div>
      <p className="data-caption">
        출처: 한국관광공사 지역별 방문자수. 현지인은 제외해 구분 표시하며, 시군구끼리 합산하지
        않습니다. 인원 규모만으로 지역의 혼잡도를 판단하지 않아요.
      </p>
    </section>
  );
}
