import { DocView } from "@/components/screens/doc";
import { str, type SearchParams } from "@/lib/search-params";

export default async function DocPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return <DocView doc={str(sp.type)} />;
}
