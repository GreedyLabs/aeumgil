import { ExternalLink } from "@/components/external-link";
import { HIGHWAY_ROUTES, emptyHighwayStatus, highwaySpeedLevel } from "@/domain/highway";
import type { HighwaySegment, HighwayStatus } from "@/domain/types";
import styles from "./traffic-overview.module.css";

const speedLabels = { slow: "정체 속도", delayed: "서행 속도", clear: "80 이상" };
const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function ObservationTime({ value }: { value: string }) {
  return <time dateTime={value}>{timeFormat.format(new Date(value))}</time>;
}

function SegmentRow({ segment }: { segment: HighwaySegment }) {
  const level = highwaySpeedLevel(segment.speed);
  return (
    <li className={styles.segment}>
      <div className={styles.segmentBody}>
        <strong>{segment.name.replace(/\s*[-–]\s*/g, " → ")}</strong>
        <small>
          <ObservationTime value={segment.observedAt} /> 관측
        </small>
      </div>
      <div className={`${styles.speed} ${styles[level]}`}>
        <span>{speedLabels[level]}</span>
        <strong>
          {segment.speed}
          <small> km/h</small>
        </strong>
      </div>
    </li>
  );
}

function RoadCard({ road }: { road: HighwayStatus }) {
  const route = HIGHWAY_ROUTES.find((item) => item.code === road.routeCode)!;
  const alerts = road.details.filter((segment) => segment.speed < 80);
  const unknown = road.staleSegments + road.unavailableSegments;
  const clear = road.segments - road.slowSegments - road.delayedSegments;
  const total = road.segments + unknown;
  const level = road.slowSegments ? "slow" : road.delayedSegments ? "delayed" : "clear";
  return (
    <article className={styles.road} aria-label={road.route}>
      <header className={styles.roadHeader}>
        <span className={styles.routeNumber} aria-label={`고속도로 ${route.number}호선`}>
          {route.number}
        </span>
        <div>
          <h3>{road.route}</h3>
          {"scope" in route && <small>{route.scope}</small>}
        </div>
      </header>
      <div className={styles.roadStatus}>
        {road.status === "current" ? (
          <>
            <strong className={styles[level]}>
              {road.slowSegments
                ? `정체 속도 ${road.slowSegments}구간`
                : road.delayedSegments
                  ? `서행 속도 ${road.delayedSegments}구간`
                  : "관측 구간 80km/h 이상"}
            </strong>
            <small>{road.segments}개 구간·방향 관측</small>
          </>
        ) : (
          <>
            <strong>
              {road.status === "stale" ? "최근 관측 갱신 지연" : "현재 관측 정보 없음"}
            </strong>
            <small>
              {road.status === "stale"
                ? "20분이 지난 속도는 표시하지 않아요."
                : "정보가 없다고 원활한 것은 아니에요."}
            </small>
          </>
        )}
      </div>
      <div
        className={styles.bar}
        role="img"
        aria-label={
          road.status === "current"
            ? `관측 구간 수: 40km/h 미만 ${road.slowSegments}, 40 이상 80 미만 ${road.delayedSegments}, 80 이상 ${clear}, 현재 관측 없음 ${unknown}`
            : "현재 관측할 수 있는 구간 없음"
        }
      >
        {total > 0 && road.status === "current" ? (
          <>
            {road.slowSegments > 0 && (
              <span className={styles.barSlow} style={{ flex: road.slowSegments }} />
            )}
            {road.delayedSegments > 0 && (
              <span className={styles.barDelayed} style={{ flex: road.delayedSegments }} />
            )}
            {clear > 0 && <span className={styles.barClear} style={{ flex: clear }} />}
            {unknown > 0 && <span className={styles.barUnknown} style={{ flex: unknown }} />}
          </>
        ) : (
          <span className={styles.barUnknown} style={{ flex: 1 }} />
        )}
      </div>
      {road.status === "current" && (
        <p className={styles.breakdown}>
          <span>
            <i className={styles.barSlow} />
            40 미만 <b>{road.slowSegments}</b>
          </span>
          <span>
            <i className={styles.barDelayed} />
            40–79 <b>{road.delayedSegments}</b>
          </span>
          <span>
            <i className={styles.barClear} />
            80 이상 <b>{clear}</b>
          </span>
        </p>
      )}
      {alerts.length > 0 && (
        <>
          <ul className={styles.segmentList}>
            {alerts.slice(0, 3).map((segment) => (
              <SegmentRow key={segment.id} segment={segment} />
            ))}
          </ul>
          {alerts.length > 3 && (
            <details className={styles.more}>
              <summary>80km/h 미만 {alerts.length - 3}구간 더 보기</summary>
              <ul className={styles.segmentList}>
                {alerts.slice(3).map((segment) => (
                  <SegmentRow key={segment.id} segment={segment} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {road.observedAt && (
        <p className={styles.observed}>
          {road.status === "stale" ? "마지막 관측 " : "관측 기준 "}
          <ObservationTime value={road.observedAt} />
        </p>
      )}
      {unknown > 0 && (
        <p className={styles.observed}>
          현재 판단 제외: {road.staleSegments > 0 && `갱신 지연 ${road.staleSegments}구간`}
          {road.staleSegments > 0 && road.unavailableSegments > 0 && " · "}
          {road.unavailableSegments > 0 && `미측정 ${road.unavailableSegments}구간`}
        </p>
      )}
    </article>
  );
}

export function TrafficOverview({ roads }: { roads: HighwayStatus[] }) {
  const complete = HIGHWAY_ROUTES.map(
    (route) => roads.find((road) => road.routeCode === route.code) || emptyHighwayStatus(route),
  );
  complete.sort((a, b) => b.slowSegments - a.slowSegments || b.delayedSegments - a.delayedSegments);
  return (
    <section
      className={`page-section ${styles.overview}`}
      aria-labelledby="home-traffic-title"
      data-testid="home-traffic"
    >
      <div className={styles.heading}>
        <div>
          <div className="section-label">출발 전, 돌아오는 길에도</div>
          <h2 id="home-traffic-title" className="section-title">
            어느 구간에서 속도가 줄어들까요?
          </h2>
          <p>강원과 연결되는 세 고속도로의 저속 구간부터 확인하세요.</p>
        </div>
        <ExternalLink className="text-link" href="https://www.roadplus.co.kr/">
          도로공사 교통 지도
        </ExternalLink>
      </div>
      <div className={styles.cards}>
        {complete.map((road) => (
          <RoadCard key={road.routeCode} road={road} />
        ))}
      </div>
      <details className={styles.explanation}>
        <summary>속도와 구간 표시 기준</summary>
        <p>
          한국도로공사 관측 자료를 바탕으로, 동일 구간·방향의 여러 검지기 중 최저속도를 표시해요.
          구간 이름의 앞 → 뒤가 진행 방향이며, 노선 전체가 같은 속도라는 뜻은 아니에요.
        </p>
        <p>
          에움길의 표시 기준은 정체 속도 40km/h 미만, 서행 속도 40 이상 80 미만이에요. 막대는 수집된
          구간·방향의 개수 비율이며, 도로의 위치나 정체 길이를 나타내지 않아요.
        </p>
        <p>
          조회 시 최대 5분간 저장된 자료를 사용하고, 관측 후 20분이 지난 속도는 제외해요. 화면은
          표시된 관측시각 기준이에요. 진입로·사고·공사와 실제 이동 경로는 도로공사 교통 지도에서
          확인해 주세요.
        </p>
      </details>
      <p className={styles.source}>
        한국도로공사 제공 · 구간·방향별 최저 관측속도 · 막대는 구간 수 비율
      </p>
    </section>
  );
}

export function TrafficOverviewLoading() {
  return (
    <section
      className={`page-section ${styles.overview}`}
      aria-label="고속도로 교통 정보 불러오기"
      aria-busy="true"
    >
      <h2 className="section-title">출발 전 고속도로 확인</h2>
      <p role="status">구간별 관측 정보를 확인하고 있어요…</p>
    </section>
  );
}
