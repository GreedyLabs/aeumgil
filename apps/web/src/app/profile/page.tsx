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

  // 미리보기 표시용 — 실시간 필드는 안 쓰므로 enrich 없이(§2.3).
  const reviewsPreview: ReviewWithSpot[] = (
    await Promise.all(
      reviews.slice(0, 2).map(async (review) => {
        const spot = await repo.getSpot(review.spotId, { enrich: false });
        return spot ? { review, spot } : null;
      }),
    )
  ).filter((r): r is ReviewWithSpot => r !== null);

  return (
    <ProfileView
      user={user}
      interestThemes={interestThemes}
      savedThemes={savedThemes}
      reviewsPreview={reviewsPreview}
    />
  );
}
