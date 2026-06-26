import { ProfileView, type ReviewWithSpot } from "@/components/screens/profile";
import { getRepository } from "@/data";
import type { Theme } from "@/domain/types";

export default async function ProfilePage() {
  const repo = getRepository();
  const [user, savedThemeIds] = await Promise.all([repo.getCurrentUser(), repo.listSavedThemeIds()]);

  const interestIds = user?.interests ?? [];
  const [interestThemes, savedThemes, reviews] = await Promise.all([
    Promise.all(interestIds.map((id) => repo.getTheme(id))).then((a) => a.filter((t): t is Theme => t !== null)),
    Promise.all(savedThemeIds.map((id) => repo.getTheme(id))).then((a) => a.filter((t): t is Theme => t !== null)),
    repo.listReviews(),
  ]);

  const reviewsPreview: ReviewWithSpot[] = [];
  for (const review of reviews.slice(0, 2)) {
    const spot = await repo.getSpot(review.spotId);
    if (spot) reviewsPreview.push({ review, spot });
  }

  return (
    <ProfileView
      user={user}
      interestThemes={interestThemes}
      savedThemes={savedThemes}
      reviewsPreview={reviewsPreview}
    />
  );
}
