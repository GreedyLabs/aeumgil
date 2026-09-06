import { Suspense } from "react";
import { SpotMediaSection } from "@/components/spot-media-section";
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

  return (
    <SpotView
      media={
        <Suspense fallback={null}>
          <SpotMediaSection spot={spot} />
        </Suspense>
      }
      spot={spot}
      alts={alts}
      eats={eats.filter((e) => e.region.ko === spot.region.ko).slice(0, 3)}
      stays={stays.filter((s) => s.region.ko === spot.region.ko).slice(0, 2)}
    />
  );
}
