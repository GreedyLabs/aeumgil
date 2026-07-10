import { ReviewsView, type VisitWithSpot } from "@/components/screens/reviews";
import { type ReviewWithSpot } from "@/components/screens/profile";
import { getRepository } from "@/data";
import { str, type SearchParams } from "@/lib/search-params";
import { requireUserSession } from "@/server/require-session";

export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUserSession("review");
  const sp = await searchParams;
  const repo = getRepository();
  const [reviewsRaw, visitsRaw] = await Promise.all([repo.listReviews(), repo.listVisits()]);

  // 목록 표시용 — 실시간 필드(혼잡/날씨)는 안 쓰므로 enrich 없이(§2.3 콜드 캐시 팬아웃 방지).
  const reviews: ReviewWithSpot[] = (
    await Promise.all(
      reviewsRaw.map(async (review) => {
        const spot = await repo.getSpot(review.spotId, { enrich: false });
        return spot ? { review, spot } : null;
      }),
    )
  ).filter((r): r is ReviewWithSpot => r !== null);

  const visits: VisitWithSpot[] = (
    await Promise.all(
      visitsRaw.map(async (visit) => {
        const spot = await repo.getSpot(visit.spotId, { enrich: false });
        return spot ? { visit, spot } : null;
      }),
    )
  ).filter((v): v is VisitWithSpot => v !== null);

  return <ReviewsView reviews={reviews} visits={visits} initialTab={str(sp.tab)} />;
}
