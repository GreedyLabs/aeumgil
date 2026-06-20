import { notFound } from "next/navigation";
import { ThemeResultView } from "@/components/screens/theme-result";
import { getRepository } from "@/data";
import type { Theme } from "@/domain/types";
import { str, type SearchParams } from "@/lib/search-params";

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const repo = getRepository();

  const theme = await repo.getTheme(id);
  if (!theme) notFound();

  const altIds = (str(sp.alt) ?? "").split(",").filter(Boolean);
  const alts = altIds.length
    ? (await Promise.all(altIds.map((a) => repo.getTheme(a)))).filter((t): t is Theme => t !== null)
    : (await repo.listThemes()).filter((t) => t.id !== id);

  return <ThemeResultView theme={theme} alts={alts} query={str(sp.q) ?? ""} />;
}
