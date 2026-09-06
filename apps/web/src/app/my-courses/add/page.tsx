import { notFound, redirect } from "next/navigation";
import { getRepository } from "@/data";
import { localized } from "@/lib/i18n";
import { requestLanguage } from "@/server/request-language";
import { AddToCourseView, type AdditionPlace } from "@/components/screens/add-to-course";

export default async function AddToCoursePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["festival", "spot", "eat"] as const) {
    const value = raw[key];
    if (value !== undefined) {
      if (typeof value !== "string" || !value.length || value.length > 100) notFound();
      query.set(key, value);
    }
  }
  if (!query.size) notFound();
  const repo = getRepository();
  if (!(await repo.getCurrentUser()))
    redirect(`/login?reason=save&returnTo=${encodeURIComponent(`/my-courses/add?${query}`)}`);
  const lang = await requestLanguage();

  const places: AdditionPlace[] = [];
  const festivalId = query.get("festival");
  if (festivalId) {
    const festival = await repo.getFestival(festivalId);
    if (!festival) notFound();
    places.push({
      kind: "festival",
      refId: festival.place.id,
      name: localized(festival.event.name, lang),
      region: localized(festival.place.region, lang),
      imageUrl: festival.place.imageUrl,
      detailUrl: `/festival/${encodeURIComponent(festival.event.id)}`,
      note:
        festival.event.startsOn && festival.event.endsOn
          ? `${festival.event.startsOn} ~ ${festival.event.endsOn}`
          : "행사 일정 확인 필요",
    });
  }
  const spotId = query.get("spot");
  if (spotId) {
    const spot = await repo.getSpot(spotId, { enrich: false });
    if (!spot) notFound();
    places.push({
      kind: "spot",
      refId: spot.id,
      name: localized(spot.name, lang),
      region: localized(spot.region, lang),
      imageUrl: spot.imageUrl,
      detailUrl: `/spot/${encodeURIComponent(spot.id)}`,
      note: localized(spot.type, lang),
    });
  }
  const eatId = query.get("eat");
  if (eatId) {
    const eat = await repo.getEat(eatId);
    if (!eat) notFound();
    places.push({
      kind: "eat",
      refId: eat.id,
      name: localized(eat.name, lang),
      region: localized(eat.region, lang),
      imageUrl: eat.imageUrl,
      note: localized(eat.type, lang),
    });
  }
  const courses = await repo.listPersonalCourses();
  const newCourseHref = `/my-courses/new?${query}`;
  if (!courses.length) redirect(newCourseHref);
  return <AddToCourseView courses={courses} places={places} newCourseHref={newCourseHref} />;
}
