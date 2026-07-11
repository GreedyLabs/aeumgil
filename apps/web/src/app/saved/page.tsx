import { SavedView } from "@/components/screens/saved";
import { getRepository } from "@/data";
import { congestionNow, nowKst } from "@/data/live/congestion-now";
import type { Spot } from "@/domain/types";
import { requireUserSession } from "@/server/require-session";

// 저장 테마는 Repository 로 일원화(live: 세션→DB). 최근 본 곳은 목록 카드라 실시간 보강 없이 조회한다.
const RECENT_SPOT_IDS = ["sacheon-beach", "woljeongsa-trail", "dongmyeong-port"];

export default async function SavedPage() {
  await requireUserSession("save");
  const repo = getRepository();
  const savedRefs = await repo.listSavedThemes();
  const at = nowKst();

  const savedRaw = await Promise.all(
    savedRefs.map(async ({ themeId, savedAt }) => {
      const [theme, course] = await Promise.all([repo.getTheme(themeId), repo.getCourse(themeId)]);
      // 카드 Signal 용 대표 스팟(코스 첫 spot 항목) 혼잡 — 목록 화면이라 enrich 없이 시각 기반 모델(§4.3)
      const firstSpotId = course?.items.find((i) => i.kind === "spot")?.refId;
      const spot = firstSpotId ? await repo.getSpot(firstSpotId, { enrich: false }) : null;
      return { theme, course, savedAt, congestion: spot ? congestionNow(spot, at) : null };
    }),
  );
  const saved = savedRaw
    .filter((x) => x.theme !== null)
    .map((x) => ({ theme: x.theme!, course: x.course, savedAt: x.savedAt, congestion: x.congestion }));

  const recentSpots = (await Promise.all(RECENT_SPOT_IDS.map((id) => repo.getSpot(id, { enrich: false })))).filter(
    (s): s is Spot => s !== null,
  );

  return <SavedView saved={saved} recentSpots={recentSpots} />;
}
