import { notFound, redirect } from "next/navigation";
import { getRepository } from "@/data";
import { PersonalCourseEditor, type EditorPlace } from "@/components/screens/personal-course";
import { toPersonalItems, type PersonalCourseInput } from "@/domain/personal-course";
import { parseCourseOptions } from "@/domain/course-options";

export default async function PersonalCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const raw = await searchParams;
  const query = Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
  const repo = getRepository();
  if (!(await repo.getCurrentUser())) {
    const suffix = new URLSearchParams(query).toString();
    redirect(
      `/login?reason=save&returnTo=${encodeURIComponent(`/my-courses/${id}${suffix ? `?${suffix}` : ""}`)}`,
    );
  }
  let initial: PersonalCourseInput = { title: "", note: "", items: [] };
  if (id !== "new") {
    const saved = await repo.getPersonalCourse(id);
    if (!saved) notFound();
    initial = saved;
  } else if (query.from) {
    const course = await repo.getCourse(query.from, parseCourseOptions(query));
    if (!course) notFound();
    initial = {
      title: `${course.title.ko} · 나의 코스`.slice(0, 60),
      note: "",
      items: toPersonalItems(course.items),
    };
  } else if (query.festival) {
    const festival = await repo.getFestival(query.festival);
    if (!festival) notFound();
    initial = {
      title: `${festival.event.name.ko} · 나의 여행`.slice(0, 60),
      note: `${festival.event.startsOn} ~ ${festival.event.endsOn} 행사 일정 확인`,
      items: [{ kind: "festival", refId: festival.place.id, day: 1, durationMin: 120 }],
    };
  }
  if (id === "new" && query.spot) {
    const spot = await repo.getSpot(query.spot, { enrich: false });
    if (spot) initial.items.push({ kind: "spot", refId: spot.id, day: 1, durationMin: 60 });
  }
  if (id === "new" && query.eat) {
    const eat = await repo.getEat(query.eat);
    if (eat) initial.items.push({ kind: "eat", refId: eat.id, day: 1, durationMin: 60 });
  }
  const found = await Promise.all(
    initial.items.map((item) =>
      item.kind === "festival"
        ? repo.getFestival(item.refId).then((event) => event?.place ?? null)
        : item.kind === "spot"
          ? repo.getSpot(item.refId, { enrich: false })
          : item.kind === "eat"
            ? repo.getEat(item.refId)
            : repo.getStay(item.refId),
    ),
  );
  const places: Record<string, EditorPlace> = {};
  for (const place of found) if (place) places[place.id] = place;
  const search = await repo.searchSpots();
  return (
    <PersonalCourseEditor
      key={id}
      initial={initial}
      initialPlaces={places}
      initialSearch={search}
    />
  );
}
