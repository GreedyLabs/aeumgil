import { MapView } from "@/components/screens/map";
import { getRepository } from "@/data";
import type { Spot } from "@/domain/types";

export default async function MapPage() {
  const spotArr = await getRepository().listSpots({ enrich: false });
  const spots: Record<string, Spot> = {};
  spotArr.forEach((s) => (spots[s.id] = s));
  return <MapView spots={spots} />;
}
