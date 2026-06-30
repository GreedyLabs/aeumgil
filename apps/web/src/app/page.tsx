import { HomeView } from "@/components/screens/home";
import { getRepository } from "@/data";
import type { Spot } from "@/domain/types";

// 홈 "지금 가기 좋은" 섹션에 노출할 한적한 스팟 (큐레이션)
const BEST_NOW_SPOT_IDS = ["woljeongsa-trail", "sacheon-beach", "dongmyeong-port"];

export default async function HomePage() {
  const repo = getRepository();
  const [themes, prompts, bestSpots] = await Promise.all([
    repo.listThemes(),
    repo.getSamplePrompts(),
    Promise.all(BEST_NOW_SPOT_IDS.map((id) => repo.getSpot(id, { enrich: false }))).then((spots) =>
      spots.filter((s): s is Spot => s !== null),
    ),
  ]);

  return <HomeView themes={themes} prompts={prompts} bestSpots={bestSpots} />;
}
