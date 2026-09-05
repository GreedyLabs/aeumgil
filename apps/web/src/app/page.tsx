import { HomeView } from "@/components/screens/home";
import { getRepository } from "@/data";
import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { selectHomeThemes } from "@/domain/theme-exposure";

export default async function HomePage() {
  await connection();
  const seed = randomUUID();
  const repo = getRepository();
  const [themes, prompts, hero] = await Promise.all([
    repo.listThemes(),
    repo.getSamplePrompts(),
    repo.getSpot("anmok-beach", { enrich: false }),
  ]);
  const featured = selectHomeThemes(themes, seed);
  return <HomeView themes={featured} prompts={prompts} bestSpots={hero ? [hero] : []} />;
}
