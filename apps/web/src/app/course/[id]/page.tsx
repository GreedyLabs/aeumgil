import { notFound } from "next/navigation";
import { setThemeSavedAction } from "@/app/actions/saved";
import { CourseView } from "@/components/screens/course";
import { getRepository } from "@/data";
import type { ComposeCourseOptions } from "@/domain/course-compose";
import type { Eat, Spot, Stay } from "@/domain/types";
import { str, type SearchParams } from "@/lib/search-params";

const uniq = (arr: string[]) => [...new Set(arr)];

function courseOptions(sp: Awaited<SearchParams>): ComposeCourseOptions {
  const daysRaw = Number(str(sp.days));
  const options: ComposeCourseOptions = {};
  if (Number.isInteger(daysRaw) && daysRaw >= 1 && daysRaw <= 5) options.days = daysRaw;
  const pace = str(sp.pace);
  if (pace) options.pace = pace;
  const companion = str(sp.companion);
  if (companion) options.companion = companion;
  const startRegion = str(sp.startRegion);
  if (startRegion) options.startRegion = startRegion;
  return options;
}

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const options = courseOptions(sp);
  const repo = getRepository();

  const [theme, course, savedThemeIds] = await Promise.all([
    repo.getTheme(id),
    repo.getCourse(id, options),
    repo.listSavedThemeIds(),
  ]);
  if (!theme || !course) notFound();

  const spotIds = uniq(course.items.filter((it) => it.kind === "spot").map((it) => it.refId));
  const eatIds = uniq(course.items.filter((it) => it.kind === "eat").map((it) => it.refId));
  const stayIds = uniq(course.items.filter((it) => it.kind === "stay").map((it) => it.refId));

  const [spotArr, eatArr, stayArr] = await Promise.all([
    Promise.all(spotIds.map((sid) => repo.getSpot(sid))),
    Promise.all(eatIds.map((eid) => repo.getEat(eid))),
    Promise.all(stayIds.map((sid) => repo.getStay(sid))),
  ]);

  const spots: Record<string, Spot> = {};
  spotArr.forEach((s) => s && (spots[s.id] = s));
  const eats: Record<string, Eat> = {};
  eatArr.forEach((e) => e && (eats[e.id] = e));
  const stays: Record<string, Stay> = {};
  stayArr.forEach((s) => s && (stays[s.id] = s));

  return (
    <CourseView
      theme={theme}
      course={course}
      spots={spots}
      eats={eats}
      stays={stays}
      initiallySaved={savedThemeIds.includes(theme.id)}
      onSaveTheme={setThemeSavedAction}
    />
  );
}
