import { HomeView } from "@/components/screens/home";
import { getRepository } from "@/data";

export default async function HomePage() {
  const repo = getRepository();
  const [themes, prompts, hero] = await Promise.all([
    repo.listThemes(),
    repo.getSamplePrompts(),
    repo.getSpot("anmok-beach", { enrich: false }),
  ]);
  const ids = ["gangwon-gangneung-sea", "gangwon-yanggu-culture", "gangwon-cheorwon-highlights"];
  const featured = ids.flatMap((id) => {
    const theme = themes.find((t) => t.id === id && t.spotCount > 0 && t.imageUrl);
    return theme ? [theme] : [];
  });
  for (const theme of themes)
    if (featured.length < 3 && theme.imageUrl && theme.spotCount > 0 && !featured.includes(theme))
      featured.push(theme);
  return <HomeView themes={featured} prompts={prompts} bestSpots={hero ? [hero] : []} />;
}
