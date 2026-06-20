import { notFound } from "next/navigation";
import { AlternativeView, type LocalCommerceItem } from "@/components/screens/alternatives";
import { getRepository } from "@/data";
import type { Spot } from "@/domain/types";
import { str, type SearchParams } from "@/lib/search-params";

// 테마만 들어온 경우(코스 화면에서 진입)의 대표 혼잡 스팟 매핑
const THEME_DEFAULT_SPOT: Record<string, string> = {
  "east-sea-sunrise": "anmok-beach",
  "market-local": "sokcho-market",
};
const FALLBACK_ALT_IDS = ["sacheon-beach", "dongmyeong-port"];

export default async function AlternativesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const spotId = str(sp.spot);
  const themeId = str(sp.theme);
  const repo = getRepository();

  const ctxId = spotId ?? (themeId ? (THEME_DEFAULT_SPOT[themeId] ?? "seorak-gwongeum") : "seorak-gwongeum");
  const original = await repo.getSpot(ctxId);
  if (!original) notFound();

  let alts = await repo.getAlternatives(ctxId);
  if (alts.length === 0) {
    alts = (await Promise.all(FALLBACK_ALT_IDS.map((id) => repo.getSpot(id)))).filter(
      (s): s is Spot => s !== null,
    );
  }

  const [eats, stays] = await Promise.all([repo.listEats(), repo.listStays()]);
  const localCommerce: LocalCommerceItem[] = [...eats.slice(0, 3), ...stays.slice(0, 2)].map((it) => ({
    id: it.id,
    name: it.name,
    type: it.type,
  }));

  return <AlternativeView original={original} alts={alts} localCommerce={localCommerce} />;
}
