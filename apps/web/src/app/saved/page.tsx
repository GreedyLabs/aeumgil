import { SavedView } from "@/components/screens/saved";
import { getRepository } from "@/data";
import type { Spot } from "@/domain/types";
import { requireUserSession } from "@/server/require-session";

// 저장 테마는 Repository 로 일원화(live: 세션→DB / mock: 인메모리 시드). 최근 본 곳은 데모 시드.
const RECENT_SPOT_IDS = ["sacheon-beach", "woljeongsa-trail", "dongmyeong-port"];

export default async function SavedPage() {
  await requireUserSession("save");
  const repo = getRepository();
  const savedThemeIds = await repo.listSavedThemeIds();

  const savedRaw = await Promise.all(
    savedThemeIds.map(async (id) => ({
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
