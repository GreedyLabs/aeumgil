import { notFound } from "next/navigation";
import { OnboardingView } from "@/components/screens/onboarding";
import { getRepository } from "@/data";
import { requireUserSession } from "@/server/require-session";

export default async function OnboardingPage() {
  await requireUserSession("onboarding");
  const repo = getRepository();
  const [user, paces, companions] = await Promise.all([
    repo.getCurrentUser(),
    repo.listPaces(),
    repo.listCompanions(),
  ]);
  if (!user) notFound();
  return (
    <OnboardingView preference={user.preference ?? null} paces={paces} companions={companions} />
  );
}
