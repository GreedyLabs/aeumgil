// 자연어와 URL에서 받은 여행 조건을 동일한 허용 목록으로 정규화한다.
import { internationalIntentQuery } from "./international-intent";
import { GANGWON_REGIONS } from "./place-search";
import type { ComposeCourseOptions } from "./course-compose";

export const COURSE_DAY_CHOICES = [1, 2, 3, 4, 5] as const;

export function parseCourseOptions(
  values: Record<string, string | undefined>,
): ComposeCourseOptions {
  const result: ComposeCourseOptions = {};
  const days = Number(values.days);
  if (Number.isInteger(days) && days >= 1 && days <= 5) result.days = days;
  if (["calm", "balanced", "active"].includes(values.pace ?? "")) result.pace = values.pace;
  if (["solo", "couple", "family"].includes(values.companion ?? ""))
    result.companion = values.companion;
  if (GANGWON_REGIONS.map((r) => r.ko).includes(values.startRegion ?? ""))
    result.startRegion = values.startRegion;
  if (values.transport === "car" || values.transport === "transit" || values.transport === "walk")
    result.transport = values.transport;
  return result;
}

/** 확실하게 표현된 조건만 옮긴다. 무드 형용사로 동행/교통을 추측하지 않는다. */
export function inferCourseOptions(query: string): ComposeCourseOptions {
  query = internationalIntentQuery(query);
  const result: ComposeCourseOptions = {};
  if (/당일/.test(query)) result.days = 1;
  else {
    for (const match of query.matchAll(/(?<!\d)(\d+)\s*일/g)) {
      if (/월\s*$/.test(query.slice(0, match.index))) continue;
      const days = parseCourseOptions({ days: match[1] }).days;
      if (days !== undefined) {
        result.days = days;
        break;
      }
    }
  }
  if (/대중교통|버스|뚜벅이/.test(query)) result.transport = "transit";
  else if (/도보|걸어서/.test(query)) result.transport = "walk";
  else if (/자동차|자가용|렌터카|드라이브/.test(query)) result.transport = "car";
  if (/부모님|가족|아이와|아이랑/.test(query)) result.companion = "family";
  else if (/혼자|나홀로/.test(query)) result.companion = "solo";
  else if (/연인|커플|둘이/.test(query)) result.companion = "couple";
  if (/여유롭게|느긋하게|천천히/.test(query)) result.pace = "calm";
  else if (/활동적으로|알차게/.test(query)) result.pace = "active";
  const region = GANGWON_REGIONS.find((r) => new RegExp(`${r.ko}에서\\s*출발`).test(query))?.ko;
  if (region) result.startRegion = region;
  return result;
}
