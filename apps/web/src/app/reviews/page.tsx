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

  const reviews: ReviewWithSpot[] = [];
  for (const review of reviewsRaw) {
    const spot = await repo.getSpot(review.spotId);
    if (spot) reviews.push({ review, spot });
  }

  const visits: VisitWithSpot[] = [];
  for (const visit of visitsRaw) {
    const spot = await repo.getSpot(visit.spotId);
    if (spot) visits.push({ visit, spot });
  }

  return <ReviewsView reviews={reviews} visits={visits} initialTab={str(sp.tab)} />;
}
