import { redirect } from "next/navigation";
import { placeSearchParams } from "@/domain/place-search";
/** 기존 지도 북마크는 탐색의 여행지 검색으로 이어진다. */
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = placeSearchParams({ ...params, page: Number(params.page || 1) });
  redirect(`/discover?tab=places${query.size ? `&${query}` : ""}`);
}
