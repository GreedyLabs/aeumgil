import { notFound } from "next/navigation";
import { AlternativeView, type LocalCommerceItem } from "@/components/screens/alternatives";
import { getRepository } from "@/data";
import { str, type SearchParams } from "@/lib/search-params";

// 테마만 들어온 경우(코스 화면에서 진입)의 대표 혼잡 스팟 매핑
const THEME_DEFAULT_SPOT: Record<string, string> = {
  "east-sea-sunrise": "anmok-beach",
  "market-local": "sokcho-market",
};

export default async function AlternativesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const spotId = str(sp.spot);
  const themeId = str(sp.theme);
  const repo = getRepository();

  const ctxId = spotId ?? (themeId ? (THEME_DEFAULT_SPOT[themeId] ?? "seorak-gwongeum") : "seorak-gwongeum");
  const original = await repo.getSpot(ctxId);
  if (!original) notFound();

  const alts = await repo.getAlternatives(ctxId);

  const [eats, stays] = await Promise.all([repo.listEats(), repo.listStays()]);
  const regions = new Set(alts.map(spot => spot.region.ko));
  const localCommerce: LocalCommerceItem[] = [
    ...eats.filter(e => regions.has(e.region.ko)).map(e => ({...e,kind: "eat" as const})),
    ...stays.filter(stay => regions.has(stay.region.ko)).map(stay => ({...stay,kind: "stay" as const})),
  ];

  return <AlternativeView original={original} alts={alts} localCommerce={localCommerce} />;
}
