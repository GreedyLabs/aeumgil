import type { CourseMapStop, CourseRouteLeg } from "./course-map";
import {
  orderPersonalItems,
  personalDayStartTime,
  type PersonalCourseInput,
} from "./personal-course";
import { estimateDrive } from "./travel-time";
import type { Spot } from "./types";

type PersonalSchedulePlace = Pick<Spot, "id" | "name" | "lat" | "lon">;
const minute = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 9) * 60 + (minutes ?? 30);
};

/** 이동·체류는 순서대로 더하고, 식사·체크인처럼 정해 둔 시각 전에는 방문을 앞당기지 않는다. */
export function schedulePersonalCourseDay(
  course: Pick<PersonalCourseInput, "items" | "transport" | "startTime" | "dayStartTimes">,
  places: Readonly<Record<string, PersonalSchedulePlace>>,
  day: number,
) {
  const today = orderPersonalItems(course.items).filter((item) => item.day === day);
  const stops: CourseMapStop[] = [];
  const legs: CourseRouteLeg[] = [];
  let minutes = minute(personalDayStartTime(course, day));
  for (const item of today) {
    const place = places[item.refId];
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue;
    const previous = stops.at(-1);
    if (previous) {
      const estimate = estimateDrive(
        previous,
        { lat: place.lat!, lon: place.lon! },
        course.transport,
      );
      if (!estimate) continue;
      minutes += estimate.driveMinutes;
      legs.push({
        day,
        fromId: previous.id,
        toId: place.id,
        minutes: estimate.driveMinutes,
        distanceKm: estimate.distanceKm,
        source: "approx",
      });
    }
    if (item.notBeforeTime) minutes = Math.max(minutes, minute(item.notBeforeTime));
    const time =
      minutes < 24 * 60
        ? `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
        : "일정 조정 필요";
    stops.push({
      id: place.id,
      name: place.name.ko,
      lat: place.lat!,
      lon: place.lon!,
      kind: item.kind === "festival" ? "spot" : item.kind,
      time,
    });
    // 마지막 숙박 체류는 다음 날까지 이어지므로 당일 과밀 경고에서 제외한다.
    if (item.kind !== "stay" || item !== today.at(-1)) minutes += item.durationMin;
  }
  return { stops, legs, tooLong: minutes > 21 * 60 };
}
