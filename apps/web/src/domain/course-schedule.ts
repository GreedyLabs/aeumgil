// 에이전트가 순서를 바꾼 뒤에도 체류·이동시간과 하루 종료 시각을 코드로 보장한다.
import { L } from "@/lib/i18n";
import type { Course, CourseItem, Eat, Spot, Stay } from "./types";
import { estimateDrive, type Coord, type TravelMode } from "./travel-time";

interface CourseSchedulePlaces {
  eats?: Readonly<Record<string, Eat>>;
  stays?: Readonly<Record<string, Stay>>;
}

function coordinateOf(place: Spot | Eat | Stay | undefined): Coord | undefined {
  if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return undefined;
  return { lat: place.lat!, lon: place.lon!, region: place.region.ko };
}

export function scheduleCourse(
  course: Course,
  spots: Spot[],
  mode: TravelMode = "car",
  { eats = {}, stays = {} }: CourseSchedulePlaces = {},
): Course {
  const byId = new Map(spots.map((spot) => [spot.id, spot]));
  const items: CourseItem[] = [];
  const minute = (t: string) => { const [h = 9, m = 0] = t.split(":").map(Number); return h * 60 + m; };
  let adjusted = false;
  for (let day = 1; day <= course.dayCount; day++) {
    let end = 8 * 60;
    let previous: Coord | undefined;
    for (const item of course.items.filter((it) => it.day === day).sort((a, b) => minute(a.time) - minute(b.time))) {
      const place = item.kind === "spot"
        ? byId.get(item.refId)
        : item.kind === "eat" ? eats[item.refId] : stays[item.refId];
      if (item.kind === "spot" && !place) { adjusted = true; continue; }
      const coordinate = coordinateOf(place);
      let travel = 0;
      if (previous && coordinate) {
        travel = estimateDrive(previous, coordinate, mode)?.driveMinutes ?? 0;
        // 하루 도보 코스에서 몇 시간 떨어진 권역을 연결하지 않는다.
        if (mode === "walk" && travel > 60) { adjusted = true; continue; }
      }
      // 식사·숙박도 하나의 방문이다. 이전 관광지 종료 시각을 재사용하면 식사와 이동이 겹친다.
      const start = Math.max(minute(item.time), end + travel);
      const duration = item.durationMin ?? (item.kind === "spot" ? 60 : item.kind === "eat" ? 60 : 0);
      if (item.kind !== "stay" && start + duration > 20 * 60) { adjusted = true; continue; }
      const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
      if (time !== item.time) adjusted = true;
      const { travelMinutes: _previousTravel, ...scheduledItem } = item;
      items.push({ ...scheduledItem, time, ...(travel ? { travelMinutes: travel } : {}) });
      end = start + duration;
      // 보조 장소 좌표가 없으면 마지막으로 확인한 위치에서의 이동을 식사 종료 이후에 반영한다.
      if (coordinate) previous = coordinate;
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
