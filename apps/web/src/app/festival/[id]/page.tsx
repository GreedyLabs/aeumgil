import { notFound } from "next/navigation";
import { getRepository } from "@/data";
import { FestivalDetailView } from "@/components/screens/festival-detail";

export default async function FestivalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const festival = await getRepository().getFestival(id);
  if (!festival) notFound();
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  return <FestivalDetailView detail={festival} today={today} />;
}
