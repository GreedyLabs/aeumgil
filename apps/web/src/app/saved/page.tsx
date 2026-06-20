import { SavedView } from "@/components/screens/saved";
import { getRepository } from "@/data";
import type { Spot } from "@/domain/types";

// 저장 목록은 Phase 4 에서 사용자 DB 연동. 지금은 큐레이션 시드.
const SAVED_THEME_IDS = ["quiet-inland", "east-sea-sunrise"];
const RECENT_SPOT_IDS = ["sacheon-beach", "woljeongsa-trail", "dongmyeong-port"];

export default async function SavedPage() {
  const repo = getRepository();

  const savedRaw = await Promise.all(
    SAVED_THEME_IDS.map(async (id) => ({
      theme: await repo.getTheme(id),
      course: await repo.getCourse(id),
    })),
  );
  const saved = savedRaw
    .filter((x) => x.theme !== null)
    .map((x) => ({ theme: x.theme!, course: x.course }));

  const recentSpots = (await Promise.all(RECENT_SPOT_IDS.map((id) => repo.getSpot(id)))).filter(
    (s): s is Spot => s !== null,
  );

  return <SavedView saved={saved} recentSpots={recentSpots} />;
}
