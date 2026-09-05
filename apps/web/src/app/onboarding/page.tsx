import { OnboardingView } from "@/components/screens/onboarding";
import { getRepository } from "@/data";

export default async function OnboardingPage() {
  const repo = getRepository();
  const [themes, paces, companions] = await Promise.all([
    repo.listThemes(),
    repo.listPaces(),
    repo.listCompanions(),
  ]);
  return (
    <OnboardingView
      themes={themes.filter((theme) => !theme.id.startsWith("gangwon-"))}
      paces={paces}
      companions={companions}
    />
  );
}
