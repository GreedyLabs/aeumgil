// 에이전트가 순서를 바꾼 뒤에도 체류·이동시간과 하루 종료 시각을 코드로 보장한다.
import { L } from "@/lib/i18n";
import type { Course, CourseItem, Spot } from "./types";
import { estimateDrive, type TravelMode } from "./travel-time";

export function scheduleCourse(course: Course, spots: Spot[], mode: TravelMode = "car"): Course {
  const byId = new Map(spots.map((spot) => [spot.id, spot]));
  const items: CourseItem[] = [];
  const minute = (t: string) => { const [h = 9, m = 0] = t.split(":").map(Number); return h * 60 + m; };
  let adjusted = false;
  for (let day = 1; day <= course.dayCount; day++) {
    let end = 8 * 60;
    let previous: Spot | undefined;
    let previousEnd = end;
    for (const item of course.items.filter((it) => it.day === day).sort((a, b) => minute(a.time) - minute(b.time))) {
      const spot = item.kind === "spot" ? byId.get(item.refId) : undefined;
      if (item.kind === "spot" && !spot) { adjusted = true; continue; }
      let travel = 0;
      if (previous?.lat !== undefined && previous.lon !== undefined && spot?.lat !== undefined && spot.lon !== undefined) {
        travel = estimateDrive({ lat: previous.lat, lon: previous.lon, region: previous.region.ko }, { lat: spot.lat, lon: spot.lon, region: spot.region.ko }, mode)?.driveMinutes ?? 0;
        // 하루 도보 코스에서 몇 시간 떨어진 권역을 연결하지 않는다.
        if (mode === "walk" && travel > 60) { adjusted = true; continue; }
      }
      const start = Math.max(minute(item.time), end, spot ? previousEnd + travel : 0);
      const duration = item.durationMin ?? (item.kind === "spot" ? 60 : item.kind === "eat" ? 60 : 0);
      if (item.kind !== "stay" && start + duration > 20 * 60) { adjusted = true; continue; }
      const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
      if (time !== item.time) adjusted = true;
      items.push({ ...item, time, ...(travel ? { travelMinutes: travel } : {}) });
      end = start + duration;
      if (spot) { previous = spot; previousEnd = end; }
    }
  }
  const days = [...new Set(items.filter((it) => it.kind === "spot").map((it) => it.day))];
  return {
    ...course,
    dayCount: Math.max(1, days.length),
    items: items.filter((it) => days.includes(it.day) && !(it.kind === "stay" && it.day === days.at(-1)))
      .map((it) => ({ ...it, day: days.indexOf(it.day) + 1 })),
    ...(adjusted ? { reorderNote: L("체류시간과 예상 이동시간을 반영했어요. 하루에 방문하기 어려운 구간은 제외했어요.") } : {}),
  };
}
