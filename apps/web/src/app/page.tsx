import { Suspense } from "react";
import { HomeView } from "@/components/screens/home";
import { getRepository } from "@/data";
import { congestionNow, nowKst } from "@/data/live/congestion-now";

async function LocalConditions({ spotId }: { spotId: string }) {
  const spot = await getRepository().getSpot(spotId);
  if (!spot) return null;
  const weather = spot.conditions?.weather === "available";
  const air = spot.conditions?.air === "available";
  return <section className="page-section" aria-label="지역 방문 여건">
    <div className="section-label">{spot.region.ko} · {spot.name.ko} 기준</div>
    <div className="conditions-summary card">
      <div><span>날씨 예보</span><strong>{weather ? `${spot.weather.desc.ko} ${spot.weather.tempC}°C` : "확인 중"}</strong><small>{weather ? "기상청 단기예보" : "날씨 정보를 받지 못했어요"}</small></div>
      <div><span>대기질</span><strong>{air ? spot.air.ko : "확인 중"}</strong><small>{air ? `${spot.conditions?.airStation ?? "강원 평균"} · 에어코리아` : "대기질 정보를 받지 못했어요"}</small></div>
      <div><span>여행 전 확인</span><strong>현장 여건 확인</strong><small>혼잡도는 모델 추정치예요</small></div>
    </div>
  </section>;
}

export default async function HomePage() {
  const repo = getRepository();
  const [themes, prompts, spots] = await Promise.all([repo.listThemes(), repo.getSamplePrompts(), repo.listSpots({ enrich: false })]);
  const rank = { calm: 0, moderate: 1, busy: 2 };
  const at = nowKst();
  const bestSpots = spots.map((s) => ({ ...s, congestion: congestionNow(s, at) }))
    .sort((a, b) => rank[a.congestion] - rank[b.congestion] || b.suitability - a.suitability).slice(0, 4);
  return <HomeView themes={themes} prompts={prompts} bestSpots={bestSpots} conditions={bestSpots[0] &&
    <Suspense key="local-conditions" fallback={<div className="page-section" role="status">지역 방문 여건을 확인하고 있어요…</div>}><LocalConditions spotId={bestSpots[0].id} /></Suspense>} />;
}
