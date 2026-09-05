import { SavedView } from "@/components/screens/saved";
import { getRepository } from "@/data";
import { requireUserSession } from "@/server/require-session";

export default async function SavedPage() {
  await requireUserSession("save");
  const repo = getRepository();
  const [refs, personal] = await Promise.all([repo.listSavedThemes(), repo.listPersonalCourses()]);
  const entries = await Promise.all(
    refs.map(async (ref) => {
      const theme = await repo.getTheme(ref.themeId);
      return theme ? { theme, savedAt: ref.savedAt } : null;
    }),
  );
  const saved = entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  return <SavedView saved={saved} personal={personal} />;
}
