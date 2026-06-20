import { DiscoverView } from "@/components/screens/discover";
import { getRepository } from "@/data";

export default async function DiscoverPage() {
  const themes = await getRepository().listThemes();
  return <DiscoverView themes={themes} />;
}
