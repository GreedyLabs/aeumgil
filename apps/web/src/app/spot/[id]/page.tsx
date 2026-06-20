import { notFound } from "next/navigation";
import { SpotView } from "@/components/screens/spot";
import { getRepository } from "@/data";

export default async function SpotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();

  const spot = await repo.getSpot(id);
  if (!spot) notFound();

  const [alts, eats, stays] = await Promise.all([
    repo.getAlternatives(id),
    repo.listEats(),
    repo.listStays(),
  ]);

  return <SpotView spot={spot} alts={alts} eats={eats.slice(0, 3)} stays={stays.slice(0, 2)} />;
}
