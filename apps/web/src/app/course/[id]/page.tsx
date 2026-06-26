import { notFound } from "next/navigation";
import { setThemeSavedAction } from "@/app/actions/saved";
import { CourseView } from "@/components/screens/course";
import { getRepository } from "@/data";
import type { Eat, Spot, Stay } from "@/domain/types";

const uniq = (arr: string[]) => [...new Set(arr)];

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();

  const [theme, course, savedThemeIds] = await Promise.all([
    repo.getTheme(id),
    repo.getCourse(id),
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
