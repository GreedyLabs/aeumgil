import { notFound } from "next/navigation";
import { ProfileEditView } from "@/components/screens/profile-edit";
import { getRepository } from "@/data";

export default async function ProfileEditPage() {
  const repo = getRepository();
  const [user, themes] = await Promise.all([repo.getCurrentUser(), repo.listThemes()]);
  if (!user) notFound();
  return <ProfileEditView user={user} themes={themes} />;
}
