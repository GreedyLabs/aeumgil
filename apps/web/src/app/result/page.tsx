import { MatchingView } from "@/components/screens/matching";
import { getRepository } from "@/data";
import { str, type SearchParams } from "@/lib/search-params";

export default async function ResultPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const query = str(sp.q) ?? "";
  const { primaryId, altIds } = await getRepository().matchThemes(query);
  return <MatchingView query={query} primaryId={primaryId} altIds={altIds} />;
}
