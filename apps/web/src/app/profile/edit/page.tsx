import { notFound } from "next/navigation";
import { ProfileEditView } from "@/components/screens/profile-edit";
import { getRepository } from "@/data";
import { requireUserSession } from "@/server/require-session";

export default async function ProfileEditPage() {
  await requireUserSession("profile");
  const repo = getRepository();
  const [user, themes] = await Promise.all([repo.getCurrentUser(), repo.listThemes()]);
  if (!user) notFound();
  return (
    <ProfileEditView
      user={user}
      themes={themes.filter(
        (theme) => !theme.id.startsWith("gangwon-") || user.interests.includes(theme.id),
      )}
    />
  );
}
